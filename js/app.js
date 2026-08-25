const VIEWS = {
  dashboard: renderDashboard,
  discover: renderDiscover,
  leads: renderLeads,
  campaigns: renderCampaigns,
  replies: renderReplies,
  analytics: renderAnalytics,
  settings: renderSettings,
};

function navigateTo(view) {
  const renderFn = VIEWS[view];
  if (renderFn) renderFn();
}

document.addEventListener('DOMContentLoaded', () => {
  Store.init();

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

  document.querySelectorAll('[data-nav]').forEach(el => {
    if (!el.closest('.sidebar') && !el.closest('.topbar')) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        Store.navigate(el.dataset.nav);
      });
    }
  });
});
