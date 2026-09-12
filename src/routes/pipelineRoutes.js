const express = require('express');
const articlePipeline = require('../jobs/articlePipeline');
const logger = require('../utils/logger');
const requireAdminKey = require('../middleware/requireAdminKey');

const router = express.Router();

router.post('/trigger', requireAdminKey, async (req, res) => {
  try {
    const article = await articlePipeline.run();
    res.json({ success: true, article });
  } catch (error) {
    if (error.code === 'PIPELINE_BUSY') {
      return res.status(409).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/recover', requireAdminKey, async (req, res) => {
  if (articlePipeline.isBusy()) {
    return res.status(409).json({ success: false, message: 'Pipeline is currently busy.' });
  }

  try {
    articlePipeline.recoverPendingArticles().catch(err => {
      logger.error(`Manual recovery error: ${err.message}`);
    });
    return res.json({ success: true, message: 'Recovery initiated for pending/failed articles' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
