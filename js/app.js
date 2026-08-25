const VIEWS = {
  dashboard: renderDashboard,
  discover: renderDiscover,
  leads: renderLeads,
  campaigns: renderCampaigns,
  replies: renderReplies,
  analytics: renderAnalytics,
  settings: renderSettings,
  auth: renderAuth,
  team: renderTeam,
};

const PROTECTED_VIEWS = ['dashboard', 'discover', 'leads', 'campaigns', 'replies', 'analytics', 'settings', 'team'];

async function navigateTo(view) {
  if (PROTECTED_VIEWS.includes(view) && !Auth.isLoggedIn) {
    return navigateTo('auth');
  }

  const renderFn = VIEWS[view];
  if (renderFn) {
    try {
      await renderFn();
      Store._state.currentView = view;
    } catch (err) {
      console.error(`[App] Error rendering ${view}:`, err);
      UI.toast(`Failed to load ${view}: ${err.message}`, 'error');
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  Store.init();
  if (Store.get('settings').darkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  UI.buildSidebar();
  UI.buildTopbar();

  if (Auth.isLoggedIn) {
    try {
      const user = await API.auth.me();
      Auth._user = user;
      Store._state.currentUser = user;
    } catch {
      Auth.logout();
    }
  }

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

  navigateTo(Auth.isLoggedIn ? 'dashboard' : 'auth');
});
