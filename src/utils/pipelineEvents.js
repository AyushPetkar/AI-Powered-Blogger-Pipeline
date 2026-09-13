const EventEmitter = require('events');

class PipelineEventEmitter extends EventEmitter {}

const pipelineEmitter = new PipelineEventEmitter();
pipelineEmitter.setMaxListeners(100);

module.exports = {
  pipelineEmitter,
  EVENTS: {
    PIPELINE_START: 'pipeline:start',
    PIPELINE_END: 'pipeline:end',
    ARTICLE_CREATED: 'article:created',
    ARTICLE_PUBLISHING: 'article:publishing',
    ARTICLE_PUBLISHED: 'article:published',
    ARTICLE_FAILED: 'article:failed',
    ARTICLE_RETRY: 'article:retry'
  }
};
