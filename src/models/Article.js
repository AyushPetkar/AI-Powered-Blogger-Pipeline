const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    tags: { type: [String], default: [] },
    topic: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    bloggerPostId: { type: String, default: null },
    bloggerUrl: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },
    publishedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

articleSchema.index({ status: 1, createdAt: 1 });

const Article = mongoose.model('Article', articleSchema);

module.exports = Article;
