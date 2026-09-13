const aiService = require('../services/aiService');
const bloggerService = require('../services/bloggerService');
const Article = require('../models/Article');
const logger = require('../utils/logger');
const { pipelineEmitter, EVENTS } = require('../utils/pipelineEvents');

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

  pipelineEmitter.emit(EVENTS.ARTICLE_PUBLISHED, {
    articleId: article._id,
    title: article.title,
    bloggerUrl: publishedPost.url,
    publishedAt: article.publishedAt
  });
}

async function markFailed(article, error) {
  article.status = 'FAILED';
  article.retryCount = (article.retryCount || 0) + 1;
  article.errorMessage = error.message;
  await article.save();

  pipelineEmitter.emit(EVENTS.ARTICLE_FAILED, {
    articleId: article._id,
    title: article.title,
    error: error.message,
    retryCount: article.retryCount
  });
}

let autoRetryTimer = null;

function triggerAutoRetry(delayMs = 15000) {
  if (autoRetryTimer) {
    clearTimeout(autoRetryTimer);
  }
  logger.info(`[AUTO-RETRY] Scheduling automatic retry in ${delayMs / 1000}s...`);
  autoRetryTimer = setTimeout(async () => {
    autoRetryTimer = null;
    if (!isPipelineRunning) {
      logger.info('[AUTO-RETRY] Launching automatic retry execution...');
      try {
        await run({ allowAutoRetry: true });
      } catch (err) {
        logger.error(`[AUTO-RETRY] Execution failed: ${err.message}`);
      }
    }
  }, delayMs);
}

async function run(options = {}) {
  if (isPipelineRunning) {
    const error = new Error('Pipeline run is already in progress');
    error.code = 'PIPELINE_BUSY';
    throw error;
  }

  isPipelineRunning = true;
  pipelineEmitter.emit(EVENTS.PIPELINE_START, { timestamp: new Date() });
  logger.info('Starting article pipeline...');
  let articleToPublish = null;
  
  try {
    await resetStalePublishingArticles();

    articleToPublish = await claimArticleForPublishing();

    if (articleToPublish) {
      logger.info(`Claimed recoverable article ${articleToPublish._id} for publishing.`);
      if (!articleToPublish.content || articleToPublish.content.includes('Content generation failed')) {
        logger.info(`Article ${articleToPublish._id} requires content generation. Calling AI...`);
        const generatedContent = await aiService.generateArticle();
        articleToPublish.title = generatedContent.title;
        articleToPublish.content = generatedContent.content;
        articleToPublish.topic = generatedContent.topic;
        articleToPublish.tags = generatedContent.tags;
        await articleToPublish.save();
      }

      pipelineEmitter.emit(EVENTS.ARTICLE_PUBLISHING, {
        articleId: articleToPublish._id,
        title: articleToPublish.title
      });
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
      pipelineEmitter.emit(EVENTS.ARTICLE_CREATED, {
        articleId: newArticle._id,
        title: newArticle.title
      });

      articleToPublish = await claimArticleForPublishing({ _id: newArticle._id });
      if (!articleToPublish) {
        const error = new Error(`New article ${newArticle._id} could not be claimed for publishing`);
        error.code = 'ARTICLE_CLAIM_FAILED';
        throw error;
      }
      pipelineEmitter.emit(EVENTS.ARTICLE_PUBLISHING, {
        articleId: articleToPublish._id,
        title: articleToPublish.title
      });
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
    let shouldAutoRetry = false;
    let targetArticle = articleToPublish;

    if (articleToPublish && articleToPublish._id) {
      await markFailed(articleToPublish, error);
      logger.info(`Article ${articleToPublish._id} status updated to FAILED. Retry count: ${articleToPublish.retryCount}`);
      if (articleToPublish.retryCount < MAX_RETRIES) {
        shouldAutoRetry = true;
      }
    } else {
      try {
        const failedRecord = new Article({
          title: 'Article Generation (Failed)',
          content: '<p>Content generation failed before drafting completed.</p>',
          topic: 'Auto Generation',
          tags: ['Generation Failed'],
          status: 'FAILED',
          errorMessage: error.message,
          retryCount: 1
        });
        await failedRecord.save();
        targetArticle = failedRecord;
        shouldAutoRetry = true;
        pipelineEmitter.emit(EVENTS.ARTICLE_FAILED, {
          articleId: failedRecord._id,
          title: failedRecord.title,
          error: error.message
        });
      } catch (saveErr) {
        logger.error(`Could not save failed article record: ${saveErr.message}`);
      }
    }

    if (shouldAutoRetry && options.allowAutoRetry !== false) {
      const retryDelayMs = 15000;
      pipelineEmitter.emit(EVENTS.ARTICLE_RETRY, {
        articleId: targetArticle?._id,
        title: targetArticle?.title || 'Article',
        delaySeconds: retryDelayMs / 1000,
        message: `Auto-retry scheduled in ${retryDelayMs / 1000}s (Attempt ${targetArticle?.retryCount || 1}/${MAX_RETRIES})`
      });
      triggerAutoRetry(retryDelayMs);
    }

    throw error;
  } finally {
    isPipelineRunning = false;
    pipelineEmitter.emit(EVENTS.PIPELINE_END, { timestamp: new Date() });
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
