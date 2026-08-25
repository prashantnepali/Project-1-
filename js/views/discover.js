function renderDiscover() {
  const leads = Store.getDiscoverLeads();
  const addedCount = leads.filter(l => l.added).length;

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Discover</h1>
        <p class="page-sub">Find and add new prospects to your pipeline.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" id="refresh-discover">${icon('refreshCw')} Refresh</button>
        <button class="btn btn-primary" id="bulk-add-discover">${icon('plus')} Add All (${leads.filter(l => !l.added).length} remaining)</button>
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="res-count">${leads.length} prospects found</div>
        <div class="chips" id="discover-filters">
          <button class="chip on" data-filter="all">All</button>
          <button class="chip" data-filter="added">Added (${addedCount})</button>
          <button class="chip" data-filter="pending">Pending (${leads.length - addedCount})</button>
          <div class="chip-sep"></div>
          ${INDUSTRIES.slice(0, 5).map(ind => `<button class="chip" data-filter-industry="${ind}">${ind}</button>`).join('')}
        </div>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Prospect</th>
              <th>Company</th>
              <th>Industry</th>
              <th>Location</th>
              <th>Source</th>
              <th>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="discover-tbody">
            ${discoverRows(leads)}
          </tbody>
        </table>
      </div>
    </div>`;

  UI.renderView(html);
  bindDiscoverEvents(leads);
}

function discoverRows(leads) {
  if (!leads.length) {
    return `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-3)">No prospects match your filters.</td></tr>`;
  }

  return leads.map(l => `
    <tr class="row-click" data-discover-id="${l.id}">
      <td>
        <div class="row">
          ${avatar(l.name, 'sm')}
          <div>
            <div class="cell-main">${escapeHtml(l.name)}</div>
            <div class="cell-sub">${escapeHtml(l.title)}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(l.company)}</td>
      <td><span class="target-chip">${icon('globe', 'ic-14')} ${escapeHtml(l.industry)}</span></td>
      <td>${escapeHtml(l.location)}</td>
      <td><span class="target-chip">${icon('link', 'ic-14')} ${escapeHtml(l.source)}</span></td>
      <td>${ring(l.score, 'sm')}</td>
      <td>
        <div class="td-actions">
          ${l.added
            ? `<span class="badge st-cust"><span class="dot"></span>Added</span>`
            : `<button class="btn btn-sm btn-primary add-discover" data-id="${l.id}">${icon('plus')} Add</button>`
          }
        </div>
      </td>
    </tr>
  `).join('');
}

function bindDiscoverEvents(leads) {
  UI.delegate('#view', '.add-discover', 'click', (e, el) => {
    e.stopPropagation();
    Store.addToDiscover(el.dataset.id);
    UI.toast('Lead added to pipeline.');
    renderDiscover();
    UI.buildSidebar();
  });

  UI.delegate('#view', '#bulk-add-discover', 'click', () => {
    const pending = leads.filter(l => !l.added);
    pending.forEach(l => Store.addToDiscover(l.id));
    UI.toast(`${pending.length} leads added to pipeline.`);
    renderDiscover();
    UI.buildSidebar();
  });

  UI.delegate('#view', '#refresh-discover', 'click', () => {
    Store._state.discover = generateDiscoverLeads();
    UI.toast('Discover refreshed with new prospects.');
    renderDiscover();
  });

  UI.delegate('#view', '[data-filter]', 'click', (e, el) => {
    const f = el.dataset.filter;
    UI.$$('[data-filter]', UI.el('#discover-filters')).forEach(c => c.classList.remove('on'));
    el.classList.add('on');

    let filtered;
    if (f === 'all') filtered = leads;
    else if (f === 'added') filtered = leads.filter(l => l.added);
    else if (f === 'pending') filtered = leads.filter(l => !l.added);
    else filtered = leads;

    UI.html('#discover-tbody', discoverRows(filtered));
  });

  UI.delegate('#view', '[data-filter-industry]', 'click', (e, el) => {
    const ind = el.dataset.filterIndustry;
    UI.$$('[data-filter]', UI.el('#discover-filters')).forEach(c => c.classList.remove('on'));
    el.classList.add('on');
    const filtered = leads.filter(l => l.industry === ind);
    UI.html('#discover-tbody', discoverRows(filtered));
  });
}
