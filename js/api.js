const API_BASE = window.location.port === '3001'
  ? ''
  : 'http://localhost:3001';

const API = {
  async get(path) {
    const res = await fetch(`${API_BASE}/api${path}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'API request failed');
    }
    return res.json();
  },

  async post(path, body) {
    const res = await fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'API request failed');
    }
    return res.json();
  },

  async put(path, body) {
    const res = await fetch(`${API_BASE}/api${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'API request failed');
    }
    return res.json();
  },

  async del(path) {
    const res = await fetch(`${API_BASE}/api${path}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'API request failed');
    }
    return res.json();
  },

  discover: {
    search: (params) => API.post('/discover', params),
    getSearches: () => API.get('/discover'),
    getSearch: (id) => API.get(`/discover/${id}`),
  },

  prospects: {
    list: (params) => {
      const q = new URLSearchParams(params || {}).toString();
      return API.get(`/prospects${q ? '?' + q : ''}`);
    },
    process: (resultIds) => API.post('/prospects/process', { resultIds }),
    enrich: (id) => API.post(`/prospects/${id}/enrich`),
    addToLead: (id) => API.post(`/prospects/${id}/add-to-lead`),
    bulkAdd: (resultIds) => API.post('/prospects/bulk-add', { resultIds }),
  },

  leads: {
    list: (params) => {
      const q = new URLSearchParams(params || {}).toString();
      return API.get(`/leads${q ? '?' + q : ''}`);
    },
    search: (q) => API.get(`/leads/search?q=${encodeURIComponent(q)}`),
    get: (id) => API.get(`/leads/${id}`),
    create: (data) => API.post('/leads', data),
    update: (id, data) => API.put(`/leads/${id}`, data),
    delete: (id) => API.del(`/leads/${id}`),
    metrics: () => API.get('/leads/metrics'),
  },

  activities: {
    list: (params) => {
      const q = new URLSearchParams(params || {}).toString();
      return API.get(`/activities${q ? '?' + q : ''}`);
    },
  },

  settings: {
    get: () => API.get('/settings'),
    update: (data) => API.put('/settings', data),
  },

  accounts: {
    list: () => API.get('/accounts'),
    delete: (id) => API.del(`/accounts/${id}`),
  },

  campaigns: {
    list: (params) => {
      const q = new URLSearchParams(params || {}).toString();
      return API.get(`/campaigns${q ? '?' + q : ''}`);
    },
    get: (id) => API.get(`/campaigns/${id}`),
    create: (data) => API.post('/campaigns', data),
    update: (id, data) => API.put(`/campaigns/${id}`, data),
    delete: (id) => API.del(`/campaigns/${id}`),
    metrics: () => API.get('/campaigns/metrics'),
    assignLeads: (id, leadIds) => API.post(`/campaigns/${id}/leads`, { leadIds }),
    getLeads: (id) => API.get(`/campaigns/${id}/leads`),
    removeLead: (id, leadId) => API.del(`/campaigns/${id}/leads/${leadId}`),
    send: (id) => API.post(`/campaigns/${id}/send`),
    tracking: (id) => API.get(`/campaigns/${id}/tracking`),
    analyticsOverview: () => API.get('/campaigns/analytics/overview'),
  },

  emails: {
    send: (data) => API.post('/emails/send', data),
    sends: (params) => {
      const q = new URLSearchParams(params || {}).toString();
      return API.get(`/emails/sends${q ? '?' + q : ''}`);
    },
    replies: (params) => {
      const q = new URLSearchParams(params || {}).toString();
      return API.get(`/emails/replies${q ? '?' + q : ''}`);
    },
    syncReplies: (accountId) => API.post('/emails/replies/sync', { accountId }),
    notifications: {
      list: (params) => {
        const q = new URLSearchParams(params || {}).toString();
        return API.get(`/emails/notifications${q ? '?' + q : ''}`);
      },
      markRead: (ids) => API.post('/emails/notifications/read', { ids: ids || [] }),
    },
  },
};
