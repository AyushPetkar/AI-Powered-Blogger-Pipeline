import React from 'react';
import { formatRelativeTime, formatDateTime } from '../utils/formatters';

export default function ArticleTable({
  articles,
  loading,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchChange,
  onSelectArticle,
  onRetryArticle,
}) {
  const filterOptions = [
    { label: 'All', value: 'ALL' },
    { label: 'Published', value: 'PUBLISHED' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Publishing', value: 'PUBLISHING' },
    { label: 'Failed', value: 'FAILED' },
  ];

  return (
    <section className="glass-panel articles-section">
      <div className="section-top">
        <div className="section-heading">
          <h2>Articles</h2>
          <p>Latest generation and publishing activity</p>
        </div>

        <div className="search-filter-bar">
          <div className="search-input-wrapper">
            <span className="search-icon" aria-hidden="true">Search</span>
            <input
              type="text"
              placeholder="Search by title, topic, or tag..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search articles"
            />
          </div>

          <div className="filter-tabs" role="tablist">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                role="tab"
                aria-selected={statusFilter === opt.value}
                className={`filter-tab ${statusFilter === opt.value ? 'active' : ''}`}
                onClick={() => onStatusFilterChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="articles-table">
          <thead>
            <tr>
                    <th style={{ width: '45%' }}>Article</th>
              <th style={{ width: '15%' }}>Status</th>
              <th style={{ width: '20%' }}>Timestamp</th>
              <th style={{ width: '20%', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="empty-state-box">
                  <div className="empty-icon">...</div>
                  <div className="empty-title">Loading pipeline entries...</div>
                </td>
              </tr>
            ) : !articles || articles.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-state-box">
                  <div className="empty-icon">No data</div>
                  <div className="empty-title">No articles found</div>
                  <div className="empty-subtitle">
                    {searchTerm || statusFilter !== 'ALL'
                      ? 'Try adjusting your search query or status filter'
                      : 'Click "Generate & Publish Now" above to initiate your first automated post!'}
                  </div>
                </td>
              </tr>
            ) : (
              articles.map((article) => {
                let badgeClass = 'badge-pending';
                if (article.status === 'PUBLISHED') badgeClass = 'badge-published';
                if (article.status === 'PUBLISHING') badgeClass = 'badge-publishing';
                if (article.status === 'FAILED') badgeClass = 'badge-failed';

                return (
                  <tr
                    key={article._id}
                    onClick={() => onSelectArticle(article)}
                    title="Click to view full article preview and details"
                  >
                    <td>
                      <span className="article-headline" title={article.title}>
                        {article.title}
                      </span>
                      <div className="article-submeta">
                        <span className="topic-tag">{article.topic || 'General'}</span>
                        {article.tags && article.tags.length > 0 && (
                          <span>| {article.tags.length} tags</span>
                        )}
                        {article.retryCount > 0 && (
                          <span style={{ color: 'var(--amber-400)' }}>
                            | Retries: {article.retryCount}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className={`badge ${badgeClass}`}>{article.status}</span>
                    </td>

                    <td>
                      <span
                        style={{ color: 'var(--text-secondary)', fontSize: '13px' }}
                        title={formatDateTime(article.publishedAt || article.createdAt)}
                      >
                        {formatRelativeTime(article.publishedAt || article.createdAt)}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                        {article.bloggerUrl && (
                          <a
                            href={article.bloggerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="action-link"
                            onClick={(e) => e.stopPropagation()}
                            title="Open live post on Blogger"
                          >
                            <span>Open post</span>
                          </a>
                        )}

                        {article.status === 'FAILED' && (
                          <button
                            className="action-link"
                            style={{
                              background: 'rgba(244, 63, 94, 0.15)',
                              borderColor: 'rgba(244, 63, 94, 0.3)',
                              color: 'var(--rose-400)',
                              cursor: 'pointer',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRetryArticle(article._id);
                            }}
                            title="Retry publishing this article now"
                          >
                            <span>Retry</span>
                          </button>
                        )}

                        <button
                          className="action-link"
                          style={{
                            background: 'transparent',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectArticle(article);
                          }}
                        >
                          <span>Preview</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
