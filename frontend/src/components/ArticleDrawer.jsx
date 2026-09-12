import React, { useState, useEffect } from 'react';
import { fetchArticleById } from '../services/api';
import { formatDateTime } from '../utils/formatters';

export default function ArticleDrawer({ articleSummary, onClose, onRetryArticle }) {
  const [fullArticle, setFullArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'raw'
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!articleSummary?._id) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchArticleById(articleSummary._id)
      .then((data) => {
        if (isMounted && data.article) {
          setFullArticle(data.article);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [articleSummary?._id]);

  if (!articleSummary) return null;

  const article = fullArticle || articleSummary;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetryArticle(article._id);
      // Re-fetch after retry
      const updated = await fetchArticleById(article._id);
      if (updated?.article) {
        setFullArticle(updated.article);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Article Details"
      >
        <div className="drawer-header">
          <div className="drawer-title-area">
            <h3>{article.title || 'Untitled Article'}</h3>
          </div>
          <button
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close drawer"
          >
            X
          </button>
        </div>

        <div className="drawer-body">
          {/* Metadata Grid */}
          <div className="drawer-meta-grid">
            <div className="meta-item">
              <span className="meta-label">Status</span>
              <span className="meta-value">
                <span
                  className={`badge ${
                    article.status === 'PUBLISHED'
                      ? 'badge-published'
                      : article.status === 'PUBLISHING'
                      ? 'badge-publishing'
                      : article.status === 'FAILED'
                      ? 'badge-failed'
                      : 'badge-pending'
                  }`}
                >
                  {article.status}
                </span>
              </span>
            </div>

            <div className="meta-item">
              <span className="meta-label">Topic</span>
              <span className="meta-value">{article.topic || 'General'}</span>
            </div>

            <div className="meta-item">
              <span className="meta-label">Created At</span>
              <span className="meta-value">{formatDateTime(article.createdAt)}</span>
            </div>

            <div className="meta-item">
              <span className="meta-label">Published At</span>
              <span className="meta-value">{formatDateTime(article.publishedAt) || 'Not yet published'}</span>
            </div>

            {article.bloggerPostId && (
              <div className="meta-item">
                <span className="meta-label">Blogger Post ID</span>
                <span className="meta-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  {article.bloggerPostId}
                </span>
              </div>
            )}

            {article.retryCount !== undefined && article.retryCount > 0 && (
              <div className="meta-item">
                <span className="meta-label">Retry Attempts</span>
                <span className="meta-value" style={{ color: 'var(--amber-400)' }}>
                  {article.retryCount}
                </span>
              </div>
            )}
          </div>

          {/* Error notice if failed */}
          {article.status === 'FAILED' && article.errorMessage && (
            <div className="error-alert-box">
              <strong>Publication error</strong>
              <div>{article.errorMessage}</div>
            </div>
          )}

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <span className="meta-label">SEO Labels / Tags</span>
              <div className="tags-cloud">
                {article.tags.map((tag, i) => (
                  <span key={i} className="tag-pill">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* View mode toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span className="meta-label">Generated Content</span>
            <div className="filter-tabs">
              <button
                className={`filter-tab ${viewMode === 'preview' ? 'active' : ''}`}
                onClick={() => setViewMode('preview')}
              >
                Rendered HTML
              </button>
              <button
                className={`filter-tab ${viewMode === 'raw' ? 'active' : ''}`}
                onClick={() => setViewMode('raw')}
              >
                Raw Source
              </button>
            </div>
          </div>

          {/* Body Content */}
          {loading ? (
            <div className="empty-state-box">
              <div className="empty-icon">...</div>
              <div className="empty-title">Loading full article content...</div>
            </div>
          ) : error ? (
            <div className="error-alert-box">
              Failed to load content: {error}
            </div>
          ) : article.content ? (
            viewMode === 'preview' ? (
              <div
                className="content-preview-container"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            ) : (
              <pre className="raw-html-viewer">
                <code>{article.content}</code>
              </pre>
            )
          ) : (
            <div className="empty-state-box">
              <div className="empty-title">No content generated for this item yet.</div>
            </div>
          )}
        </div>

        <div className="drawer-footer">
          {article.status === 'FAILED' && (
            <button
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, var(--rose-500) 0%, #be123c 100%)' }}
              onClick={handleRetry}
              disabled={isRetrying}
            >
              <span>{isRetrying ? 'Retrying...' : 'Retry Publish Now'}</span>
            </button>
          )}

          {article.bloggerUrl && (
            <a
              href={article.bloggerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              <span>Open on Blogger</span>
            </a>
          )}

          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </div>
  );
}
