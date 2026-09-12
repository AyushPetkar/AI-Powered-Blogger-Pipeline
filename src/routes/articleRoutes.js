const express = require('express');
const Article = require('../models/Article');
const bloggerService = require('../services/bloggerService');
const articlePipeline = require('../jobs/articlePipeline');
const requireAdminKey = require('../middleware/requireAdminKey');

const router = express.Router();

router.get('/articles', async (req, res) => {
  try {
    const { status, search, limit = 50 } = req.query;
    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { title: { $regex: term, $options: 'i' } },
        { topic: { $regex: term, $options: 'i' } },
        { tags: { $regex: term, $options: 'i' } }
      ];
    }

    const articles = await Article.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .select('title status topic tags bloggerUrl bloggerPostId retryCount errorMessage createdAt publishedAt');

    res.json({ success: true, articles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/articles/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    return res.json({ success: true, article });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/articles/:id/retry', requireAdminKey, async (req, res) => {
  try {
    const article = await articlePipeline.claimArticleForPublishing({ _id: req.params.id });
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found or is not eligible for retry' });
    }

    try {
      const publishedPost = await bloggerService.publishPost(article.title, article.content, article.tags);
      await articlePipeline.markPublished(article, publishedPost);
      return res.json({ success: true, article });
    } catch (pubErr) {
      await articlePipeline.markFailed(article, pubErr);
      return res.status(500).json({ success: false, error: pubErr.message });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
