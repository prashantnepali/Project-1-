function renderLeads() {
  const selectedLeadId = Store.get('selectedLeadId');
  const leads = Store.getLeads();
  const filters = Store.get('filters');
  const searchQuery = Store.get('searchQuery') || '';

  if (selectedLeadId) {
    return renderLeadDetail(selectedLeadId);
  }

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Leads</h1>
        <p class="page-sub">${leads.length} leads in your pipeline</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="export-leads">${icon('download')} Export</button>
        <button class="btn btn-primary" data-action="add-lead">${icon('plus')} Add Lead</button>
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="row" style="gap:10px">
          <div class="res-count">${leads.length} results</div>
          <div class="chips">
            ${Object.entries(filters).filter(([k, v]) => v).map(([k, v]) =>
              `<span class="chip on" data-clear-filter="${k}">${STATUSES[v] || PRIORITY[v] || v} ${icon('x', 'ic-14')}</span>`
            ).join('')}
            ${Object.values(filters).some(Boolean) ? `<button class="chip" id="clear-all-filters" style="color:var(--red)">Clear All</button>` : ''}
          </div>
        </div>
        <div class="row" style="gap:8px">
          <div class="search-box">
            <span class="search-ic">${icon('search', 'ic-16')}</span>
            <input type="text" id="lead-search" placeholder="Search leads..." value="${escapeHtml(searchQuery)}" class="search-input">
          </div>
          <button class="ibtn" id="toggle-filters">${icon('filter')}</button>
        </div>
      </div>

      <div class="filter-bar ${Object.values(filters).some(Boolean) || searchQuery ? 'show' : ''}" id="filter-bar">
        <div class="chips">
          <select class="filter-select" data-filter-key="status">
            <option value="">All Statuses</option>
            ${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${filters.status === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
          <select class="filter-select" data-filter-key="priority">
            <option value="">All Priorities</option>
            ${Object.entries(PRIORITY).map(([k, v]) => `<option value="${k}" ${filters.priority === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
          <select class="filter-select" data-filter-key="industry">
            <option value="">All Industries</option>
            ${INDUSTRIES.map(i => `<option value="${i}" ${filters.industry === i ? 'selected' : ''}>${i}</option>`).join('')}
          </select>
          <select class="filter-select" data-filter-key="source">
            <option value="">All Sources</option>
            ${SOURCES.map(s => `<option value="${s}" ${filters.source === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Company</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Score</th>
              <th>Source</th>
              <th>Last Activity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${leads.map(l => `
              <tr class="row-click" data-lead="${l.id}">
                <td>
                  <div class="row">
                    ${avatar(l.name, 'sm')}
                    <div>
                      <div class="cell-main">${escapeHtml(l.name)}</div>
                      <div class="cell-sub">${escapeHtml(l.email)}</div>
                    </div>
                  </div>
                </td>
                <td>${escapeHtml(l.company)}</td>
                <td>${statusBadge(l.status)}</td>
                <td>${priorityTag(l.priority)}</td>
                <td>${ring(l.score, 'sm')}</td>
                <td><span class="target-chip">${icon('link', 'ic-14')} ${l.source}</span></td>
                <td>${UI.formatDate(l.lastActivity)}</td>
                <td>
                  <div class="td-actions">
                    <button class="ibtn" data-lead-view="${l.id}">${icon('eye', 'ic-14')}</button>
                    <button class="ibtn" data-lead-delete="${l.id}">${icon('trash', 'ic-14')}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  UI.renderView(html);
  bindLeadsEvents();
}

function renderLeadDetail(id) {
  const lead = Store.getLeadById(id);
  if (!lead) return renderLeads();

  const activities = Store.getActivities().filter(a => a.leadId === id);

  const html = `
    <button class="backlink" id="back-to-leads">${icon('chevronLeft')} Back to Leads</button>

    <div class="page-head">
      <div class="row" style="gap:16px">
        ${avatar(lead.name, 'lg')}
        <div>
          <h1 class="page-title">${escapeHtml(lead.name)}</h1>
          <p class="page-sub">${escapeHtml(lead.title)} at ${escapeHtml(lead.company)}</p>
        </div>
        ${statusBadge(lead.status)}
        ${priorityTag(lead.priority)}
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="edit-lead">${icon('edit')} Edit</button>
        <button class="btn btn-primary" data-action="send-email">${icon('send')} Send Email</button>
      </div>
    </div>

    <div class="pipe">
      ${PIPELINE.map(s => `
        <button class="pstep ${lead.status === s ? 'hot' : ''}" data-status="${s}">
          ${icon(lead.status === s ? 'checkCircle' : 'circle')}
          ${STATUSES[s]} <b>${s === lead.status ? '●' : ''}</b>
        </button>
        ${s !== PIPELINE[PIPELINE.length - 1] ? `<span class="parrow">${icon('chevronRight')}</span>` : ''}
      `).join('')}
    </div>

    <div class="grid-2 mt24">
      <div class="dash-col">
        <div class="card">
          <div class="card-head">
            <div class="card-title">Contact Information</div>
          </div>
          <div class="card-body">
            <div class="info-grid">
              <div class="info-row"><span class="info-label">${icon('mail', 'ic-16')} Email</span><span>${escapeHtml(lead.email)}</span></div>
              <div class="info-row"><span class="info-label">${icon('phone', 'ic-16')} Phone</span><span>${escapeHtml(lead.phone)}</span></div>
              <div class="info-row"><span class="info-label">${icon('globe', 'ic-16')} Company</span><span>${escapeHtml(lead.company)}</span></div>
              <div class="info-row"><span class="info-label">${icon('mapPin', 'ic-16')} Location</span><span>${escapeHtml(lead.location)}</span></div>
              <div class="info-row"><span class="info-label">${icon('tag', 'ic-16')} Industry</span><span>${escapeHtml(lead.industry)}</span></div>
              <div class="info-row"><span class="info-label">${icon('link', 'ic-16')} Source</span><span>${escapeHtml(lead.source)}</span></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">Tags</div>
          </div>
          <div class="card-body">
            <div class="chips">
              ${lead.tags.map(t => `<span class="chip on">${escapeHtml(t)}</span>`).join('')}
              <button class="chip" data-action="add-tag">${icon('plus', 'ic-14')} Add</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">Notes</div>
          </div>
          <div class="card-body">
            <textarea id="lead-notes" class="notes-area" placeholder="Add notes about this lead...">${lead.notes || ''}</textarea>
            <button class="btn btn-sm btn-secondary mt8" id="save-notes">${icon('save')} Save Notes</button>
          </div>
        </div>
      </div>

      <div class="dash-col">
        <div class="card">
          <div class="card-head">
            <div class="card-title">Lead Score</div>
          </div>
          <div class="card-body" style="text-align:center">
            ${ring(lead.score, 'lg')}
            <p class="muted small mt12">Based on engagement, company fit, and activity</p>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Activity Timeline</div>
              <div class="card-sub">${activities.length} activities</div>
            </div>
          </div>
          <div class="act-list">
            ${activities.length ? activities.map(a => `
              <div class="act-item">
                <div class="act-ic ${getActivityIconCls(a.type)}">${icon(getActivityIcon(a.type))}</div>
                <div class="act-body">
                  <div>${escapeHtml(a.description)}</div>
                  <time>${UI.formatDate(a.timestamp)}</time>
                </div>
              </div>
            `).join('') : '<div class="act-item" style="justify-content:center;color:var(--text-3)">No activities yet</div>'}
          </div>
        </div>
      </div>
    </div>`;

  UI.renderView(html);
  bindLeadDetailEvents(lead);
}

function bindLeadsEvents() {
  UI.delegate('#view', '[data-lead]', 'click', (e, el) => {
    Store.set('selectedLeadId', el.dataset.lead);
    renderLeads();
  });

  UI.delegate('#view', '[data-lead-view]', 'click', (e, el) => {
    e.stopPropagation();
    Store.set('selectedLeadId', el.dataset.leadView);
    renderLeads();
  });

  UI.delegate('#view', '[data-lead-delete]', 'click', (e, el) => {
    e.stopPropagation();
    const lead = Store.getLeadById(el.dataset.leadDelete);
    if (lead && confirm(`Delete ${lead.name}?`)) {
      Store.deleteLead(el.dataset.leadDelete);
      UI.toast(`${lead.name} removed.`);
      renderLeads();
      UI.buildSidebar();
    }
  });

  UI.delegate('#view', '[data-action="add-lead"]', 'click', () => showAddLeadModal());

  UI.delegate('#view', '[data-action="export-leads"]', 'click', () => {
    UI.toast('Export started — download will begin shortly.');
  });

  UI.on('#lead-search', 'input', (e) => {
    Store.setSearch(e.target.value);
    const filteredLeads = Store.getLeads();
    const tbody = document.querySelector('#view .tbl tbody');
    if (tbody) {
      tbody.innerHTML = filteredLeads.map(l => `
              <tr class="row-click" data-lead="${l.id}">
                <td>
                  <div class="row">
                    ${avatar(l.name, 'sm')}
                    <div>
                      <div class="cell-main">${escapeHtml(l.name)}</div>
                      <div class="cell-sub">${escapeHtml(l.email)}</div>
                    </div>
                  </div>
                </td>
                <td>${escapeHtml(l.company)}</td>
                <td>${statusBadge(l.status)}</td>
                <td>${priorityTag(l.priority)}</td>
                <td>${ring(l.score, 'sm')}</td>
                <td><span class="target-chip">${icon('link', 'ic-14')} ${escapeHtml(l.source)}</span></td>
                <td>${UI.formatDate(l.lastActivity)}</td>
                <td>
                  <div class="td-actions">
                    <button class="ibtn" data-lead-view="${l.id}">${icon('eye', 'ic-14')}</button>
                    <button class="ibtn" data-lead-delete="${l.id}">${icon('trash', 'ic-14')}</button>
                  </div>
                </td>
              </tr>
            `).join('');
      const resCount = document.querySelector('#view .res-count');
      if (resCount) resCount.textContent = filteredLeads.length + ' results';
    }
  });

  UI.delegate('#view', '[data-filter-key]', 'change', (e, el) => {
    Store.setFilter(el.dataset.filterKey, el.value);
    renderLeads();
  });

  UI.delegate('#view', '[data-clear-filter]', 'click', (e, el) => {
    Store.setFilter(el.dataset.clearFilter, '');
    renderLeads();
  });

  UI.on('#clear-all-filters', 'click', () => {
    Store.clearFilters();
    renderLeads();
  });

  UI.on('#toggle-filters', 'click', () => {
    UI.el('filter-bar').classList.toggle('show');
  });
}

function bindLeadDetailEvents(lead) {
  UI.on('#back-to-leads', 'click', () => {
    Store.set('selectedLeadId', null);
    renderLeads();
  });

  UI.delegate('#view', '[data-status]', 'click', (e, el) => {
    Store.updateLead(lead.id, { status: el.dataset.status, lastActivity: new Date() });
    UI.toast(`Status updated to ${STATUSES[el.dataset.status]}`);
    renderLeadDetail(lead.id);
    UI.buildSidebar();
  });

  UI.on('#save-notes', 'click', () => {
    const notes = document.getElementById('lead-notes').value;
    Store.updateLead(lead.id, { notes });
    UI.toast('Notes saved.');
  });

  UI.delegate('#view', '[data-action="send-email"]', 'click', () => {
    UI.toast('Email composer would open here.');
  });

  UI.delegate('#view', '[data-action="edit-lead"]', 'click', () => {
    UI.toast('Lead editor would open here.');
  });

  UI.delegate('#view', '[data-action="add-tag"]', 'click', () => {
    const tag = prompt('Enter tag name:');
    if (tag && tag.trim()) {
      Store.updateLead(lead.id, { tags: [...lead.tags, tag.trim()] });
      UI.toast(`Tag "${tag.trim()}" added.`);
      renderLeadDetail(lead.id);
    }
  });
}

