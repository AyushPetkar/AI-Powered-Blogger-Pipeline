import React from 'react';
import { formatUptime } from '../utils/formatters';

export default function Navbar({ stats, isRefreshing, onManualRefresh, autoRefresh, onToggleAutoRefresh, isRealtimeConnected }) {
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
          title={autoRefresh ? 'Auto-refresh active (Server-Sent Events + fallback)' : 'Auto-refresh paused'}
        >
          <span
            className={`status-dot ${autoRefresh ? (isRealtimeConnected ? 'idle' : 'busy') : 'error'}`}
            style={{ width: 7, height: 7 }}
          />
          <span>{autoRefresh ? (isRealtimeConnected ? 'Live • Realtime' : 'Live (8s)') : 'Paused'}</span>
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
