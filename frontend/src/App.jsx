import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import StatsOverview from './components/StatsOverview';
import ActionToolbar from './components/ActionToolbar';
import ArticleTable from './components/ArticleTable';
import ArticleDrawer from './components/ArticleDrawer';
import Toast from './components/Toast';
import {
  fetchStats,
  fetchArticles,
  triggerPipeline,
  triggerRecovery,
  retryArticle,
  setAdminApiKey,
} from './services/api';

export default function App() {
  const [stats, setStats] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 6000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 4);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const runProtectedAction = useCallback(async (action) => {
    try {
      return await action();
    } catch (err) {
      if (err.code !== 'UNAUTHORIZED') {
        throw err;
      }

      const apiKey = window.prompt('Enter the admin API key for this dashboard action:');
      if (!apiKey) {
        throw err;
      }

      setAdminApiKey(apiKey.trim());
      return action();
    }
  }, []);

  // Fetch Stats & Articles
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const [statsData, articlesData] = await Promise.all([
        fetchStats(),
        fetchArticles({ status: statusFilter, search: searchTerm }),
      ]);
      setStats(statsData);
      if (articlesData?.articles) {
        setArticles(articlesData.articles);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, [statusFilter, searchTerm]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time Server-Sent Events (SSE) listener
  useEffect(() => {
    let eventSource = null;
    let reconnectTimeout = null;

    function connectSSE() {
      try {
        eventSource = new EventSource('/api/events');

        eventSource.onopen = () => {
          setIsRealtimeConnected(true);
        };

        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (!data || data.type === 'connected') return;

            // Instantly refresh dashboard data on any pipeline/article lifecycle event
            loadData();

            if (data.type === 'article:published') {
              addToast(`Live Update: "${data.title || 'New Article'}" published to Blogger!`, 'success', 7000);
            } else if (data.type === 'article:created') {
              addToast(`Live Update: New article drafted ("${data.title || 'Article'}")`, 'info', 5000);
            } else if (data.type === 'article:publishing') {
              addToast(`Live Update: Publishing "${data.title || 'Article'}" to Blogger...`, 'info', 5000);
            } else if (data.type === 'article:failed') {
              addToast(`Live Update: Pipeline failure: ${data.error || 'Unknown error'}`, 'error', 7000);
            } else if (data.type === 'article:retry') {
              addToast(`Auto-Retry: ${data.message || 'Retrying publication...'}`, 'info', 8000);
            }
          } catch {
            // keepalive or non-json message
          }
        };

        eventSource.onerror = () => {
          setIsRealtimeConnected(false);
          eventSource.close();
          // Attempt reconnection after 5s
          reconnectTimeout = setTimeout(connectSSE, 5000);
        };
      } catch {
        setIsRealtimeConnected(false);
      }
    }

    connectSSE();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, [loadData, addToast]);

  // Trigger refresh on window focus / tab visibility change
  useEffect(() => {
    const handleFocusOrVisibility = () => {
      if (!document.hidden) {
        loadData();
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    };
  }, [loadData]);

  // Fallback auto-refresh timer (fast 4s when pipeline is busy, 8s when idle)
  useEffect(() => {
    if (!autoRefresh) return;
    const intervalMs = stats?.isBusy ? 4000 : 8000;
    const interval = setInterval(() => {
      loadData();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData, stats?.isBusy]);

  // Trigger New Article Generation & Publish
  const handleTrigger = async () => {
    setIsTriggering(true);
    addToast('Article generation pipeline triggered. Gemini AI is drafting content...', 'info', 8000);

    try {
      const res = await runProtectedAction(triggerPipeline);
      if (res.success) {
        addToast(`Published: "${res.article?.title || 'New Article'}" to Blogger!`, 'success', 8000);
        await loadData();
      }
    } catch (err) {
      if (err.code === 'PIPELINE_BUSY') {
        addToast('Pipeline is currently active generating an article. Please wait.', 'error', 6000);
      } else {
        addToast(`Generation error: ${err.message}`, 'error', 8000);
      }
    } finally {
      setIsTriggering(false);
    }
  };

  // Run Pending/Failed Recovery
  const handleRecover = async () => {
    setIsRecovering(true);
    addToast('Recovery initiated for pending and failed articles...', 'info', 6000);

    try {
      const res = await runProtectedAction(triggerRecovery);
      addToast(res.message || 'Recovery job started successfully', 'success', 6000);
      setTimeout(() => loadData(), 3000);
    } catch (err) {
      addToast(`Recovery error: ${err.message}`, 'error', 6000);
    } finally {
      setIsRecovering(false);
    }
  };

  // Retry a specific article
  const handleRetryArticle = async (articleId) => {
    addToast('Retrying publication with Blogger...', 'info', 4000);
    try {
      const res = await runProtectedAction(() => retryArticle(articleId));
      if (res.success) {
        addToast('Article successfully published to Blogger!', 'success', 6000);
        await loadData();
      }
    } catch (err) {
      addToast(`Retry failed: ${err.message}`, 'error', 8000);
      await loadData();
      throw err;
    }
  };

  return (
    <div className="app-layout">
      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Top Navbar */}
      <Navbar
        stats={stats}
        isRefreshing={isRefreshing}
        onManualRefresh={() => loadData(true)}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
        isRealtimeConnected={isRealtimeConnected}
      />

      {/* KPI Overview Grid */}
      <StatsOverview stats={stats} />

      {/* Action Trigger & Telemetry Toolbar */}
      <ActionToolbar
        isBusy={stats?.isBusy}
        isTriggering={isTriggering}
        isRecovering={isRecovering}
        onTrigger={handleTrigger}
        onRecover={handleRecover}
        cronSchedule={stats?.cronSchedule}
        failedCount={stats?.failed}
      />

      {/* Interactive Article Log */}
      <ArticleTable
        articles={articles}
        loading={loading}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onSelectArticle={setSelectedArticle}
        onRetryArticle={handleRetryArticle}
      />

      {/* Article Detail Drawer */}
      {selectedArticle && (
        <ArticleDrawer
          articleSummary={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onRetryArticle={handleRetryArticle}
        />
      )}
    </div>
  );
}
