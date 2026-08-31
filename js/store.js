const Store = {
  _listeners: {},
  _state: {},

  init() {
    this._state = {
      currentView: 'dashboard',
      leads: [],
      campaigns: [],
      activities: [],
      replies: [],
      discover: [],
      sidebarOpen: false,
      selectedLeadId: null,
      selectedCampaignId: null,
      searchQuery: '',
      filters: {
        status: '',
        priority: '',
        industry: '',
        source: '',
      },
      settings: {
        apiKey: '',
        emailDomain: 'samparka.io',
        autoEnrich: true,
        notifications: true,
        darkMode: false,
      },
    };
  },

  get(key) {
    return this._state[key];
  },

  set(key, value) {
    this._state[key] = value;
    this._emit(key, value);
  },

  on(key, fn) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(fn);
    return () => {
      this._listeners[key] = this._listeners[key].filter(f => f !== fn);
    };
  },

  _emit(key, value) {
    (this._listeners[key] || []).forEach(fn => fn(value));
    (this._listeners['*'] || []).forEach(fn => fn(key, value));
  },

  navigate(view, params = {}) {
    this._state.currentView = view;
    Object.assign(this._state, params);
    this._emit('navigate', { view, ...params });
  },

  getLeads() {
    let leads = [...this._state.leads];
    const { searchQuery, filters } = this._state;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      leads = leads.filter(l =>
        (l.name || '').toLowerCase().includes(q) ||
        (l.company || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.title || '').toLowerCase().includes(q)
      );
    }

    if (filters.status) leads = leads.filter(l => l.status === filters.status);
    if (filters.priority) leads = leads.filter(l => l.priority === filters.priority);
    if (filters.industry) leads = leads.filter(l => l.industry === filters.industry);
    if (filters.source) leads = leads.filter(l => l.source === filters.source);

    return leads;
  },

  getLeadById(id) {
    return this._state.leads.find(l => l.id === id);
  },

  updateLead(id, updates) {
    const idx = this._state.leads.findIndex(l => l.id === id);
    if (idx !== -1) {
      this._state.leads[idx] = { ...this._state.leads[idx], ...updates };
      this._emit('leads', this._state.leads);
    }
  },

  addLead(lead) {
    this._state.leads.unshift(lead);
    this._emit('leads', this._state.leads);
  },

  deleteLead(id) {
    this._state.leads = this._state.leads.filter(l => l.id !== id);
    this._emit('leads', this._state.leads);
  },

  getCampaigns() {
    return [...this._state.campaigns];
  },

  getCampaignById(id) {
    return this._state.campaigns.find(c => c.id === id);
  },

  updateCampaign(id, updates) {
    const idx = this._state.campaigns.findIndex(c => c.id === id);
    if (idx !== -1) {
      this._state.campaigns[idx] = { ...this._state.campaigns[idx], ...updates };
      this._emit('campaigns', this._state.campaigns);
    }
  },

  getReplies() {
    return [...this._state.replies];
  },

  getUnreadRepliesCount() {
    return this._state.replies.filter(r => !r.read).length;
  },

  markReplyRead(id) {
    const reply = this._state.replies.find(r => r.id === id);
    if (reply) {
      reply.read = true;
      this._emit('replies', this._state.replies);
    }
  },

  getActivities() {
    return [...this._state.activities].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  getDiscoverLeads() {
    return [...this._state.discover];
  },

  addToDiscover(id) {
    const dl = this._state.discover.find(d => d.id === id);
    if (dl) {
      dl.added = true;
      const newLead = {
        id: dl.id,
        name: dl.name,
        firstName: dl.name.split(' ')[0],
        lastName: dl.name.split(' ').slice(1).join(' '),
        email: dl.name.toLowerCase().replace(/ /g, '.') + '@' + dl.company.toLowerCase().replace(/[^a-z]/g, '') + '.com',
        phone: '+91 ' + (7000000000 + Math.floor(Math.random() * 3000000000)),
        company: dl.company,
        title: dl.title,
        industry: dl.industry,
        location: dl.location,
        source: dl.source,
        status: 'new',
        priority: 'medium',
        score: dl.score,
        tags: [dl.industry, dl.source],
        notes: '',
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      this._state.leads.unshift(newLead);
      this._emit('leads', this._state.leads);
      this._emit('discover', this._state.discover);
    }
  },

  getPipelineCounts() {
    const counts = {};
    PIPELINE.forEach(s => { counts[s] = 0; });
    this._state.leads.forEach(l => {
      if (counts[l.status] !== undefined) counts[l.status]++;
    });
    return counts;
  },

  getMetrics() {
    const leads = this._state.leads;
    const campaigns = this._state.campaigns;
    const replies = this._state.replies;

    return {
      totalLeads: leads.length,
      newLeads: leads.filter(l => l.status === 'new').length,
      qualified: leads.filter(l => l.status === 'qualified').length,
      inPipeline: leads.filter(l => l.status !== 'new' && l.status !== 'customer').length,
      customers: leads.filter(l => l.status === 'customer').length,
      totalSent: campaigns.reduce((s, c) => s + c.sent, 0),
      totalOpened: campaigns.reduce((s, c) => s + c.opened, 0),
      totalReplied: replies.length,
      avgScore: leads.length ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      responseRate: Math.round((replies.length / Math.max(1, campaigns.reduce((s, c) => s + c.sent, 0))) * 100),
    };
  },

  setSearch(q) {
    this._state.searchQuery = q;
    this._emit('filter', this._state);
  },

  setFilter(key, value) {
    this._state.filters[key] = value;
    this._emit('filter', this._state);
  },

  clearFilters() {
    this._state.filters = { status: '', priority: '', industry: '', source: '' };
    this._state.searchQuery = '';
    this._emit('filter', this._state);
  },
};
