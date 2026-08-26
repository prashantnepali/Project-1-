function renderDiscover() {
  _discoverResults = [];
  _discoverSelected.clear();

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Discover</h1>
        <p class="page-sub">Find real businesses worldwide and add them to your pipeline.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="view-searches">${icon('clock')} Search History</button>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">${icon('search')} New Search</div>
        <div class="card-sub">Define your target market to discover real businesses</div>
      </div>
      <div class="card-body">
        <form id="discover-form" class="form-grid">
          <div class="form-row">
            <div class="form-group">
              <label>Country *</label>
              <select id="disc-country" required>
                <option value="">Select country...</option>
                <option value="United Arab Emirates">United Arab Emirates</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Australia">Australia</option>
                <option value="Singapore">Singapore</option>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
                <option value="Japan">Japan</option>
                <option value="India">India</option>
                <option value="Nepal">Nepal</option>
                <option value="Thailand">Thailand</option>
                <option value="Malaysia">Malaysia</option>
                <option value="Indonesia">Indonesia</option>
                <option value="Philippines">Philippines</option>
                <option value="South Korea">South Korea</option>
                <option value="New Zealand">New Zealand</option>
                <option value="Ireland">Ireland</option>
                <option value="Netherlands">Netherlands</option>
                <option value="Spain">Spain</option>
                <option value="Italy">Italy</option>
              </select>
            </div>
            <div class="form-group">
              <label>City / Region</label>
              <input type="text" id="disc-city" placeholder="e.g. Dubai, London, Sydney...">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Industry</label>
              <select id="disc-industry">
                <option value="">Any industry...</option>
                <option value="Hospitality">Hospitality</option>
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Retail">Retail</option>
                <option value="Health & Fitness">Health & Fitness</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Automotive">Automotive</option>
                <option value="Education">Education</option>
                <option value="Entertainment">Entertainment</option>
              </select>
            </div>
            <div class="form-group">
              <label>Business Type *</label>
              <select id="disc-type" required>
                <option value="">Select type...</option>
                <option value="hotel">Hotel / Resort</option>
                <option value="restaurant">Restaurant</option>
                <option value="cafe">Cafe / Bar / Pub</option>
                <option value="retail">Retail / Shop</option>
                <option value="hospitality">Hospitality (All)</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button type="submit" class="btn btn-primary" id="disc-search-btn">${icon('search')} Search OpenStreetMap</button>
          </div>
        </form>
      </div>
    </div>

    <div id="discover-results" style="display:none">
      <div class="card mt24">
        <div class="toolbar">
          <div class="row" style="gap:10px">
            <div class="res-count" id="disc-count">0 results</div>
            <div class="chips" id="disc-status-filters">
              <button class="chip on" data-dfilter="all">All</button>
              <button class="chip" data-dfilter="discovered">Discovered</button>
              <button class="chip" data-dfilter="prequalified">Qualified</button>
              <button class="chip" data-dfilter="rejected">Rejected</button>
            </div>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn btn-sm btn-secondary" id="disc-process-btn" disabled>${icon('zap')} Process & Qualify</button>
            <button class="btn btn-sm btn-primary" id="disc-add-all-btn" disabled>${icon('plus')} Add All Qualified</button>
          </div>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th><input type="checkbox" id="disc-select-all"></th>
                <th>Business</th>
                <th>Location</th>
                <th>Category</th>
                <th>Website</th>
                <th>Source</th>
                <th>Status</th>
                <th>Fit Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="disc-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="discover-searches" style="display:none">
      <div class="card mt24">
        <div class="card-head">
          <div class="card-title">${icon('clock')} Search History</div>
        </div>
        <div id="disc-searches-list"></div>
      </div>
    </div>`;

  UI.renderView(html);
  bindDiscoverEvents();
}

let _discoverResults = [];
let _discoverSelected = new Set();

function bindDiscoverEvents() {
  UI.on('#discover-form', 'submit', async (e) => {
    e.preventDefault();
    await runDiscoverySearch();
  });

  UI.delegate('#view', '[data-dfilter]', 'click', (e, el) => {
    UI.$$('[data-dfilter]', UI.el('#disc-status-filters')).forEach(c => c.classList.remove('on'));
    el.classList.add('on');
    filterDiscoverResults(el.dataset.dfilter);
  });

  UI.on('#disc-select-all', 'change', (e) => {
    const checked = e.target.checked;
    _discoverSelected.clear();
    if (checked) {
      _discoverResults.forEach(r => {
        if (r.status !== 'added_to_leads') _discoverSelected.add(r.id);
      });
    }
    updateDiscoverSelection();
    renderDiscoverRows(_discoverResults);
  });

  UI.on('#disc-process-btn', 'click', processResults);
  UI.on('#disc-add-all-btn', 'click', bulkAddQualified);

  UI.delegate('#view', '[data-action="view-searches"]', 'click', loadSearchHistory);
  UI.delegate('#view', '[data-action="disc-enrich"]', 'click', async (e, el) => {
    await enrichProspect(el.dataset.resultId);
  });
  UI.delegate('#view', '[data-action="disc-add"]', 'click', async (e, el) => {
    await addProspectToLeads(el.dataset.resultId);
  });
  UI.delegate('#view', '[data-action="disc-select"]', 'click', (e, el) => {
    const id = el.dataset.resultId;
    if (_discoverSelected.has(id)) _discoverSelected.delete(id);
    else _discoverSelected.add(id);
    updateDiscoverSelection();
    renderDiscoverRows(_discoverResults);
  });
}

async function runDiscoverySearch() {
  const btn = document.getElementById('disc-search-btn');
  const country = document.getElementById('disc-country').value;
  const city = document.getElementById('disc-city').value.trim();
  const industry = document.getElementById('disc-industry').value;
  const businessType = document.getElementById('disc-type').value;

  if (!country || !businessType) {
    UI.toast('Please select country and business type.', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span> Searching...`;

  try {
    const result = await API.discover.search({ country, city, industry, businessType });

    UI.toast(`Found ${result.total} businesses. Processing...`);

    if (result.results && result.results.length > 0) {
      const allIds = result.results.map(r => r.id);
      const batchSize = 100;
      for (let i = 0; i < allIds.length; i += batchSize) {
        const batch = allIds.slice(i, i + batchSize);
        await API.prospects.process(batch);
      }
    }

    const prospects = await API.prospects.list({ searchId: result.searchId });
    _discoverResults = prospects;
    _discoverSelected.clear();

    document.getElementById('discover-results').style.display = '';
    document.getElementById('discover-searches').style.display = 'none';
    document.getElementById('disc-count').textContent = `${prospects.length} results`;
    renderDiscoverRows(prospects);

    UI.toast(`${prospects.length} businesses discovered and processed.`);
  } catch (err) {
    UI.toast(`Search failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${icon('search')} Search OpenStreetMap`;
  }
}

function renderDiscoverRows(results) {
  const tbody = document.getElementById('disc-tbody');
  if (!tbody) return;

  if (!results.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-3)">No results. Run a search above.</td></tr>`;
    return;
  }

  tbody.innerHTML = results.map(r => {
    const n = r.normalized || {};
    const isSelected = _discoverSelected.has(r.id);
    const statusCls = getStatusCls(r.status);
    const fitScore = r.fitScore;
    const hasEnrichment = r.status === 'enriched' || r.status === 'added_to_leads';

    return `<tr class="row-click">
      <td><input type="checkbox" data-action="disc-select" data-result-id="${r.id}" ${isSelected ? 'checked' : ''} ${r.status === 'added_to_leads' ? 'disabled' : ''}></td>
      <td>
        <div class="cell-main">${escapeHtml(n.name || r.companyName || 'Unknown')}</div>
        <div class="cell-sub">${escapeHtml(n.brand || '')}</div>
      </td>
      <td>${escapeHtml([n.city, n.country].filter(Boolean).join(', ') || '--')}</td>
      <td><span class="target-chip">${escapeHtml(n.category || n.industry || '--')}</span></td>
      <td>${n.website ? `<a href="${escapeHtml(n.website)}" target="_blank" style="color:var(--brand)">${escapeHtml(n.domain || n.website)}</a>` : '<span style="color:var(--text-3)">--</span>'}</td>
      <td><span class="target-chip">${icon('link', 'ic-14')} ${escapeHtml(n.source || 'osm')}</span></td>
      <td><span class="badge ${statusCls}"><span class="dot"></span>${formatStatus(r.status)}</span></td>
      <td>${fitScore ? ring(fitScore.totalScore, 'sm', fitScore.totalScore) : (r.prequalificationScore ? ring(r.prequalificationScore, 'sm') : '--')}</td>
      <td>
        <div class="td-actions">
          ${r.status === 'prequalified' || r.status === 'normalized' ? `<button class="ibtn" data-action="disc-enrich" data-result-id="${r.id}" title="Research with Tavily">${icon('zap', 'ic-14')}</button>` : ''}
          ${r.status !== 'added_to_leads' && r.status !== 'rejected' ? `<button class="ibtn" data-action="disc-add" data-result-id="${r.id}" title="Add to Leads">${icon('plus', 'ic-14')}</button>` : ''}
          ${r.status === 'added_to_leads' ? `<span class="badge st-cust"><span class="dot"></span>Added</span>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  updateDiscoverSelection();
}

function getStatusCls(status) {
  const map = {
    discovered: 'st-new',
    normalized: 'st-qual',
    deduplicated: 'st-cont',
    prequalified: 'st-res',
    rejected: 'st-dnc',
    enriched: 'st-int',
    added_to_leads: 'st-cust',
  };
  return map[status] || 'st-new';
}

function formatStatus(status) {
  const map = {
    discovered: 'Discovered',
    normalized: 'Normalized',
    deduplicated: 'Duplicate',
    prequalified: 'Qualified',
    rejected: 'Rejected',
    enriched: 'Enriched',
    added_to_leads: 'Added',
  };
  return map[status] || status;
}

function filterDiscoverResults(filter) {
  let filtered = _discoverResults;
  if (filter !== 'all') {
    if (filter === 'prequalified') {
      filtered = _discoverResults.filter(r => r.status === 'prequalified' || r.status === 'enriched');
    } else {
      filtered = _discoverResults.filter(r => r.status === filter);
    }
  }
  renderDiscoverRows(filtered);
}

function updateDiscoverSelection() {
  const count = _discoverSelected.size;
  const processBtn = document.getElementById('disc-process-btn');
  const addAllBtn = document.getElementById('disc-add-all-btn');

  if (processBtn) {
    const unprocessed = _discoverResults.filter(r => r.status === 'discovered' || r.status === 'normalized').length;
    processBtn.disabled = unprocessed === 0;
  }

  if (addAllBtn) {
    const qualified = _discoverResults.filter(r =>
      (r.status === 'prequalified' || r.status === 'enriched') && !_discoverSelected.has(r.id)
    ).length;
    addAllBtn.disabled = qualified === 0;
  }
}

async function processResults() {
  const btn = document.getElementById('disc-process-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span> Processing...`;

  try {
    const toProcess = _discoverResults.filter(r => r.status === 'discovered' || r.status === 'normalized').map(r => r.id);
    if (toProcess.length) {
      const batchSize = 100;
      for (let i = 0; i < toProcess.length; i += batchSize) {
        const batch = toProcess.slice(i, i + batchSize);
        await API.prospects.process(batch);
      }
      UI.toast(`Processed ${toProcess.length} results.`);
    }

    const searchId = _discoverResults[0]?.searchId || _discoverResults.find(r => r.searchId)?.searchId;
    if (searchId) {
      _discoverResults = await API.prospects.list({ searchId });
    }
    renderDiscoverRows(_discoverResults);
  } catch (err) {
    UI.toast(`Processing failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${icon('zap')} Process & Qualify`;
  }
}

async function enrichProspect(resultId) {
  UI.toast('Starting research...', 'info');
  try {
    await API.prospects.enrich(resultId);
    UI.toast('Research completed!', 'success');

    const searchId = _discoverResults[0]?.searchId || _discoverResults.find(r => r.searchId)?.searchId;
    if (searchId) {
      _discoverResults = await API.prospects.list({ searchId });
    }
    renderDiscoverRows(_discoverResults);
  } catch (err) {
    UI.toast(`Research failed: ${err.message}`, 'error');
  }
}

async function addProspectToLeads(resultId) {
  try {
    await API.prospects.addToLead(resultId);
    UI.toast('Added to leads!', 'success');

    const searchId = _discoverResults[0]?.searchId || _discoverResults.find(r => r.searchId)?.searchId;
    if (searchId) {
      _discoverResults = await API.prospects.list({ searchId });
    }
    renderDiscoverRows(_discoverResults);
    UI.buildSidebar();
  } catch (err) {
    UI.toast(`Failed: ${err.message}`, 'error');
  }
}

async function bulkAddQualified() {
  const qualified = _discoverResults.filter(r =>
    (r.status === 'prequalified' || r.status === 'enriched') && r.status !== 'added_to_leads'
  );

  if (!qualified.length) {
    UI.toast('No qualified prospects to add.', 'error');
    return;
  }

  try {
    const result = await API.prospects.bulkAdd(qualified.map(r => r.id));
    UI.toast(`${result.added} leads added!`, 'success');

    const searchId = _discoverResults[0]?.searchId || _discoverResults.find(r => r.searchId)?.searchId;
    if (searchId) {
      _discoverResults = await API.prospects.list({ searchId });
    }
    renderDiscoverRows(_discoverResults);
    UI.buildSidebar();
  } catch (err) {
    UI.toast(`Bulk add failed: ${err.message}`, 'error');
  }
}

async function loadSearchHistory() {
  document.getElementById('discover-results').style.display = 'none';
  document.getElementById('discover-searches').style.display = '';

  try {
    const searches = await API.discover.getSearches();
    const list = document.getElementById('disc-searches-list');

    if (!searches.length) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-3)">No search history yet.</div>';
      return;
    }

    list.innerHTML = searches.map(s => `
      <div class="att-item" style="cursor:pointer" data-search-id="${s.id}">
        <div class="row" style="gap:12px">
          <div class="act-ic i-blue">${icon('search')}</div>
          <div>
            <div class="att-name">${escapeHtml(s.businessType)} — ${escapeHtml(s.city || 'All cities')}, ${escapeHtml(s.country)}</div>
            <div class="att-loc">${s.resultCount} results · ${s.qualifiedCount || 0} qualified · ${s.addedCount || 0} added</div>
          </div>
        </div>
        <div class="att-side">
          <span class="muted small">${UI.formatDate(s.createdAt)}</span>
        </div>
      </div>
    `).join('');

    UI.delegate('#disc-searches-list', '[data-search-id]', 'click', async (e, el) => {
      const searchId = el.dataset.searchId;
      _discoverResults = await API.prospects.list({ searchId });
      _discoverSelected.clear();
      document.getElementById('discover-results').style.display = '';
      document.getElementById('discover-searches').style.display = 'none';
      document.getElementById('disc-count').textContent = `${_discoverResults.length} results`;
      renderDiscoverRows(_discoverResults);
    });
  } catch (err) {
    UI.toast(`Failed to load search history: ${err.message}`, 'error');
  }
}
