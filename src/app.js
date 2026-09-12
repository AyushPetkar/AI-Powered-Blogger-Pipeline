const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const config = require('./config/env');
const { connectDB } = require('./config/database');
const logger = require('./utils/logger');
const scheduler = require('./jobs/scheduler');
const articlePipeline = require('./jobs/articlePipeline');
const statusRoutes = require('./routes/statusRoutes');
const articleRoutes = require('./routes/articleRoutes');
const pipelineRoutes = require('./routes/pipelineRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(__dirname, '../public/index.html'));
  }

  return res.json({
    status: 'running',
    message: 'AI Blogger Automation Pipeline',
    uptime: process.uptime()
  });
});

app.use(statusRoutes);
app.use(articleRoutes);
app.use(pipelineRoutes);

async function start() {
  try {
    await connectDB();
    logger.info('Database connected successfully.');

    await articlePipeline.recoverPendingArticles();

    scheduler.startScheduler();

    const PORT = config.PORT;
    const server = app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is busy or still releasing from a previous session. Please wait a few seconds and run npm start again.`);
      } else {
        logger.error(`Server error: ${err.message}`);
      }
      process.exit(1);
    });

    const shutdown = async (signal) => {
      logger.info(`${signal} received: closing HTTP server and database connection`);
      server.close(async () => {
        logger.info('HTTP server closed');
        await mongoose.connection.close();
        logger.info('Database connection closed');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error(`Startup error: ${error.message}`);
    process.exit(1);
  }
}

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

start();
