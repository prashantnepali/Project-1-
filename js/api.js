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

  async del(path, body) {
    const opts = { method: 'DELETE' };
    if (body) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}/api${path}`, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'API request failed');
    }
    return res.json();
  },

  async download(path) {
    const res = await fetch(`${API_BASE}/api${path}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Download failed');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/);
    const filename = match ? decodeURIComponent(match[1]) : 'download.csv';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  dashboard: {
    overview: () => API.get('/dashboard/overview'),
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
    process: (id, delay) => API.post(`/campaigns/${id}/process`, delay || {}),
    queue: (id) => API.get(`/campaigns/${id}/queue`),
    preview: (id, lead) => API.post(`/campaigns/${id}/preview`, { lead }),
    tracking: (id) => API.get(`/campaigns/${id}/tracking`),
    analyticsOverview: () => API.get('/campaigns/analytics/overview'),
  },

  emails: {
    send: (data) => API.post('/emails/send', data),
    sends: (params) => {
      const q = new URLSearchParams(params || {}).toString();
      return API.get(`/emails/sends${q ? '?' + q : ''}`);
    },
    bounce: (sendId) => API.post(`/emails/sends/${sendId}/bounce`),
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

  deals: {
    list: (params) => {
      const q = new URLSearchParams(params || {}).toString();
      return API.get(`/deals${q ? '?' + q : ''}`);
    },
    get: (id) => API.get(`/deals/${id}`),
    create: (data) => API.post('/deals', data),
    update: (id, data) => API.put(`/deals/${id}`, data),
    delete: (id) => API.del(`/deals/${id}`),
    metrics: () => API.get('/deals/metrics/overview'),
  },

  tasks: {
    list: (params) => {
      const q = new URLSearchParams(params || {}).toString();
      return API.get(`/tasks${q ? '?' + q : ''}`);
    },
    get: (id) => API.get(`/tasks/${id}`),
    create: (data) => API.post('/tasks', data),
    update: (id, data) => API.put(`/tasks/${id}`, data),
    delete: (id) => API.del(`/tasks/${id}`),
    stats: () => API.get('/tasks/stats'),
  },

  templates: {
    list: (params) => {
      const q = new URLSearchParams(params || {}).toString();
      return API.get(`/templates${q ? '?' + q : ''}`);
    },
    get: (id) => API.get(`/templates/${id}`),
    create: (data) => API.post('/templates', data),
    update: (id, data) => API.put(`/templates/${id}`, data),
    delete: (id) => API.del(`/templates/${id}`),
    use: (id) => API.post(`/templates/${id}/use`),
  },

  export: {
    leads: () => API.download('/export/leads'),
    deals: () => API.download('/export/deals'),
    tasks: () => API.download('/export/tasks'),
    campaigns: () => API.download('/export/campaigns'),
    analytics: () => API.download('/export/analytics'),
    leadEmails: (id) => API.download(`/export/leads/${id}/emails`),
  },

  suppressions: {
    list: (params) => {
      const q = new URLSearchParams(params || {}).toString();
      return API.get(`/suppressions${q ? '?' + q : ''}`);
    },
    add: (data) => API.post('/suppressions', data),
    remove: (email) => API.del(`/suppressions/${encodeURIComponent(email)}`),
    check: (email) => API.get(`/suppressions/check?email=${encodeURIComponent(email)}`),
  },
};
