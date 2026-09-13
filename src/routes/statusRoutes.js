const express = require('express');
const mongoose = require('mongoose');
const config = require('../config/env');
const Article = require('../models/Article');
const articlePipeline = require('../jobs/articlePipeline');
const { pipelineEmitter, EVENTS } = require('../utils/pipelineEvents');

const router = express.Router();

router.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date() })}\n\n`);

  const sendEvent = (type, payload = {}) => {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  };

  const handlers = {};
  Object.values(EVENTS).forEach((eventType) => {
    handlers[eventType] = (data) => sendEvent(eventType, data);
    pipelineEmitter.on(eventType, handlers[eventType]);
  });

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    Object.entries(handlers).forEach(([eventType, handler]) => {
      pipelineEmitter.off(eventType, handler);
    });
  });
});

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
