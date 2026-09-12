const BASE_URL = '';
const ADMIN_KEY_STORAGE_KEY = 'godstockss-admin-api-key';

export function getAdminApiKey() {
  return window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || '';
}

export function setAdminApiKey(apiKey) {
  if (apiKey) {
    window.localStorage.setItem(ADMIN_KEY_STORAGE_KEY, apiKey);
  } else {
    window.localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
  }
}

function getPostHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };
  const adminApiKey = getAdminApiKey();
  if (adminApiKey) {
    headers['x-api-key'] = adminApiKey;
  }
  return headers;
}

async function parseMutationResponse(res, fallbackMessage) {
  const data = await res.json();
  if (res.status === 401) {
    const err = new Error(data.message || 'Admin API key is required.');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (res.status === 409) {
    const err = new Error(data.message || 'Pipeline is currently busy.');
    err.code = 'PIPELINE_BUSY';
    throw err;
  }
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || fallbackMessage);
  }
  return data;
}

export async function fetchStats() {
  const res = await fetch(`${BASE_URL}/api/stats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch stats: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) {
    throw new Error(`Failed to fetch health: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch(`${BASE_URL}/api/config`);
  if (!res.ok) {
    throw new Error(`Failed to fetch config: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchArticles({ status = 'ALL', search = '', limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (status && status !== 'ALL') params.set('status', status);
  if (search && search.trim()) params.set('search', search.trim());
  if (limit) params.set('limit', limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${BASE_URL}/articles${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch articles: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchArticleById(id) {
  const res = await fetch(`${BASE_URL}/articles/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch article details: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerPipeline() {
  const res = await fetch(`${BASE_URL}/trigger`, {
    method: 'POST',
    headers: getPostHeaders(),
  });

  return parseMutationResponse(res, 'Failed to trigger pipeline');
}

export async function triggerRecovery() {
  const res = await fetch(`${BASE_URL}/api/recover`, {
    method: 'POST',
    headers: getPostHeaders(),
  });

  return parseMutationResponse(res, 'Failed to initiate recovery');
}

export async function retryArticle(id) {
  const res = await fetch(`${BASE_URL}/articles/${id}/retry`, {
    method: 'POST',
    headers: getPostHeaders(),
  });

  return parseMutationResponse(res, 'Failed to retry publishing article');
}
