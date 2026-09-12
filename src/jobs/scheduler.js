const cron = require('node-cron');
const config = require('../config/env');
const articlePipeline = require('./articlePipeline');
const logger = require('../utils/logger');

function startScheduler() {
  const schedule = config.CRON_SCHEDULE;
  logger.info(`Starting scheduler with schedule: ${schedule}`);
  
  const task = cron.schedule(schedule, async () => {
    try {
      await articlePipeline.run();
    } catch (error) {
      if (error.code === 'PIPELINE_BUSY') {
        logger.warn('Scheduled pipeline tick skipped: A pipeline run is already in progress.');
      } else {
        logger.error(`Scheduler pipeline error: ${error.message}`);
      }
    }
  });

  return task;
}

module.exports = { startScheduler };
