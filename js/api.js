const API_BASE = window.location.port === '3001'
  ? ''
  : 'http://localhost:3001';

const Auth = {
  _token: localStorage.getItem('samparka_token'),
  _user: null,

  get token() { return this._token; },
  get user() { return this._user; },
  get isLoggedIn() { return !!this._token; },

  setSession(token, user) {
    this._token = token;
    this._user = user;
    localStorage.setItem('samparka_token', token);
    localStorage.setItem('samparka_user', JSON.stringify(user));
  },

  loadUser() {
    try {
      this._user = JSON.parse(localStorage.getItem('samparka_user'));
    } catch {
      this._user = null;
    }
  },

  logout() {
    this._token = null;
    this._user = null;
    localStorage.removeItem('samparka_token');
    localStorage.removeItem('samparka_user');
  },
};

Auth.loadUser();

const API = {
  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (Auth.token) {
      headers['Authorization'] = `Bearer ${Auth.token}`;
    }

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}/api${path}`, opts);

    if (res.status === 401) {
      Auth.logout();
      if (typeof navigateTo === 'function') navigateTo('auth');
      throw new Error('Session expired. Please log in again.');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'API request failed');
    }
    return res.json();
  },

  get(path) { return API.request('GET', path); },
  post(path, body) { return API.request('POST', path, body); },
  put(path, body) { return API.request('PUT', path, body); },
  del(path) { return API.request('DELETE', path); },

  auth: {
    register: (data) => API.post('/auth/register', data),
    login: (data) => API.post('/auth/login', data),
    me: () => API.get('/auth/me'),
    updateProfile: (data) => API.put('/auth/me', data),
  },

  teams: {
    list: () => API.get('/teams'),
    get: (id) => API.get(`/teams/${id}`),
    create: (name) => API.post('/teams', { name }),
    invite: (teamId, email, role) => API.post(`/teams/${teamId}/invite`, { email, role }),
    updateRole: (teamId, userId, role) => API.put(`/teams/${teamId}/members/${userId}`, { role }),
    removeMember: (teamId, userId) => API.del(`/teams/${teamId}/members/${userId}`),
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
    addToLead: (id, userId) => API.post(`/prospects/${id}/add-to-lead`, { userId }),
    bulkAdd: (resultIds, userId) => API.post('/prospects/bulk-add', { resultIds, userId }),
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
};
