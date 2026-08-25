async function renderDashboard() {
  let leads = [];
  let metrics = { totalLeads: 0, newLeads: 0, qualified: 0, avgScore: 0 };
  let activities = [];

  try {
    leads = await API.leads.list();
    Store._state.leads = leads;
    metrics = await API.leads.metrics();
  } catch (err) {
    leads = Store.get('leads') || [];
    metrics = Store.getMetrics();
  }

  try {
    activities = await API.activities.list({ limit: 8 });
    Store._state.activities = activities;
  } catch (err) {
    activities = Store.getActivities().slice(0, 8);
  }

  const campaigns = Store.getCampaigns();
  const replies = Store.getReplies();
  const recentLeads = leads.slice(0, 5);
  const topPerformers = [...leads].sort((a, b) => (b.fitScore || b.score || 0) - (a.fitScore || a.score || 0)).slice(0, 5);

  const pipeline = {};
  PIPELINE.forEach(s => { pipeline[s] = 0; });
  leads.forEach(l => { if (pipeline[l.status] !== undefined) pipeline[l.status]++; });
  const maxPipeline = Math.max(...Object.values(pipeline), 1);

  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalReplied = replies.length;

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">Welcome back, Prashant. Here's your lead engine overview.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="export">${icon('download')} Export</button>
        <button class="btn btn-primary" data-action="add-lead">${icon('plus')} Add Lead</button>
      </div>
    </div>

    <div class="metrics">
      ${metricCard('users', 'i-indigo', metrics.totalLeads, 'Total Leads')}
      ${metricCard('zap', 'i-blue', metrics.newLeads, 'New Leads')}
      ${metricCard('trendingUp', 'i-purple', metrics.qualified, 'Qualified')}
      ${metricCard('send', 'i-amber', totalSent, 'Emails Sent')}
      ${metricCard('messageSquare', 'i-teal', totalReplied, 'Replies')}
      ${metricCard('target', 'i-green', metrics.avgScore, 'Avg Score')}
    </div>

    <div class="dash-grid mt24">
      <div class="dash-col">
        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Pipeline Overview</div>
              <div class="card-sub">Leads across pipeline stages</div>
            </div>
            <button class="btn btn-sm btn-ghost" data-nav="leads">${icon('arrowRight')} View All</button>
          </div>
          <div class="funnel">
            ${PIPELINE.map(stage => `
              <div class="fn-row">
                <div class="fn-label">${STATUSES[stage]}</div>
                <div class="fn-track">
                  <div class="fn-bar" style="width:${Math.max((pipeline[stage] / maxPipeline) * 100, 3)}%"></div>
                </div>
                <div class="fn-val">${pipeline[stage]}</div>
                <div class="fn-conv">${metrics.totalLeads ? Math.round((pipeline[stage] / metrics.totalLeads) * 100) : 0}%</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Recent Leads</div>
              <div class="card-sub">Latest leads added to the engine</div>
            </div>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${recentLeads.length ? recentLeads.map(l => `
                  <tr class="row-click" data-lead="${l.id}">
                    <td>
                      <div class="row">
                        ${avatar(l.name, 'sm')}
                        <div>
                          <div class="cell-main">${escapeHtml(l.name)}</div>
                          <div class="cell-sub">${escapeHtml(l.title || '')}</div>
                        </div>
                      </div>
                    </td>
                    <td>${escapeHtml(l.company || '')}</td>
                    <td>${statusBadge(l.status)}</td>
                    <td>${ring(l.fitScore || l.score || 0, 'sm')}</td>
                    <td><button class="ibtn" data-lead-view="${l.id}">${icon('eye', 'ic-14')}</button></td>
                  </tr>
                `).join('') : `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-3)">No leads yet. Use Discover to find businesses.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="dash-col">
        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Activity Feed</div>
              <div class="card-sub">Recent actions across the platform</div>
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

        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Top Performers</div>
              <div class="card-sub">Leads with highest fit scores</div>
            </div>
          </div>
          <div class="card-body" style="padding:0">
            ${topPerformers.length ? topPerformers.map((l, i) => `
              <div class="att-item">
                <div class="row" style="gap:8px">
                  <span style="font-weight:800;color:var(--text-3);font-size:13px;width:18px">${i + 1}</span>
                  ${avatar(l.name, 'sm')}
                  <div>
                    <div class="att-name">${escapeHtml(l.name)}</div>
                    <div class="att-loc">${icon('globe', 'ic-14')} ${escapeHtml(l.company || '')}</div>
                  </div>
                </div>
                <div class="att-side">
                  ${ring(l.fitScore || l.score || 0, 'sm')}
                </div>
              </div>
            `).join('') : '<div class="att-item" style="justify-content:center;color:var(--text-3)">No leads yet</div>'}
          </div>
        </div>
      </div>
    </div>`;

  UI.renderView(html);
  bindDashboardEvents();
}

function getActivityIcon(type) {
  const map = {
    email_sent: 'send', email_opened: 'eye', email_replied: 'messageSquare',
    status_changed: 'refreshCw', note_added: 'edit', call_made: 'phone',
    linkedin_connect: 'externalLink', company_discovered: 'search',
    research_completed: 'zap', added_to_leads: 'plus',
    manual_add: 'user', prequalification: 'checkCircle',
  };
  return map[type] || 'activity';
}

function getActivityIconCls(type) {
  const map = {
    email_sent: 'i-blue', email_opened: 'i-indigo', email_replied: 'i-green',
    status_changed: 'i-amber', note_added: 'i-teal', call_made: 'i-purple',
    linkedin_connect: 'i-slate', company_discovered: 'i-blue',
    research_completed: 'i-amber', added_to_leads: 'i-green',
    manual_add: 'i-indigo', prequalification: 'i-teal',
  };
  return map[type] || 'i-slate';
}

function bindDashboardEvents() {
  UI.delegate('#view', '[data-nav]', 'click', (e, el) => {
    e.preventDefault();
    Store.navigate(el.dataset.nav);
  });

  UI.delegate('#view', '[data-lead]', 'click', (e, el) => {
    Store.navigate('leads', { selectedLeadId: el.dataset.lead });
  });

  UI.delegate('#view', '[data-lead-view]', 'click', (e, el) => {
    e.stopPropagation();
    Store.navigate('leads', { selectedLeadId: el.dataset.leadView });
  });

  UI.delegate('#view', '[data-action="add-lead"]', 'click', () => {
    showAddLeadModal();
  });

  UI.delegate('#view', '[data-action="export"]', 'click', () => {
    UI.toast('Export started — download will begin shortly.');
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
      renderDashboard();
      UI.buildSidebar();
    } catch (err) {
      UI.toast('Failed to add lead: ' + err.message, 'error');
    }
  });
}
