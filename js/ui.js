function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const UI = {
  el(id) {
    return document.getElementById(id);
  },

  $(sel, ctx = document) {
    return ctx.querySelector(sel);
  },

  $$(sel, ctx = document) {
    return [...ctx.querySelectorAll(sel)];
  },

  html(el, h) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (el) el.innerHTML = h;
  },

  on(el, evt, fn, opts) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    const key = `_on_${evt}`;
    if (!el._onHandlers) el._onHandlers = {};
    if (el._onHandlers[key]) {
      el.removeEventListener(evt, el._onHandlers[key]);
    }
    el._onHandlers[key] = fn;
    el.addEventListener(evt, fn, opts);
  },

  delegate(parent, sel, evt, fn) {
    if (typeof parent === 'string') parent = document.querySelector(parent);
    if (!parent) return;
    const key = `_delegate_${sel}_${evt}`;
    if (!parent._delegates) parent._delegates = {};
    if (parent._delegates[key]) {
      parent.removeEventListener(evt, parent._delegates[key]);
    }
    const handler = e => {
      const target = e.target.closest(sel);
      if (target && parent.contains(target)) fn(e, target);
    };
    parent._delegates[key] = handler;
    parent.addEventListener(evt, handler);
  },

  formatDate(d) {
    if (!d) return '—';
    const date = new Date(d);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  },

  statusBadge(status) {
    return `<span class="badge ${STATUS_CLS[status] || 'st-new'}"><span class="dot"></span>${STATUSES[status] || status}</span>`;
  },

  campaignBadge(status) {
    return `<span class="badge ${CAMPAIGN_CLS[status] || ''}"><span class="dot"></span>${CAMPAIGN_STATUSES[status] || status}</span>`;
  },

  priorityTag(p) {
    return `<span class="prio ${PRIORITY_CLS[p] || ''}">${PRIORITY[p] || p}</span>`;
  },

  avatar(name, size = '') {
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `<div class="avatar ${size}">${initials}</div>`;
  },

  ring(pct, size = '', label = '') {
    return `<div class="ring ${size}" style="--p:${pct}"><span>${label || pct + '%'}</span></div>`;
  },

  metricCard(iconName, iconCls, value, label) {
    return `
      <div class="metric">
        <div class="m-ic ${iconCls}">${icon(iconName)}</div>
        <div class="m-val">${value}</div>
        <div class="m-label">${label}</div>
      </div>`;
  },

  toast(msg, type = 'success') {
    const root = document.getElementById('toast-root');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `
      <div class="toast-body">
        <span class="toast-icon">${icon(type === 'success' ? 'checkCircle' : type === 'error' ? 'xCircle' : 'info')}</span>
        <span>${escapeHtml(msg)}</span>
      </div>`;
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 3000);
  },

  modal(title, bodyHtml, opts = {}) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" data-close-modal>
        <div class="modal ${opts.wide ? 'modal-wide' : ''}">
          <div class="modal-head">
            <h3>${title}</h3>
            <button class="ibtn" data-close-modal>${icon('x')}</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          ${opts.footer ? `<div class="modal-foot">${opts.footer}</div>` : ''}
        </div>
      </div>`;
    requestAnimationFrame(() => root.querySelector('.modal-overlay').classList.add('open'));
    root.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => UI.closeModal());
    });
  },

  closeModal() {
    const root = document.getElementById('modal-root');
    const overlay = root.querySelector('.modal-overlay');
    if (overlay) {
      overlay.classList.remove('open');
      setTimeout(() => { root.innerHTML = ''; }, 200);
    }
  },

  buildSidebar() {
    const sb = UI.el('sidebar');
    const metrics = Store.getMetrics();
    const unread = Store.getUnreadRepliesCount();
    const current = Store.get('currentView');
    const settings = Store.get('settings');
    const profileName = settings.profileName || 'Prashant Kumar';
    const profileEmail = settings.profileEmail || 'prashant@samparka.io';

    sb.innerHTML = `
      <div class="sb-brand">
        <div class="sb-logo">${icon('bolt')}</div>
        <div>
          <div class="sb-name">Samparka</div>
          <div class="sb-tag">Lead Engine</div>
        </div>
        <span class="ph-badge">PHASE 2</span>
      </div>
      <nav class="sb-nav">
        <div class="sb-sect">Overview</div>
        <a href="#" class="nav-item ${current === 'dashboard' ? 'active' : ''}" data-nav="dashboard">
          ${icon('home')} Dashboard
        </a>
        <a href="#" class="nav-item ${current === 'analytics' ? 'active' : ''}" data-nav="analytics">
          ${icon('barChart')} Analytics
        </a>

        <div class="sb-sect">Pipeline</div>
        <a href="#" class="nav-item ${current === 'discover' ? 'active' : ''}" data-nav="discover">
          ${icon('globe')} Discover
        </a>
        <a href="#" class="nav-item ${current === 'leads' ? 'active' : ''}" data-nav="leads">
          ${icon('users')} Leads
          <span class="nav-badge show">${metrics.totalLeads}</span>
        </a>
        <a href="#" class="nav-item ${current === 'campaigns' ? 'active' : ''}" data-nav="campaigns">
          ${icon('send')} Campaigns
          <span class="nav-badge show">${metrics.activeCampaigns}</span>
        </a>
        <a href="#" class="nav-item ${current === 'replies' ? 'active' : ''}" data-nav="replies">
          ${icon('messageSquare')} Replies
          ${unread > 0 ? `<span class="nav-badge show">${unread}</span>` : ''}
        </a>

        <div class="sb-sect">System</div>
        <a href="#" class="nav-item ${current === 'settings' ? 'active' : ''}" data-nav="settings">
          ${icon('settings')} Settings
        </a>
      </nav>
      <div class="sb-footer">
        <div class="user-pop" id="user-pop">
          <button class="pop-item" data-pop-action="profile">${icon('user')} My Profile</button>
          <button class="pop-item" data-pop-action="settings">${icon('settings')} Account Settings</button>
          <div class="pop-sep"></div>
          <button class="pop-item" data-pop-action="help">${icon('helpCircle')} Help & Support</button>
          <button class="pop-item" data-pop-action="docs">${icon('externalLink')} View Docs</button>
          <div class="pop-sep"></div>
          <button class="pop-item" style="color:var(--red)" data-pop-action="signout">${icon('power')} Sign Out</button>
        </div>
        <button class="sb-user" id="sb-user-btn">
          ${UI.avatar(profileName)}
          <div class="u-meta">
            <div class="u-name">${escapeHtml(profileName)}</div>
            <div class="u-mail">${escapeHtml(profileEmail)}</div>
          </div>
          ${icon('chevronUp', 'ic-14')}
        </button>
      </div>`;

    UI.delegate(sb, '[data-nav]', 'click', (e, el) => {
      e.preventDefault();
      Store.navigate(el.dataset.nav);
    });

    UI.on('#sb-user-btn', 'click', () => {
      UI.el('user-pop').classList.toggle('open');
    });

    UI.delegate(sb, '[data-pop-action]', 'click', (e, el) => {
      const action = el.dataset.popAction;
      UI.el('user-pop').classList.remove('open');
      if (action === 'profile' || action === 'settings') {
        Store.navigate('settings');
      } else if (action === 'help') {
        UI.toast('Help & Support would open here.');
      } else if (action === 'docs') {
        UI.toast('Documentation would open here.');
      } else if (action === 'signout') {
        Store.init();
        UI.buildSidebar();
        Store.navigate('dashboard');
        UI.toast('Signed out successfully.');
      }
    });

    UI.on(document, 'click', (e) => {
      const pop = UI.el('user-pop');
      if (pop && !e.target.closest('#sb-user-btn') && !e.target.closest('#user-pop')) {
        pop.classList.remove('open');
      }
    });
  },

  buildTopbar() {
    const tb = UI.el('topbar');
    const unread = Store.getUnreadRepliesCount();
    tb.innerHTML = `
      <button class="ibtn" id="menu-toggle">${icon('menu')}</button>
      <div class="tb-brand">
        <div class="tb-logo">${icon('bolt')}</div>
        Samparka
      </div>
      <span class="tb-spacer"></span>
      <button class="ibtn">${icon('search')}</button>
      <button class="ibtn" data-nav="replies">
        ${icon('inbox')}
        ${unread > 0 ? `<span class="nav-badge show" style="position:absolute;top:-4px;right:-4px;font-size:9px;min-width:15px;height:15px">${unread}</span>` : ''}
      </button>`;

    UI.on('#menu-toggle', 'click', () => {
      UI.el('sidebar').classList.toggle('open');
      UI.el('sidebar-overlay').classList.toggle('show');
      document.body.classList.toggle('no-scroll');
    });

    UI.on('#sidebar-overlay', 'click', () => {
      UI.el('sidebar').classList.remove('open');
      UI.el('sidebar-overlay').classList.remove('show');
      document.body.classList.remove('no-scroll');
    });
  },

  renderView(html) {
    UI.html('#view', `<div class="page">${html}</div>`);
  },

  sparkle(n = 6) {
    return Array.from({ length: n }, (_, i) =>
      `<span class="sparkle s${i + 1}" style="--i:${i}"></span>`
    ).join('');
  },
};

const { avatar, statusBadge, campaignBadge, priorityTag, metricCard, ring, formatDate, formatNumber, toast, modal, closeModal, renderView: renderPage } = UI;
