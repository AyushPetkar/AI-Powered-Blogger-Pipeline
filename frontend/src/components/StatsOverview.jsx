import React from 'react';

export default function StatsOverview({ stats }) {
  const published = stats?.published ?? 0;
  const pending = stats?.pending ?? 0;
  const publishing = stats?.publishing ?? 0;
  const failed = stats?.failed ?? 0;
  const total = stats?.total ?? 0;

  const successRate = total > 0 ? Math.round((published / total) * 100) : 0;

  return (
    <section className="stats-grid" aria-label="Pipeline Metrics">
      <div className="glass-panel stat-card published">
        <div className="stat-header">
          <span className="stat-title">Published</span>
          <div className="stat-icon" aria-hidden="true">P</div>
        </div>
        <div className="stat-value">{published}</div>
        <div className="stat-footer">
          <span>Live on Blogger.com</span>
          {total > 0 && <span className="stat-rate">{successRate}% success</span>}
        </div>
      </div>

      <div className="glass-panel stat-card pending">
        <div className="stat-header">
          <span className="stat-title">In Queue</span>
          <div className="stat-icon" aria-hidden="true">Q</div>
        </div>
        <div className="stat-value">{pending + publishing}</div>
        <div className="stat-footer">
          <span>{publishing > 0 ? `${publishing} publishing now` : 'Awaiting scheduler tick'}</span>
        </div>
      </div>

      <div className="glass-panel stat-card failed">
        <div className="stat-header">
          <span className="stat-title">Failed</span>
          <div className="stat-icon" aria-hidden="true">!</div>
        </div>
        <div className="stat-value">{failed}</div>
        <div className="stat-footer">
          <span>{failed > 0 ? 'Eligible for auto-recovery' : 'Zero failures detected'}</span>
        </div>
      </div>

      <div className="glass-panel stat-card total">
        <div className="stat-header">
          <span className="stat-title">Total Generated</span>
          <div className="stat-icon" aria-hidden="true">DB</div>
        </div>
        <div className="stat-value">{total}</div>
        <div className="stat-footer">
          <span>Database: <strong style={{ color: stats?.database === 'connected' ? 'var(--emerald-400)' : 'var(--rose-400)' }}>{stats?.database || 'MongoDB'}</strong></span>
        </div>
      </div>
    </section>
  );
}
