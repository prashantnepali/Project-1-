let _renderGeneration = 0;

const VIEWS = {
  dashboard: renderDashboard,
  discover: renderDiscover,
  leads: renderLeads,
  deals: renderDeals,
  campaigns: renderCampaigns,
  replies: renderReplies,
  tasks: renderTasks,
  templates: renderTemplates,
  analytics: renderAnalytics,
  settings: renderSettings,
};

function getRenderGeneration() {
  return _renderGeneration;
}

async function navigateTo(view) {
  const gen = ++_renderGeneration;
  const renderFn = VIEWS[view];
  if (renderFn) {
    Store._state.currentView = view;
    try {
      await renderFn();
      if (gen !== _renderGeneration) return;
    } catch (err) {
      if (gen !== _renderGeneration) return;
      console.error(`[App] Error rendering ${view}:`, err);
      UI.toast(`Failed to load ${view}: ${err.message}`, 'error');
    }
  }
}

let _notifList = [];
let _notifUnread = 0;
let _syncing = false;

async function refreshNotifications(silent = true) {
  try {
    const data = await API.emails.notifications.list({ limit: 50 });
    _notifUnread = data.unread || 0;
    _notifList = data.notifications || [];
    UI.updateNotifBadge(_notifUnread);
    UI.renderNotifications(_notifList);
  } catch (e) {
    if (!silent) UI.toast('Failed to load notifications.', 'error');
  }
}

async function checkNewReplies() {
  if (_syncing) return;
  _syncing = true;
  try {
    const accounts = await API.accounts.list();
    const gmail = accounts.find(a => a.provider === 'google');
    if (!gmail) return;
    const result = await API.emails.syncReplies(gmail.id);
    if (result.synced > 0) {
      UI.toast(`New reply received from your inbox (${result.synced} new).`);
    }
    await refreshNotifications();
  } catch (e) {
    /* ignore polling errors */
  } finally {
    _syncing = false;
  }
}

function startReplyPolling(intervalMs = 60000) {
  setInterval(() => {
    if (!document.hidden) checkNewReplies();
  }, intervalMs);
}

function syncSidebarForWidth() {
  const sb = UI.el('sidebar');
  if (!sb) return;
  sb.classList.toggle('open', window.innerWidth >= 861);
}

document.addEventListener('DOMContentLoaded', () => {
  Store.init();

  const applyTheme = (darkMode) => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : '');
  };

  // Apply theme from the locally-persisted preference immediately (no flash),
  // then reconcile with the server-stored settings.
  const localDark = localStorage.getItem('samparka-theme');
  applyTheme(localDark === 'dark' || (!localDark && Store.get('settings').darkMode));

  // Load server settings (source of truth for dark mode) and apply theme.
  API.settings.get()
    .then(serverSettings => {
      const merged = { ...Store.get('settings'), ...serverSettings };
      Store.set('settings', merged);
      applyTheme(!!merged.darkMode);
      localStorage.setItem('samparka-theme', merged.darkMode ? 'dark' : 'light');
    })
    .catch(() => {});

  UI.buildSidebar();
  UI.buildTopbar();
  syncSidebarForWidth();
  window.addEventListener('resize', syncSidebarForWidth);
  refreshNotifications();

  checkNewReplies();
  startReplyPolling();

  Store.on('navigate', ({ view }) => {
    UI.buildSidebar();
    navigateTo(view);
  });

  Store.on('leads', () => {
    UI.buildSidebar();
  });

  Store.on('replies', () => {
    UI.buildSidebar();
  });

  navigateTo('dashboard');
});
