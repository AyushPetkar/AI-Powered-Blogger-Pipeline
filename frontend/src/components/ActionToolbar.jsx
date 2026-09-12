import React from 'react';

export default function ActionToolbar({
  isBusy,
  isTriggering,
  isRecovering,
  onTrigger,
  onRecover,
  cronSchedule,
  failedCount
}) {
  return (
    <section className="glass-panel toolbar-section">
      <div className="telemetry-badges">
        <div className="telemetry-pill">
          <span>Schedule</span>
          <strong>{cronSchedule || 'Hourly (0 * * * *)'}</strong>
        </div>
        <div className="telemetry-pill">
          <span>Worker</span>
          <strong className={isBusy ? 'text-warning' : 'text-success'}>
            {isBusy ? 'Processing' : 'Idle'}
          </strong>
        </div>
      </div>

      <div className="action-buttons">
        <button
          className="btn-secondary"
          onClick={onRecover}
          disabled={isBusy || isRecovering || isTriggering}
          title="Attempt to retry and publish any pending or failed articles in the database"
        >
          <span>{isRecovering ? 'Recovering...' : `Run Recovery ${failedCount > 0 ? `(${failedCount})` : ''}`}</span>
        </button>

        <button
          className="btn-primary"
          onClick={onTrigger}
          disabled={isBusy || isTriggering}
          title="Generate a fresh article via Gemini AI and immediately publish to Blogger"
        >
          <span>{isTriggering ? 'Generating & Publishing...' : 'Generate & Publish Now'}</span>
        </button>
      </div>
    </section>
  );
}
