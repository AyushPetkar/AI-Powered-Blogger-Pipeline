const express = require('express');
const mongoose = require('mongoose');
const config = require('../config/env');
const Article = require('../models/Article');
const articlePipeline = require('../jobs/articlePipeline');

const router = express.Router();

router.get('/api/stats', async (req, res) => {
  try {
    const [total, published, pending, publishing, failed] = await Promise.all([
      Article.countDocuments(),
      Article.countDocuments({ status: 'PUBLISHED' }),
      Article.countDocuments({ status: 'PENDING' }),
      Article.countDocuments({ status: 'PUBLISHING' }),
      Article.countDocuments({ status: 'FAILED' })
    ]);

    res.json({
      total,
      published,
      pending,
      publishing,
      failed,
      isBusy: articlePipeline.isBusy(),
      uptime: process.uptime(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      cronSchedule: config.CRON_SCHEDULE
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/config', (req, res) => {
  res.json({
    adminAuthRequired: Boolean(config.ADMIN_API_KEY)
  });
});

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    pipeline: articlePipeline.isBusy() ? 'busy' : 'idle',
    uptime: process.uptime()
  });
});

module.exports = router;
