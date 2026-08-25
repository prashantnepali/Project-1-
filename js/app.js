const VIEWS = {
  dashboard: renderDashboard,
  discover: renderDiscover,
  leads: renderLeads,
  campaigns: renderCampaigns,
  replies: renderReplies,
  analytics: renderAnalytics,
  settings: renderSettings,
};

async function navigateTo(view) {
  const renderFn = VIEWS[view];
  if (renderFn) {
    try {
      await renderFn();
    } catch (err) {
      console.error(`[App] Error rendering ${view}:`, err);
      UI.toast(`Failed to load ${view}: ${err.message}`, 'error');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  Store.init();
  if (Store.get('settings').darkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  UI.buildSidebar();
  UI.buildTopbar();

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
