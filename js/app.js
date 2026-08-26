let _renderGeneration = 0;

const VIEWS = {
  dashboard: renderDashboard,
  discover: renderDiscover,
  leads: renderLeads,
  campaigns: renderCampaigns,
  replies: renderReplies,
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
