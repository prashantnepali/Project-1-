async function renderLeads() {
  const selectedLeadId = Store.get('selectedLeadId');
  if (selectedLeadId) {
    return renderLeadDetail(selectedLeadId);
  }

  const filters = Store.get('filters');
  const searchQuery = Store.get('searchQuery') || '';

  let leads = [];
  try {
    const params = {};
    if (searchQuery) params.search = searchQuery;
    if (filters.status) params.status = filters.status;
    if (filters.priority) params.priority = filters.priority;
    if (filters.industry) params.industry = filters.industry;
    if (filters.source) params.source = filters.source;
    leads = await API.leads.list(params);
    Store._state.leads = leads;
  } catch (err) {
    UI.toast('Failed to load leads: ' + err.message, 'error');
    leads = [];
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
            ${leads.length ? leads.map(l => leadRow(l)).join('') : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-3)">No leads yet. Use Discover to find businesses and add them.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  UI.renderView(html);
  bindLeadsEvents();
}

function leadRow(l) {
  const tags = (typeof l.tags === 'string') ? JSON.parse(l.tags || '[]') : (l.tags || []);
  return `
    <tr class="row-click" data-lead="${l.id}">
      <td>
        <div class="row">
          ${avatar(l.name, 'sm')}
          <div>
            <div class="cell-main">${escapeHtml(l.name)}</div>
            <div class="cell-sub">${escapeHtml(l.email || '')}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(l.company || '')}</td>
      <td>${statusBadge(l.status)}</td>
      <td>${priorityTag(l.priority)}</td>
      <td>${ring(l.fitScore || l.score || 0, 'sm')}</td>
      <td><span class="target-chip">${icon('link', 'ic-14')} ${escapeHtml(l.source || '')}</span></td>
      <td>${UI.formatDate(l.lastActivity)}</td>
      <td>
        <div class="td-actions">
          <button class="ibtn" data-lead-view="${l.id}">${icon('eye', 'ic-14')}</button>
          <button class="ibtn" data-lead-delete="${l.id}">${icon('trash', 'ic-14')}</button>
        </div>
      </td>
    </tr>`;
}

async function renderLeadDetail(id) {
  let lead;
  try {
    lead = await API.leads.get(id);
    if (!lead) return renderLeads();
  } catch (err) {
    UI.toast('Failed to load lead: ' + err.message, 'error');
    Store.set('selectedLeadId', null);
    return renderLeads();
  }

  const companyData = lead.companyData || {};
  const contacts = lead.contacts || [];
  const activities = lead.activities || [];
  const evidence = lead.evidence || [];
  const enrichmentData = lead.enrichmentData || {};
  const fitScore = lead.fitScore;
  const fitClassification = lead.fitClassification;
  const fitBreakdown = lead.fitBreakdown ? (typeof lead.fitBreakdown === 'string' ? JSON.parse(lead.fitBreakdown) : lead.fitBreakdown) : null;
  const tags = lead.tags || [];

  const contactCount = contacts.length;
  const evidenceCount = evidence.length;

  const html = `
    <button class="backlink" id="back-to-leads">${icon('chevronLeft')} Back to Leads</button>

    <div class="page-head">
      <div class="row" style="gap:16px">
        ${avatar(lead.name, 'lg')}
        <div>
          <h1 class="page-title">${escapeHtml(lead.name)}</h1>
          <p class="page-sub">${escapeHtml(lead.title || '')}${lead.title && lead.company ? ' at ' : ''}${escapeHtml(lead.company || '')}</p>
        </div>
        ${statusBadge(lead.status)}
        ${priorityTag(lead.priority)}
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="edit-lead">${icon('edit')} Edit</button>
        <button class="btn btn-secondary" data-action="send-email">${icon('send')} Send Email</button>
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
            <div class="card-title">${icon('globe', 'ic-16')} Company Information</div>
          </div>
          <div class="card-body">
            <div class="info-grid">
              <div class="info-row"><span class="info-label">${icon('mail', 'ic-16')} Email</span><span>${escapeHtml(lead.email || companyData.email || 'Not found')}</span></div>
              <div class="info-row"><span class="info-label">${icon('phone', 'ic-16')} Phone</span><span>${escapeHtml(lead.phone || companyData.phone || 'Not found')}</span></div>
              <div class="info-row"><span class="info-label">${icon('globe', 'ic-16')} Website</span><span>${companyData.website ? `<a href="${escapeHtml(companyData.website)}" target="_blank" style="color:var(--brand)">${escapeHtml(companyData.website)}</a>` : 'Not found'}</span></div>
              <div class="info-row"><span class="info-label">${icon('mapPin', 'ic-16')} Location</span><span>${escapeHtml(lead.location || [companyData.city, companyData.country].filter(Boolean).join(', ') || 'Unknown')}</span></div>
              <div class="info-row"><span class="info-label">${icon('tag', 'ic-16')} Industry</span><span>${escapeHtml(lead.industry || companyData.industry || 'Unknown')}</span></div>
              <div class="info-row"><span class="info-label">${icon('link', 'ic-16')} Source</span><span>${escapeHtml(lead.source || companyData.source || 'Unknown')}</span></div>
              ${companyData.numberOfLocations ? `<div class="info-row"><span class="info-label">${icon('layers', 'ic-16')} Locations</span><span>${companyData.numberOfLocations}</span></div>` : ''}
            </div>
            ${companyData.description ? `<p class="muted small mt12" style="line-height:1.5">${escapeHtml(companyData.description)}</p>` : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon('users', 'ic-16')} Decision-Makers (${contactCount})</div>
          </div>
          <div class="card-body" style="padding:0">
            ${contacts.length ? contacts.map(c => `
              <div class="att-item">
                <div class="row" style="gap:10px">
                  ${avatar(c.name, 'sm')}
                  <div>
                    <div class="att-name">${escapeHtml(c.name)}</div>
                    <div class="att-loc">${escapeHtml(c.title || 'Unknown title')}</div>
                  </div>
                </div>
                <div class="att-side">
                  ${c.linkedinUrl ? `<a href="${escapeHtml(c.linkedinUrl)}" target="_blank" class="ibtn" title="LinkedIn">${icon('linkedin', 'ic-14')}</a>` : ''}
                  <span class="muted small">${c.confidence || 0}%</span>
                </div>
              </div>
            `).join('') : '<div class="att-item" style="justify-content:center;color:var(--text-3)">No decision-makers found yet</div>'}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">Tags</div>
          </div>
          <div class="card-body">
            <div class="chips">
              ${tags.map(t => `<span class="chip on">${escapeHtml(t)}</span>`).join('')}
              <button class="chip" data-action="add-tag">${icon('plus', 'ic-14')} Add</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">Notes</div>
          </div>
          <div class="card-body">
            <textarea id="lead-notes" class="notes-area" placeholder="Add notes about this lead...">${escapeHtml(lead.notes || '')}</textarea>
            <button class="btn btn-sm btn-secondary mt8" id="save-notes">${icon('save')} Save Notes</button>
          </div>
        </div>
      </div>

      <div class="dash-col">
        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon('target', 'ic-16')} Samparka Fit Score</div>
          </div>
          <div class="card-body" style="text-align:center">
            ${ring(fitScore || lead.score || 0, 'lg')}
            <p style="font-weight:600;margin-top:8px;font-size:14px">${escapeHtml(fitClassification || '')}</p>
            <p class="muted small mt4">Based on company intelligence and fit analysis</p>
          </div>
        </div>

        ${fitBreakdown ? `
        <div class="card">
          <div class="card-head">
            <div class="card-title">Score Breakdown</div>
          </div>
          <div class="card-body" style="padding:12px 20px">
            ${Object.entries(fitBreakdown).map(([key, val]) => `
              <div class="fn-row" style="margin-bottom:6px">
                <div class="fn-label" style="width:auto;min-width:120px;font-size:12.5px">${formatFitLabel(key)}</div>
                <div class="fn-track" style="flex:1"><div class="fn-bar" style="width:${val.max ? (val.points / val.max) * 100 : 0}%"></div></div>
                <div class="fn-val" style="font-size:12.5px">+${val.points}</div>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        ${enrichmentData.companyIntelligence || enrichmentData.loyaltyProgram ? `
        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon('zap', 'ic-16')} Company Intelligence</div>
          </div>
          <div class="card-body">
            <div class="info-grid">
              ${enrichmentData.loyaltyProgram ? `<div class="info-row"><span class="info-label">${icon('award', 'ic-16')} Loyalty Program</span><span>${escapeHtml(formatLoyalty(enrichmentData.loyaltyProgram))}</span></div>` : ''}
              ${enrichmentData.digitalPresence ? `<div class="info-row"><span class="info-label">${icon('wifi', 'ic-16')} Digital Presence</span><span>${escapeHtml(enrichmentData.digitalPresence)}</span></div>` : ''}
              ${enrichmentData.numberOfLocations ? `<div class="info-row"><span class="info-label">${icon('layers', 'ic-16')} Branches</span><span>${enrichmentData.numberOfLocations}</span></div>` : ''}
            </div>
            ${enrichmentData.companyIntelligence ? `<p class="muted small mt12" style="line-height:1.5">${escapeHtml(enrichmentData.companyIntelligence)}</p>` : ''}
            ${enrichmentData.relevantSignals && enrichmentData.relevantSignals.length ? `
              <div class="chips mt8">
                ${enrichmentData.relevantSignals.map(s => `<span class="chip on">${escapeHtml(s)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>` : ''}

        ${evidenceCount ? `
        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon('fileText', 'ic-16')} Sources & Evidence (${evidenceCount})</div>
          </div>
          <div class="card-body" style="padding:0;max-height:260px;overflow-y:auto">
            ${evidence.slice(0, 8).map(ev => `
              <div class="att-item" style="border-top:none;padding:8px 20px">
                <div style="flex:1;min-width:0">
                  <div style="font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(ev.sourceTitle || ev.field || 'Source')}</div>
                  <a href="${escapeHtml(ev.sourceUrl || '#')}" target="_blank" style="font-size:11px;color:var(--brand);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${escapeHtml(ev.sourceUrl || '')}</a>
                </div>
                <span class="muted small" style="white-space:nowrap">${ev.confidence || 0}%</span>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

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

function formatFitLabel(key) {
  const labels = {
    industryFit: 'Industry fit',
    repeatCustomerPotential: 'Repeat-customer potential',
    multipleLocations: 'Multiple locations',
    digitalPresence: 'Digital presence',
    decisionMakerFound: 'Decision-maker found',
    contactAvailable: 'Contact info available',
    noLoyaltyProgram: 'No loyalty program',
  };
  return labels[key] || key;
}

function formatLoyalty(status) {
  const map = {
    detected: 'Existing program detected',
    none_detected: 'No program detected',
    unknown: 'Unknown',
  };
  return map[status] || status;
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

  UI.delegate('#view', '[data-lead-delete]', 'click', async (e, el) => {
    e.stopPropagation();
    const leadId = el.dataset.leadDelete;
    const lead = (Store._state.leads || []).find(l => l.id === leadId);
    if (lead && confirm(`Delete ${lead.name}?`)) {
      try {
        await API.leads.delete(leadId);
        UI.toast(`${lead.name} removed.`);
        renderLeads();
        UI.buildSidebar();
      } catch (err) {
        UI.toast('Delete failed: ' + err.message, 'error');
      }
    }
  });

  UI.delegate('#view', '[data-action="add-lead"]', 'click', () => showAddLeadModal());

  UI.delegate('#view', '[data-action="export-leads"]', 'click', () => {
    UI.toast('Export started — download will begin shortly.');
  });

  let searchTimer = null;
  UI.on('#lead-search', 'input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      if (Store.get('currentView') !== 'leads') return;
      Store.set('searchQuery', e.target.value);
      const filters = Store.get('filters');
      const params = {};
      if (e.target.value) params.search = e.target.value;
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.industry) params.industry = filters.industry;
      if (filters.source) params.source = filters.source;

      try {
        const leads = await API.leads.list(params);
        Store._state.leads = leads;
        const tbody = document.querySelector('#view .tbl tbody');
        if (tbody) {
          tbody.innerHTML = leads.length ? leads.map(l => leadRow(l)).join('') : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-3)">No leads match your search.</td></tr>`;
        }
        const resCount = document.querySelector('#view .res-count');
        if (resCount) resCount.textContent = leads.length + ' results';
      } catch (err) {
        UI.toast('Search failed: ' + err.message, 'error');
      }
    }, 300);
  });

  UI.delegate('#view', '[data-filter-key]', 'change', async (e, el) => {
    Store.setFilter(el.dataset.filterKey, e.target.value);
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

async function bindLeadDetailEvents(lead) {
  UI.on('#back-to-leads', 'click', () => {
    Store.set('selectedLeadId', null);
    renderLeads();
  });

  UI.delegate('#view', '[data-status]', 'click', async (e, el) => {
    try {
      await API.leads.update(lead.id, { status: el.dataset.status });
      UI.toast(`Status updated to ${STATUSES[el.dataset.status]}`);
      renderLeadDetail(lead.id);
      UI.buildSidebar();
    } catch (err) {
      UI.toast('Failed to update status: ' + err.message, 'error');
    }
  });

  UI.on('#save-notes', 'click', async () => {
    const notes = document.getElementById('lead-notes').value;
    try {
      await API.leads.update(lead.id, { notes });
      UI.toast('Notes saved.');
    } catch (err) {
      UI.toast('Failed to save notes: ' + err.message, 'error');
    }
  });

  UI.delegate('#view', '[data-action="send-email"]', 'click', () => {
    UI.toast('Email composer would open here.');
  });

  UI.delegate('#view', '[data-action="edit-lead"]', 'click', () => {
    showEditLeadModal(lead);
  });

  UI.delegate('#view', '[data-action="add-tag"]', 'click', async () => {
    const tag = prompt('Enter tag name:');
    if (tag && tag.trim()) {
      const currentTags = lead.tags || [];
      try {
        await API.leads.update(lead.id, { tags: [...currentTags, tag.trim()] });
        UI.toast(`Tag "${tag.trim()}" added.`);
        renderLeadDetail(lead.id);
      } catch (err) {
        UI.toast('Failed to add tag: ' + err.message, 'error');
      }
    }
  });
}

async function showAddLeadModal() {
  const body = `
    <form id="add-lead-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" name="name" placeholder="e.g. Aarav Mehta" required>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" placeholder="e.g. aarav@novatech.com">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Company</label>
          <input type="text" name="company" placeholder="e.g. NovaTech Solutions">
        </div>
        <div class="form-group">
          <label>Title</label>
          <input type="text" name="title" placeholder="e.g. CEO">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Industry</label>
          <select name="industry">
            ${INDUSTRIES.map(i => `<option value="${i}">${i}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Source</label>
          <select name="source">
            ${SOURCES.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" name="phone" placeholder="+91 ...">
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select name="priority">
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" data-close-modal>Cancel</button>
    <button class="btn btn-primary" id="save-lead-btn">${icon('plus')} Add Lead</button>`;

  UI.modal('Add New Lead', body, { footer });

  UI.on('#save-lead-btn', 'click', async () => {
    const form = document.getElementById('add-lead-form');
    const fd = new FormData(form);
    const name = fd.get('name').trim();
    if (!name) return UI.toast('Please enter a name.', 'error');

    try {
      await API.leads.create({
        name,
        email: fd.get('email').trim(),
        phone: fd.get('phone').trim(),
        company: fd.get('company').trim(),
        title: fd.get('title').trim(),
        industry: fd.get('industry'),
        source: fd.get('source'),
        priority: fd.get('priority'),
        score: 50,
      });
      UI.closeModal();
      UI.toast(`${name} added to leads.`);
      renderLeads();
      UI.buildSidebar();
    } catch (err) {
      UI.toast('Failed to add lead: ' + err.message, 'error');
    }
  });
}

function showEditLeadModal(lead) {
  const body = `
    <form id="edit-lead-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value="${escapeHtml(lead.name)}" required>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" value="${escapeHtml(lead.email || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" name="phone" value="${escapeHtml(lead.phone || '')}">
        </div>
        <div class="form-group">
          <label>Title</label>
          <input type="text" name="title" value="${escapeHtml(lead.title || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Priority</label>
          <select name="priority">
            <option value="high" ${lead.priority === 'high' ? 'selected' : ''}>High</option>
            <option value="medium" ${lead.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="low" ${lead.priority === 'low' ? 'selected' : ''}>Low</option>
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select name="status">
            ${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${lead.status === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" data-close-modal>Cancel</button>
    <button class="btn btn-primary" id="save-edit-lead-btn">${icon('save')} Save Changes</button>`;

  UI.modal('Edit Lead', body, { footer });

  UI.on('#save-edit-lead-btn', 'click', async () => {
    const form = document.getElementById('edit-lead-form');
    const fd = new FormData(form);
    try {
      await API.leads.update(lead.id, {
        name: fd.get('name').trim(),
        email: fd.get('email').trim(),
        phone: fd.get('phone').trim(),
        title: fd.get('title').trim(),
        priority: fd.get('priority'),
        status: fd.get('status'),
      });
      UI.closeModal();
      UI.toast('Lead updated.');
      renderLeadDetail(lead.id);
      UI.buildSidebar();
    } catch (err) {
      UI.toast('Failed to update lead: ' + err.message, 'error');
    }
  });
}
