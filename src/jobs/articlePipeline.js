const aiService = require('../services/aiService');
const bloggerService = require('../services/bloggerService');
const Article = require('../models/Article');
const logger = require('../utils/logger');

let isPipelineRunning = false;
const MAX_RETRIES = 3;
const PUBLISHING_STALE_AFTER_MS = 15 * 60 * 1000;

function publishableFilter(extraFilter = {}) {
  return {
    ...extraFilter,
    $or: [
      { status: 'PENDING' },
      { status: 'FAILED', retryCount: { $lt: MAX_RETRIES } }
    ]
  };
}

async function resetStalePublishingArticles() {
  const staleBefore = new Date(Date.now() - PUBLISHING_STALE_AFTER_MS);
  const result = await Article.updateMany(
    {
      status: 'PUBLISHING',
      updatedAt: { $lt: staleBefore },
      retryCount: { $lt: MAX_RETRIES }
    },
    {
      $set: {
        status: 'FAILED',
        errorMessage: 'Publishing lock expired before completion'
      },
      $inc: { retryCount: 1 }
    }
  );

  if (result.modifiedCount > 0) {
    logger.warn(`Recovered ${result.modifiedCount} stale PUBLISHING article lock(s).`);
  }
}

async function claimArticleForPublishing(extraFilter = {}) {
  return Article.findOneAndUpdate(
    publishableFilter(extraFilter),
    {
      $set: {
        status: 'PUBLISHING',
        errorMessage: null
      }
    },
    {
      new: true,
      sort: { createdAt: 1 }
    }
  );
}

async function markPublished(article, publishedPost) {
  article.status = 'PUBLISHED';
  article.bloggerPostId = publishedPost.postId;
  article.bloggerUrl = publishedPost.url;
  article.publishedAt = new Date();
  article.errorMessage = null;
  await article.save();
}

async function markFailed(article, error) {
  article.status = 'FAILED';
  article.retryCount = (article.retryCount || 0) + 1;
  article.errorMessage = error.message;
  await article.save();
}

async function run() {
  if (isPipelineRunning) {
    const error = new Error('Pipeline run is already in progress');
    error.code = 'PIPELINE_BUSY';
    throw error;
  }

  isPipelineRunning = true;
  logger.info('Starting article pipeline...');
  let articleToPublish = null;
  
  try {
    await resetStalePublishingArticles();

    articleToPublish = await claimArticleForPublishing();

    if (articleToPublish) {
      logger.info(`Claimed recoverable article ${articleToPublish._id} for publishing.`);
    } else {
      logger.info('No recoverable articles found. Generating new article...');
      const generatedContent = await aiService.generateArticle();

      const newArticle = new Article({
        title: generatedContent.title,
        content: generatedContent.content,
        topic: generatedContent.topic,
        tags: generatedContent.tags,
        status: 'PENDING'
      });
      await newArticle.save();
      logger.info(`New article generated and saved with status PENDING: ${newArticle._id}`);

      articleToPublish = await claimArticleForPublishing({ _id: newArticle._id });
      if (!articleToPublish) {
        const error = new Error(`New article ${newArticle._id} could not be claimed for publishing`);
        error.code = 'ARTICLE_CLAIM_FAILED';
        throw error;
      }
    }

    logger.info(`Publishing article ${articleToPublish._id} to Blogger...`);
    const publishedPost = await bloggerService.publishPost(
      articleToPublish.title,
      articleToPublish.content,
      articleToPublish.tags
    );

    await markPublished(articleToPublish, publishedPost);

    logger.info(`Outcome: Success! Article ${articleToPublish._id} published at ${publishedPost.url}`);

    return articleToPublish;

  } catch (error) {
    logger.error(`Outcome: Failed! Pipeline error: ${error.message}`);
    if (articleToPublish && articleToPublish._id) {
      await markFailed(articleToPublish, error);
      logger.info(`Article ${articleToPublish._id} status updated to FAILED. Retry count: ${articleToPublish.retryCount}`);
    }
    throw error;
  } finally {
    isPipelineRunning = false;
  }
}

async function recoverPendingArticles() {
  logger.info('Running recovery for pending/failed articles...');
  await resetStalePublishingArticles();
  
  let published = 0;
  let failed = 0;

  while (true) {
    const article = await claimArticleForPublishing();
    if (!article) break;

    try {
      logger.info(`Attempting recovery publish for article: ${article._id}`);
      const publishedPost = await bloggerService.publishPost(article.title, article.content, article.tags);

      await markPublished(article, publishedPost);
      published++;

      await new Promise(resolve => setTimeout(resolve, 2500));
    } catch (error) {
      logger.error(`Recovery failed for article ${article._id}: ${error.message}`);
      await markFailed(article, error);
      failed++;
    }
  }

  logger.info(`Recovery complete: ${published} published, ${failed} failed`);
}

module.exports = {
  run,
  recoverPendingArticles,
  claimArticleForPublishing,
  markPublished,
  markFailed,
  isBusy: () => isPipelineRunning
};
