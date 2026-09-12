import React from 'react';
import { formatUptime } from '../utils/formatters';

export default function Navbar({ stats, isRefreshing, onManualRefresh, autoRefresh, onToggleAutoRefresh }) {
  const isBusy = stats?.isBusy;

  return (
    <header className="navbar glass-panel">
      <div className="nav-brand">
        <div className="brand-icon-box" aria-hidden="true">
          AI
        </div>
        <div className="brand-meta">
          <h1>GODSTOCKSS</h1>
          <p>Content publishing pipeline</p>
        </div>
      </div>

      <div className="nav-controls">
        <div className="status-pill" title={isBusy ? 'Pipeline worker is currently busy' : 'Worker is ready'}>
          <span className={`status-dot ${isBusy ? 'busy' : 'idle'}`} />
          <span>{isBusy ? 'Publishing in progress' : 'Pipeline idle'}</span>
        </div>

        {stats?.uptime !== undefined && (
          <div className="status-pill" title="Server Uptime">
            <span>Uptime</span>
            <strong>{formatUptime(stats.uptime)}</strong>
          </div>
        )}

        <button
          className="refresh-control"
          onClick={onToggleAutoRefresh}
          title={autoRefresh ? 'Click to pause 15s auto-polling' : 'Click to enable 15s auto-polling'}
        >
          <span>{autoRefresh ? 'Live (15s)' : 'Paused'}</span>
        </button>

        <button
          className="refresh-control"
          onClick={onManualRefresh}
          disabled={isRefreshing}
          title="Refresh stats and articles"
          aria-label="Refresh now"
        >
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
}
