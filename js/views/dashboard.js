async function renderDashboard() {
  const gen = getRenderGeneration();
  let leads = [];
  let metrics = { totalLeads: 0, newLeads: 0, qualified: 0, avgScore: 0 };
  let activities = [];

  try {
    leads = await API.leads.list();
    if (gen !== getRenderGeneration()) return;
    Store._state.leads = leads;
    metrics = await API.leads.metrics();
  } catch (err) {
    leads = Store.get('leads') || [];
    metrics = Store.getMetrics();
  }

  try {
    activities = await API.activities.list({ limit: 8 });
    if (gen !== getRenderGeneration()) return;
    Store._state.activities = activities;
  } catch (err) {
    activities = Store.getActivities().slice(0, 8);
  }

  let campaigns = [];
  let replies = [];

  try {
    campaigns = await API.campaigns.list();
    if (gen !== getRenderGeneration()) return;
    Store._state.campaigns = campaigns;
  } catch (err) {
    campaigns = Store.getCampaigns();
  }

  try {
    replies = await API.emails.replies();
    if (gen !== getRenderGeneration()) return;
    Store._state.replies = replies;
  } catch (err) {
    replies = Store.getReplies();
  }

  let dealMetrics = { totalDeals: 0, wonValue: 0, pipelineValue: 0, conversionRate: '0.0' };
  try {
    dealMetrics = await API.deals.metrics();
    if (gen !== getRenderGeneration()) return;
  } catch (e) {}

  let taskStats = { total: 0, overdue: 0, pending: 0, completed: 0 };
  try {
    taskStats = await API.tasks.stats();
    if (gen !== getRenderGeneration()) return;
  } catch (e) {}

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
        <button class="btn btn-secondary" data-action="send-email">${icon('send')} Send Email</button>
        <button class="btn btn-primary" data-action="add-lead">${icon('plus')} Add Lead</button>
      </div>
    </div>

    <div class="metrics">
      ${metricCard('users', 'i-indigo', metrics.totalLeads, 'Total Leads')}
      ${metricCard('zap', 'i-blue', metrics.newLeads, 'New Leads')}
      ${metricCard('trendingUp', 'i-purple', metrics.qualified, 'Qualified')}
      ${metricCard('send', 'i-amber', totalSent, 'Emails Sent')}
      ${metricCard('messageSquare', 'i-teal', totalReplied, 'Replies')}
      ${metricCard('target', 'i-indigo', dealMetrics.totalDeals, 'Deals')}
      ${metricCard('dollarSign', 'i-green', '$' + (dealMetrics.wonValue >= 1000 ? (dealMetrics.wonValue / 1000).toFixed(0) + 'K' : dealMetrics.wonValue), 'Won')}
      ${metricCard('clock', 'i-amber', taskStats.pending, 'Tasks Due')}
    </div>

    <div class="dash-grid mt24">
      <div class="dash-col">
        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title">${icon('barChart', 'ic-16')} Pipeline Overview</div>
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
              <div class="card-title">${icon('users', 'ic-16')} Recent Leads</div>
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
                `).join('') : `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-3)"><div style="margin-bottom:8px">${icon('users')}</div>No leads yet. Use Discover to find businesses.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="dash-col">
        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title">${icon('activity', 'ic-16')} Activity Feed</div>
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
            `).join('') : '<div class="act-item" style="justify-content:center;color:var(--text-3);padding:32px">No activities yet</div>'}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title">${icon('award', 'ic-16')} Top Performers</div>
              <div class="card-sub">Leads with highest fit scores</div>
            </div>
          </div>
          <div class="card-body" style="padding:0">
            ${topPerformers.length ? topPerformers.map((l, i) => `
              <div class="att-item">
                <div class="row" style="gap:10px">
                  <span style="font-weight:800;color:${i === 0 ? 'var(--brand)' : 'var(--text-3)'};font-size:14px;width:20px">${i + 1}</span>
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
            `).join('') : '<div class="att-item" style="justify-content:center;color:var(--text-3);padding:32px">No leads yet</div>'}
          </div>
        </div>
      </div>
    </div>`;

  if (gen !== getRenderGeneration()) return;
  UI.renderView(html);
  bindDashboardEvents();
}

function getActivityIcon(type) {
  const map = {
    email_sent: 'send', email_opened: 'eye', email_replied: 'messageSquare',
    link_clicked: 'externalLink', status_changed: 'refreshCw', note_added: 'edit', call_made: 'phone',
    linkedin_connect: 'externalLink', company_discovered: 'search',
    research_completed: 'zap', added_to_leads: 'plus',
    manual_add: 'user', prequalification: 'checkCircle',
  };
  return map[type] || 'activity';
}

function getActivityIconCls(type) {
  const map = {
    email_sent: 'i-blue', email_opened: 'i-indigo', email_replied: 'i-green',
    link_clicked: 'i-amber', status_changed: 'i-amber', note_added: 'i-teal', call_made: 'i-purple',
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

  UI.delegate('#view', '[data-action="send-email"]', 'click', () => {
    showSendEmailModal();
  });
}

async function showSendEmailModal() {
  const accounts = await API.accounts.list();
  if (!accounts.length) {
    UI.toast('No email accounts connected. Add one in Settings.', 'error');
    return;
  }

  const activeAccounts = accounts.filter(a => a.status === 'active');
  if (!activeAccounts.length) {
    UI.toast('No active email accounts.', 'error');
    return;
  }

  const accountOptions = activeAccounts.map(a => `<option value="${a.id}">${escapeHtml(a.displayName || a.email)} <${escapeHtml(a.email)}></option>`).join('');

  const placeholders = ['{{firstName}}', '{{lastName}}', '{{company}}', '{{title}}'];

  const html = `
    <div class="modal-overlay" id="send-email-modal">
      <div class="modal em-modal">
        <div class="modal-head em-head">
          <div class="em-head-title">
            <div class="em-head-icon">${icon('send')}</div>
            <div>
              <h3>Send Email</h3>
              <p>Compose and send an email right now</p>
            </div>
          </div>
          <button class="ibtn" data-close aria-label="Close">${icon('x')}</button>
        </div>
        <form id="send-email-form" class="modal-body em-form">
          <div class="form-group">
            <label>${icon('atSign', 'ic-14')} From Account</label>
            <div class="em-select-wrap">
              <select name="accountId" required>${accountOptions}</select>
              ${icon('chevronDown', 'ic-14 em-select-caret')}
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>${icon('mail', 'ic-14')} To</label>
              <input type="email" name="to" placeholder="recipient@example.com" required />
            </div>
          </div>

          <div class="form-group">
            <label>${icon('type', 'ic-14')} Subject</label>
            <input type="text" name="subject" placeholder="Email subject" required />
          </div>

          <div class="form-group">
            <label>${icon('fileText', 'ic-14')} Message <span class="em-lbl-opt">HTML supported</span></label>
            <textarea name="html" class="em-msg" rows="7" placeholder="<p>Hello {{firstName}},</p>&#10;&#10;<p>This supports HTML and placeholders.</p>"></textarea>
          </div>

          <div class="em-chips">
            ${placeholders.map(p => `<button type="button" class="em-chip" data-ph="${p}">${p}</button>`).join('')}
            <span class="em-chip-hint">Click to insert</span>
          </div>

          <div class="form-group">
            <label>${icon('alignLeft', 'ic-14')} Plain Text <span class="em-lbl-opt">optional</span></label>
            <textarea name="text" rows="4" placeholder="Plain text version for clients that don't support HTML"></textarea>
          </div>
        </form>
        <div class="modal-foot em-foot">
          <button type="button" class="btn btn-ghost" data-close>Cancel</button>
          <button type="submit" form="send-email-form" class="btn btn-primary">${icon('send')} Send Email</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
  const modal = document.getElementById('send-email-modal');
  requestAnimationFrame(() => modal.classList.add('open'));
  modal.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => modal.remove()));
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  const msgArea = modal.querySelector('textarea[name="html"]');
  modal.querySelectorAll('.em-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      msgArea.value += chip.dataset.ph;
      msgArea.focus();
    });
  });

  modal.querySelector('#send-email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = modal.querySelector('button[form="send-email-form"]');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `${icon('refreshCw', 'ic-14 spin')} Sending...`;

    const data = {
      accountId: form.accountId.value,
      to: form.to.value,
      subject: form.subject.value,
      html: form.html.value || undefined,
      text: form.text.value || undefined,
    };

    try {
      await API.emails.send(data);
      UI.toast('Email sent successfully!');
      modal.remove();
    } catch (err) {
      UI.toast('Failed to send: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });
}
