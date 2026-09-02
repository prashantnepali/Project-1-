let _campaigns = [];
let _campaignMetrics = {};

async function renderCampaigns() {
  const gen = getRenderGeneration();
  const view = UI.el('#view');
  if (!view) return;
  view.innerHTML = '<div class="loading">Loading campaigns...</div>';

  try {
    [_campaigns, _campaignMetrics] = await Promise.all([
      API.campaigns.list(),
      API.campaigns.metrics()
    ]);
  } catch (e) {
    _campaigns = [];
    _campaignMetrics = { total: 0, active: 0, paused: 0, draft: 0, totalSent: 0, totalOpened: 0, totalReplied: 0, replyRate: 0 };
  }

  const active = _campaignMetrics.active || 0;
  const paused = _campaignMetrics.paused || 0;
  const draft = _campaignMetrics.draft || 0;

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Campaigns</h1>
        <p class="page-sub">${_campaigns.length} campaigns in your account</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="export-campaigns">${icon('download')} Export</button>
        <button class="btn btn-primary" data-action="new-campaign">${icon('plus')} New Campaign</button>
      </div>
    </div>

    <div class="metrics">
      ${metricCard('send', 'i-blue', _campaignMetrics.totalSent || 0, 'Total Sent')}
      ${metricCard('eye', 'i-indigo', _campaignMetrics.totalOpened || 0, 'Opened')}
      ${metricCard('messageSquare', 'i-green', _campaignMetrics.totalReplied || 0, 'Replied')}
      ${metricCard('play', 'i-teal', active, 'Active')}
      ${metricCard('pause', 'i-amber', paused, 'Paused')}
      ${metricCard('edit', 'i-slate', draft, 'Drafts')}
    </div>

    <div class="card mt24">
      <div class="toolbar">
        <div class="chips" id="campaign-filters">
          <button class="chip on" data-cfilter="all">All (${_campaigns.length})</button>
          <button class="chip" data-cfilter="active">Active (${active})</button>
          <button class="chip" data-cfilter="paused">Paused (${paused})</button>
          <button class="chip" data-cfilter="draft">Draft (${draft})</button>
        </div>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Subject</th>
              <th>Sent</th>
              <th>Opened</th>
              <th>Replied</th>
              <th>Open Rate</th>
              <th>Reply Rate</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="campaigns-tbody">
            ${campaignRows(_campaigns)}
          </tbody>
        </table>
      </div>
    </div>`;

  if (gen !== getRenderGeneration()) return;
  UI.renderView(html);
  bindCampaignEvents();
}

function campaignRows(campaigns) {
  if (!campaigns.length) {
    return `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-3)">No campaigns yet. Create your first campaign.</td></tr>`;
  }

  return campaigns.map(c => {
    const openRate = c.sent ? Math.round(((c.opened || 0) / c.sent) * 100) : 0;
    const replyRate = c.sent ? Math.round(((c.replied || 0) / c.sent) * 100) : 0;

    return `
    <tr class="row-click" data-campaign="${c.id}">
      <td>
        <div class="cell-main">${escapeHtml(c.name)}</div>
        <div class="cell-sub">${UI.formatDate(c.createdAt)}</div>
      </td>
      <td>${campaignBadge(c.status)}</td>
      <td>${escapeHtml(c.subject || '')}</td>
      <td>${UI.formatNumber(c.sent)}</td>
      <td>${UI.formatNumber(c.opened)}</td>
      <td>${UI.formatNumber(c.replied)}</td>
      <td>${ring(openRate, 'sm')}</td>
      <td>${ring(replyRate, 'sm')}</td>
      <td>
        <div class="td-actions">
          ${c.status === 'draft' ? `<button class="ibtn" data-campaign-send="${c.id}" title="Send">${icon('play', 'ic-14')}</button>` : ''}
          ${c.status === 'active' ? `<button class="ibtn" data-campaign-pause="${c.id}" title="Pause">${icon('pause', 'ic-14')}</button>` : ''}
          ${c.status === 'paused' ? `<button class="ibtn" data-campaign-play="${c.id}" title="Resume">${icon('play', 'ic-14')}</button>` : ''}
          <button class="ibtn" data-campaign-edit="${c.id}" title="Edit">${icon('edit', 'ic-14')}</button>
          <button class="ibtn ibtn-r" data-campaign-del="${c.id}" title="Delete">${icon('trash', 'ic-14')}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function bindCampaignEvents() {
  UI.delegate('#view', '[data-cfilter]', 'click', (e, el) => {
    UI.$$('[data-cfilter]', UI.el('#campaign-filters')).forEach(c => c.classList.remove('on'));
    el.classList.add('on');
    const f = el.dataset.cfilter;
    const filtered = f === 'all' ? _campaigns : _campaigns.filter(c => c.status === f);
    UI.html('#campaigns-tbody', campaignRows(filtered));
  });

  UI.delegate('#view', '[data-campaign]', 'click', async (e, el) => {
    if (e.target.closest('[data-campaign-send]') || e.target.closest('[data-campaign-pause]') || e.target.closest('[data-campaign-play]') || e.target.closest('[data-campaign-del]')) return;
    try {
      const c = await API.campaigns.get(el.dataset.campaign);
      showCampaignDetail(c);
    } catch (err) {
      UI.toast('Failed to load campaign details');
    }
  });

  UI.delegate('#view', '[data-campaign-send]', 'click', async (e, el) => {
    e.stopPropagation();
    if (!confirm('Send this campaign to all assigned leads?')) return;
    try {
      UI.toast('Sending campaign...');
      const result = await API.campaigns.send(el.dataset.campaignSend);
      UI.toast(`Sent ${result.sent} emails, ${result.failed} failed.`);
      renderCampaigns();
    } catch (err) {
      UI.toast('Send failed: ' + err.message);
    }
  });

  UI.delegate('#view', '[data-campaign-pause]', 'click', async (e, el) => {
    e.stopPropagation();
    try {
      await API.campaigns.update(el.dataset.campaignPause, { status: 'paused' });
      UI.toast('Campaign paused.');
      renderCampaigns();
    } catch (err) {
      UI.toast('Failed to pause campaign');
    }
  });

  UI.delegate('#view', '[data-campaign-play]', 'click', async (e, el) => {
    e.stopPropagation();
    try {
      await API.campaigns.update(el.dataset.campaignPlay, { status: 'active' });
      UI.toast('Campaign resumed.');
      renderCampaigns();
    } catch (err) {
      UI.toast('Failed to resume campaign');
    }
  });

  UI.delegate('#view', '[data-campaign-del]', 'click', async (e, el) => {
    e.stopPropagation();
    if (!confirm('Delete this campaign?')) return;
    try {
      await API.campaigns.delete(el.dataset.campaignDel);
      UI.toast('Campaign deleted.');
      renderCampaigns();
    } catch (err) {
      UI.toast('Failed to delete campaign');
    }
  });

  UI.delegate('#view', '[data-action="new-campaign"]', 'click', () => {
    showNewCampaignModal();
  });

  UI.delegate('#view', '[data-action="export-campaigns"]', 'click', async () => {
    try {
      await API.export.campaigns();
      UI.toast('Campaigns exported.');
    } catch (err) {
      UI.toast('Export failed: ' + err.message, 'error');
    }
  });

  UI.delegate('#view', '[data-campaign-edit]', 'click', async (e, el) => {
    e.stopPropagation();
    try {
      const c = await API.campaigns.get(el.dataset.campaignEdit);
      showEditCampaignModal(c);
    } catch (err) {
      UI.toast('Failed to load campaign: ' + err.message);
    }
  });
}

async function showCampaignDetail(c) {
  const openRate = c.sent ? Math.round(((c.opened || 0) / c.sent) * 100) : 0;
  const clickRate = c.sent ? Math.round(((c.clicked || 0) / c.sent) * 100) : 0;
  const replyRate = c.sent ? Math.round(((c.replied || 0) / c.sent) * 100) : 0;
  const replyCount = c.replyCount || 0;

  let campaignLeads = [];
  try {
    campaignLeads = await API.campaigns.getLeads(c.id);
  } catch (e) {}

  const leadsHtml = campaignLeads.length ? `
    <div class="mt24">
      <div class="spread" style="margin-bottom:12px">
        <h4>Assigned Leads (${campaignLeads.length})</h4>
        <button class="btn btn-sm btn-secondary" data-campaign-add-leads="${c.id}">${icon('plus')} Add Leads</button>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Email</th>
              <th>Company</th>
              <th>Status</th>
              <th>Sent At</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${campaignLeads.map(cl => `
              <tr>
                <td>${escapeHtml(cl.name)}</td>
                <td>${escapeHtml(cl.email || '')}</td>
                <td>${escapeHtml(cl.company || '')}</td>
                <td>${campaignLeadBadge(cl.status)}</td>
                <td>${cl.sentAt ? UI.formatDate(cl.sentAt) : '—'}</td>
                <td>
                  <div class="td-actions">
                    <button class="ibtn" data-campaign-preview="${c.id}" data-lead-id="${cl.leadId}" title="Preview" style="color:var(--brand)">${icon('eye')}</button>
                    <button class="ibtn ibtn-r" data-campaign-remove-lead="${c.id}" data-lead-id="${cl.leadId}" title="Remove">${icon('trash', 'ic-14')}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  ` : `
    <div class="mt24">
      <div class="spread" style="margin-bottom:12px">
        <h4>Assigned Leads (0)</h4>
        <button class="btn btn-sm btn-secondary" data-campaign-add-leads="${c.id}">${icon('plus')} Add Leads</button>
      </div>
      <p style="color:var(--text-3);font-size:13px">No leads assigned yet. Click "Add Leads" to assign leads to this campaign.</p>
    </div>
  `;

  const body = `
    <div class="spread" style="margin-bottom:20px">
      <div>${campaignBadge(c.status)}</div>
      <div class="muted small">Created ${UI.formatDate(c.createdAt)}</div>
    </div>
    <div class="spread" style="margin-bottom:16px">
      <div class="muted small">${icon('send', 'ic-14')} Campaign: ${escapeHtml(c.name)}</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm btn-secondary" data-campaign-detail-edit="${c.id}">${icon('edit')} Edit</button>
        <button class="btn btn-sm btn-primary" data-campaign-detail-send="${c.id}">${icon('send')} Send / Process</button>
      </div>
    </div>
    <div class="metrics" style="grid-template-columns:repeat(4,1fr)">
      ${metricCard('send', 'i-blue', c.sent, 'Sent')}
      ${c.openTrackingOn === false
        ? `<div class="metric"><div class="metric-ic i-indigo">${icon('eye')}</div><div class="metric-num">Open tracking<br>disabled</div></div>`
        : metricCard('eye', 'i-indigo', c.opened, 'Opened')}
      ${metricCard('messageSquare', 'i-green', replyCount, 'Replied')}
      ${metricCard('alertCircle', 'i-red', c.bounced, 'Bounced')}
    </div>
    <div class="mt24">
      <h4 style="margin-bottom:12px">Funnel</h4>
      <div class="funnel">
        <div class="fn-row"><div class="fn-label">Sent</div><div class="fn-track"><div class="fn-bar" style="width:100%"></div></div><div class="fn-val">${c.sent}</div></div>
        <div class="fn-row"><div class="fn-label">Delivered</div><div class="fn-track"><div class="fn-bar" style="width:${c.sent ? (c.delivered/c.sent)*100 : 0}%"></div></div><div class="fn-val">${c.delivered}</div></div>
        ${c.openTrackingOn === false
          ? `<div class="fn-row"><div class="fn-label">Opened</div><div class="fn-track"><div class="fn-bar" style="width:0%"></div></div><div class="fn-val">tracking off</div></div>`
          : `<div class="fn-row"><div class="fn-label">Opened</div><div class="fn-track"><div class="fn-bar" style="width:${openRate}%"></div></div><div class="fn-val">${c.opened}</div><div class="fn-conv">${openRate}%</div></div>`}
        ${c.clickTrackingOn === false
          ? `<div class="fn-row"><div class="fn-label">Clicked</div><div class="fn-track"><div class="fn-bar" style="width:0%"></div></div><div class="fn-val">tracking off</div></div>`
          : `<div class="fn-row"><div class="fn-label">Clicked</div><div class="fn-track"><div class="fn-bar" style="width:${clickRate}%"></div></div><div class="fn-val">${c.clicked}</div><div class="fn-conv">${clickRate}%</div></div>`}
        <div class="fn-row"><div class="fn-label">Replied</div><div class="fn-track"><div class="fn-bar" style="width:${replyRate}%"></div></div><div class="fn-val">${replyCount}</div><div class="fn-conv">${replyRate}%</div></div>
      </div>
    </div>
    <div class="mt24" id="campaign-deliverability-summary">${renderDeliverabilitySummary(c)}</div>
    <div class="mt24" id="campaign-queue-status"></div>
    <div class="mt24">
      <h4 style="margin-bottom:8px">Subject Line</h4>
      <p style="font-size:13px;color:var(--text-2)">${escapeHtml(c.subject)}</p>
    </div>
    ${c.body ? `<div class="mt16"><h4 style="margin-bottom:8px">Template Body</h4><div style="font-size:13px;color:var(--text-2);background:var(--bg-2);padding:12px;border-radius:8px;max-height:200px;overflow:auto;white-space:pre-wrap">${escapeHtml(c.body)}</div></div>` : ''}
    <div class="mt16">
      <h4 style="margin-bottom:8px">Target</h4>
      <p style="font-size:13px;color:var(--text-2)">Account: ${escapeHtml(c.accountId || 'None')}</p>
    </div>
    ${leadsHtml}`;

  UI.modal(escapeHtml(c.name), body, { wide: true });

  UI.delegate('.modal-overlay', `[data-campaign-add-leads="${c.id}"]`, 'click', () => showAddLeadsModal(c.id));
  UI.delegate('.modal-overlay', `[data-campaign-remove-lead="${c.id}"]`, 'click', async (e, el) => {
    if (!confirm('Remove this lead from the campaign?')) return;
    try {
      await API.campaigns.removeLead(c.id, el.dataset.leadId);
      UI.toast('Lead removed from campaign.');
      document.querySelector('.modal-overlay')?.remove();
      const updated = await API.campaigns.get(c.id);
      showCampaignDetail(updated);
    } catch (err) {
      UI.toast('Failed to remove lead: ' + err.message);
    }
  });
}

function campaignLeadBadge(status) {
  const colors = { pending: 'st-new', sent: 'st-sent', replied: 'st-res', failed: 'st-dnc', skipped: 'st-arch', bounced: 'st-dnc', blocked: 'st-dnc' };
  return `<span class="badge ${colors[status] || 'st-new'}">${status}</span>`;
}

function renderDeliverabilitySummary(c) {
  const tr = c.tracking || {};
  const dv = c.deliverability || {};
  const row = (label, val, on) =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span class="muted small">${label}</span><span class="small" style="font-weight:500">${val} <span style="color:${on ? 'var(--green, #22c55e)' : 'var(--text-3)'}">${on ? 'ON' : 'OFF'}</span></span></div>`;
  return `
    <h4 style="margin-bottom:12px">${icon('shield', 'ic-14')} Deliverability</h4>
    <div style="background:var(--bg-2);border-radius:8px;padding:8px 14px;font-size:12.5px">
      ${row('Open Tracking', '1px pixel', tr.openTracking !== false)}
      ${row('Click Tracking', 'link redirect', tr.clickTracking !== false)}
      ${row('Conservative Mode', 'sequential + delay', dv.conservativeMode !== false)}
      ${row('Stop on Reply', '', dv.stopOnReply !== false)}
      ${row('Stop on Bounce', '', dv.stopOnBounce !== false)}
      ${row('Stop on Unsubscribe', '', dv.stopOnUnsubscribe !== false)}
      ${row('Daily Send Limit', `${dv.dailySendLimit != null ? dv.dailySendLimit : 40} / day`, true)}
      ${row('Delay range', `${dv.delayMinSec != null ? dv.delayMinSec : 90}–${dv.delayMaxSec != null ? dv.delayMaxSec : 180}s`, dv.conservativeMode !== false)}
      ${row('Optional Footer', dv.footerText ? 'enabled' : 'none', !!dv.footerText)}
    </div>`;
}

async function loadCampaignQueueStatus(campaignId) {
  const el = document.getElementById('campaign-queue-status');
  if (!el) return;
  try {
    const q = await API.campaigns.queue(campaignId);
    const s = q.stats || {};
    const cap = (q.deliverability && q.deliverability.dailySendLimit) || 40;
    const parts = [`Queued ${s.queued || 0}`, `Sent ${s.sent || 0}`, `Failed ${s.failed || 0}`, `Skipped ${s.skipped || 0}`, `Blocked ${s.blocked || 0}`];
    el.innerHTML = `
      <h4 style="margin-bottom:8px">Queue Status <span class="muted small">(daily cap ${cap}/day)</span></h4>
      <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;background:var(--bg-2);padding:10px 14px;border-radius:8px">
        ${parts.map(p => `<span>${p}</span>`).join('')}
      </div>
      ${s.queued ? `<div class="muted small" style="margin-top:8px">${s.queued} message(s) still queued. Click "Send / Process" to continue (respects the daily cap and delay).</div>` : ''}`;
  } catch (e) {
    el.innerHTML = '';
  }
}

async function showCampaignPreview(campaignId, leadId) {
  try {
    const prev = await API.campaigns.preview(campaignId, { id: leadId });
    const card = (label, val) => `<div class="form-group"><label>${label}</label><div style="font-size:12.5px;background:var(--bg-2);padding:8px 12px;border-radius:6px;white-space:pre-wrap;word-break:break-word">${escapeHtml(val ?? '—')}</div></div>`;
    const unresolved = (prev.unresolved || []).length
      ? `<div class="form-group"><label>Unresolved template variables</label><div style="color:var(--danger,#ef4444);font-size:12.5px">${prev.unresolved.map(u => escapeHtml(u)).join(', ') || 'none'}</div></div>`
      : '';
    const tracking = `<div class="form-group"><label>Tracking</label><div style="font-size:12.5px">Open: ${prev.tracking && prev.tracking.openTracking ? 'ON' : 'OFF'} &nbsp; Click: ${prev.tracking && prev.tracking.clickTracking ? 'ON' : 'OFF'}</div></div>`;
    const html = `
      ${card('From', prev.from)}
      ${card('To', prev.to)}
      ${card('Subject', prev.subject)}
      ${card('Body', prev.body)}
      ${tracking}
      ${unresolved}
    `;
    UI.modal('Personalization Preview', html, { wide: true });
  } catch (err) {
    UI.toast('Preview failed: ' + err.message);
  }
}

async function showAddLeadsModal(campaignId) {
  let allLeads = [];
  try {
    allLeads = await API.leads.list({ status: 'new' });
  } catch (e) {}

  const campaignLeads = await API.campaigns.getLeads(campaignId);
  const assignedIds = new Set(campaignLeads.map(cl => cl.leadId));
  const availableLeads = allLeads.filter(l => !assignedIds.has(l.id));

  const body = `
    <div class="form-group">
      <label class="form-label">Select Leads to Add</label>
      <div style="max-height:300px;overflow:auto">
        ${availableLeads.length ? availableLeads.map(l => `
          <label style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer">
            <input type="checkbox" value="${l.id}" name="lead-select">
            <div>
              <div class="cell-main">${escapeHtml(l.name)}</div>
              <div class="cell-sub">${escapeHtml(l.email || '')} • ${escapeHtml(l.company || '')}</div>
            </div>
          </label>
        `).join('') : '<p style="color:var(--text-3)">No available leads to add</p>'}
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-primary" id="add-selected-leads">Add Selected</button>
      <button class="btn" id="cancel-add-leads">Cancel</button>
    </div>`;

  UI.modal('Add Leads to Campaign', body, { wide: true });

  document.getElementById('add-selected-leads')?.addEventListener('click', async () => {
    const selected = Array.from(document.querySelectorAll('input[name="lead-select"]:checked')).map(cb => cb.value);
    if (!selected.length) return UI.toast('No leads selected');
    try {
      await API.campaigns.assignLeads(campaignId, selected);
      UI.toast(`Added ${selected.length} leads to campaign.`);
      document.querySelector('.modal-overlay')?.remove();
      const c = await API.campaigns.get(campaignId);
      showCampaignDetail(c);
    } catch (err) {
      UI.toast('Failed to add leads: ' + err.message);
    }
  });
  document.getElementById('cancel-add-leads')?.addEventListener('click', () => {
    document.querySelector('.modal-overlay')?.remove();
  });
}

const CAMPAIGN_STEPS = ['Details', 'Audience', 'Sender', 'Email', 'Deliverability'];
const CAMPAIGN_PLACEHOLDERS = ['{{firstName}}', '{{lastName}}', '{{company}}', '{{industry}}', '{{title}}', '{{first_name}}', '{{company_name}}', '{{sender_name}}', '{{phone_number}}'];

async function showNewCampaignModal() {
  let accounts = [];
  let allLeads = [];
  try {
    accounts = await API.accounts.list();
  } catch (e) {}
  try {
    allLeads = await API.leads.list();
  } catch (e) {}

  if (!accounts.length) {
    UI.toast('Connect an email account in Settings first.', 'error');
    return;
  }
  if (!allLeads.length) {
    UI.toast('Add leads first before creating a campaign.', 'error');
    return;
  }

  const state = {
    step: 1,
    leads: allLeads,
    selected: new Set(),
    query: '',
    name: '',
    subject: '',
    body: '',
    accountId: '',
    tracking: { openTracking: false, clickTracking: false },
    deliverability: { conservativeMode: true, stopOnReply: true, stopOnBounce: true, stopOnUnsubscribe: true, dailySendLimit: 40, delayMinSec: 90, delayMaxSec: 180, footerText: '' },
  };

  const placeholders = CAMPAIGN_PLACEHOLDERS;

  const html = `
    <div class="modal-overlay" id="nc-modal">
      <div class="modal em-modal">
        <div class="modal-head em-head">
          <div class="em-head-title">
            <div class="em-head-icon">${icon('send')}</div>
            <div>
              <h3>New Campaign</h3>
              <p>Create an outreach campaign in 4 steps</p>
            </div>
          </div>
          <button class="ibtn" data-wc-close aria-label="Close">${icon('x')}</button>
        </div>
        <div class="wc-steps" id="wc-steps">
          ${CAMPAIGN_STEPS.map((s, i) => `
            <button class="wc-step ${i === 0 ? 'on' : ''}" data-wc-stepgo="${i + 1}">
              <span class="wc-step-num">${i + 1}</span>
              <span class="wc-step-lbl">${s}</span>
            </button>`).join('')}
        </div>
        <div class="wc-body" id="wc-body"></div>
        <div class="modal-foot wc-foot" id="wc-foot"></div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
  const modal = document.getElementById('nc-modal');
  requestAnimationFrame(() => modal.classList.add('open'));

  function close() { modal.remove(); }

  modal.querySelectorAll('[data-wc-close]').forEach(btn => btn.addEventListener('click', close));
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  function getVal(name) {
    const el = modal.querySelector(`[name="${name}"]`);
    return el ? el.value.trim() : '';
  }

  function capture() {
    if (state.step === 1) state.name = getVal('name');
    if (state.step === 3) state.accountId = getVal('accountId');
    if (state.step === 4) {
      state.subject = getVal('subject');
      state.body = modal.querySelector('textarea[name="body"]')?.value?.trim() || '';
    }
    if (state.step === 5) {
      const cb = (n) => modal.querySelector(`input[name="${n}"]`)?.checked === true;
      state.tracking = { openTracking: cb('openTracking'), clickTracking: cb('clickTracking') };
      state.deliverability = {
        conservativeMode: cb('conservativeMode'),
        stopOnReply: cb('stopOnReply'),
        stopOnBounce: cb('stopOnBounce'),
        stopOnUnsubscribe: cb('stopOnUnsubscribe'),
        dailySendLimit: parseInt(getVal('dailySendLimit'), 10) || 40,
        delayMinSec: parseInt(getVal('delayMinSec'), 10) || 90,
        delayMaxSec: parseInt(getVal('delayMaxSec'), 10) || 180,
        footerText: getVal('footerText'),
      };
    }
  }

  function updateSteps() {
    modal.querySelectorAll('.wc-step').forEach((el, i) => {
      el.classList.toggle('on', i === state.step - 1);
      el.classList.toggle('done', i < state.step - 1);
    });
  }

  async function renderStep() {
    updateSteps();
    const body = modal.querySelector('#wc-body');
    const foot = modal.querySelector('#wc-foot');

    if (state.step === 1) {
      body.innerHTML = `
        <div class="form-group">
          <label>${icon('tag', 'ic-14')} Campaign Name</label>
          <input name="name" placeholder="e.g. Q1 Outreach Campaign" value="${escapeHtml(state.name)}" />
        </div>
        <div class="wc-hint">
          ${icon('info', 'ic-14')} This is the internal name shown in your campaign list. Keep it short and clear.
        </div>`;
      foot.innerHTML = `
        <button class="btn btn-ghost" data-wc-close>Cancel</button>
        <button class="btn btn-primary" data-wc-next>${icon('arrowRight')} Choose Audience</button>`;
    }

    if (state.step === 2) {
      const q = state.query.toLowerCase();
      const visible = state.leads.filter(l =>
        (l.name || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.company || '').toLowerCase().includes(q)
      );
      const allVisibleSelected = visible.length > 0 && visible.every(l => state.selected.has(l.id));

      body.innerHTML = `
        <div class="form-group">
          <label>${icon('users', 'ic-14')} Select Audience
            <span class="em-lbl-opt">${state.selected.size} selected</span>
          </label>
          <div class="wc-search">
            <input type="text" id="wc-aud-search" placeholder="Search by name, email, company...">
            <label class="wc-select-all">
              <input type="checkbox" id="wc-aud-selectall" ${allVisibleSelected ? 'checked' : ''}>
              Select all (${visible.length})
            </label>
          </div>
        </div>
        <div class="wc-aud-list" id="wc-aud-list">
          ${visible.length ? visible.map(l => `
            <label class="wc-aud-item ${state.selected.has(l.id) ? 'on' : ''}">
              <input type="checkbox" value="${l.id}" name="aud-lead" ${state.selected.has(l.id) ? 'checked' : ''}>
              ${avatar(l.name, 'sm')}
              <div class="wc-aud-info">
                <div class="cell-main">${escapeHtml(l.name)}</div>
                <div class="cell-sub">${escapeHtml(l.email || '')}${l.company ? ' • ' + escapeHtml(l.company) : ''}</div>
              </div>
            </label>
          `).join('') : '<p style="color:var(--text-3);padding:16px 4px">No leads match your search.</p>'}
        </div>`;
      foot.innerHTML = `
        <button class="btn btn-ghost" data-wc-back>${icon('arrowLeft')} Back</button>
        <button class="btn btn-primary" data-wc-next>${icon('arrowRight')} Continue</button>`;

      const search = body.querySelector('#wc-aud-search');
      search.value = state.query;
      search.addEventListener('input', () => { state.query = search.value; renderStep(); });

      body.querySelector('#wc-aud-selectall')?.addEventListener('change', (e) => {
        const check = e.currentTarget.checked;
        visible.forEach(l => { check ? state.selected.add(l.id) : state.selected.delete(l.id); });
        body.querySelectorAll('input[name="aud-lead"]').forEach(cb => cb.checked = check);
        body.querySelectorAll('.wc-aud-item').forEach(it => it.classList.toggle('on', check));
        body.querySelector('.em-lbl-opt').textContent = state.selected.size + ' selected';
        body.querySelector('#wc-aud-selectall').checked = check;
      });

      body.addEventListener('change', (e) => {
        if (e.target.name === 'aud-lead') {
          const id = e.target.value;
          e.target.checked ? state.selected.add(id) : state.selected.delete(id);
          e.target.closest('.wc-aud-item').classList.toggle('on', e.target.checked);
          body.querySelector('.em-lbl-opt').textContent = state.selected.size + ' selected';
          const allVis = body.querySelectorAll('input[name="aud-lead"]');
          const allOn = visible.length > 0 && [...allVis].every(cb => cb.checked);
          body.querySelector('#wc-aud-selectall').checked = allOn;
        }
      });
    }

    if (state.step === 3) {
      body.innerHTML = `
        <div class="form-group">
          <label>${icon('atSign', 'ic-14')} Sender Account</label>
          <select name="accountId">
            ${accounts.map(a => `<option value="${a.id}" ${state.accountId === a.id ? 'selected' : ''}>${escapeHtml(a.displayName || a.email)} <${escapeHtml(a.email)}>${a.provider === 'smtp' ? ' (SMTP)' : ' (Gmail)'}</option>`).join('')}
          </select>
        </div>
        <div class="wc-hint">
          ${icon('info', 'ic-14')} Campaign emails will be sent from this account on behalf of your leads' outreach.
        </div>`;
      foot.innerHTML = `
        <button class="btn btn-ghost" data-wc-back>${icon('arrowLeft')} Back</button>
        <button class="btn btn-primary" data-wc-next>${icon('arrowRight')} Write Email</button>`;
    }

    if (state.step === 4) {
      // Load templates for picker
      let tplOptions = '<option value="">— Write from scratch —</option>';
      try {
        const tpls = await API.templates.list();
        tplOptions += tpls.map(t => `<option value="${t.id}" data-subject="${escapeHtml(t.subject || '')}" data-body-encoded="${btoa(unescape(encodeURIComponent(t.body || '')))}">${escapeHtml(t.name)} (${escapeHtml(TEMPLATE_CATEGORIES[t.category] || t.category)})</option>`).join('');
      } catch (e) {}

      body.innerHTML = `
        <div class="form-group">
          <label>${icon('fileText', 'ic-14')} Load Template</label>
          <select id="wc-template-pick">${tplOptions}</select>
        </div>
        <div class="form-group">
          <label>${icon('type', 'ic-14')} Subject Line</label>
          <input name="subject" placeholder="e.g. Quick question about {{company}}" value="${escapeHtml(state.subject)}" />
        </div>
        <div class="form-group">
          <label>${icon('fileText', 'ic-14')} Email Body <span class="em-lbl-opt">HTML supported</span></label>
          <textarea name="body" class="em-msg" rows="8" placeholder="Hi {{firstName}},&#10;&#10;I noticed {{company}} in the {{industry}} space...">${escapeHtml(state.body)}</textarea>
        </div>
        <div class="em-chips">
          ${placeholders.map(p => `<button type="button" class="em-chip" data-ph="${p}">${p}</button>`).join('')}
          <span class="em-chip-hint">Click to insert</span>
        </div>`;

      // Template picker
      body.querySelector('#wc-template-pick').addEventListener('change', (e) => {
        const opt = e.target.selectedOptions[0];
        if (opt && opt.value) {
          const subj = opt.dataset.subject || '';
          const bd = opt.dataset.bodyEncoded ? decodeURIComponent(escape(atob(opt.dataset.bodyEncoded))) : '';
          body.querySelector('input[name="subject"]').value = subj;
          body.querySelector('textarea[name="body"]').value = bd;
          state.subject = subj;
          state.body = bd;
          // Increment usage
          API.templates.use(opt.value).catch(() => {});
        }
      });
      foot.innerHTML = `
        <button class="btn btn-ghost" data-wc-back>${icon('arrowLeft')} Back</button>
        <button class="btn btn-primary" data-wc-save>${icon('save')} Save Campaign</button>`;

      const msgArea = body.querySelector('textarea[name="body"]');
      body.querySelectorAll('.em-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          msgArea.value += chip.dataset.ph;
          msgArea.focus();
        });
      });
    }

    if (state.step === 5) {
      body.innerHTML = `
        <div class="form-group"><label>${icon('shield', 'ic-14')} Gmail Deliverability Mode</label><div class="muted small">Reduce spam risk when sending lean, low-volume outreach through regular Gmail accounts.</div></div>

        <div class="form-group">
          <label>${icon('eye', 'ic-14')} Open Tracking</label>
          <label class="toggle-row">
            <input type="checkbox" name="openTracking" ${state.tracking.openTracking ? 'checked' : ''}>
            <span class="toggle" ></span>
            <span class="muted small">Injects a 1px tracking pixel. OFF is recommended for Gmail lean outreach.</span>
          </label>
        </div>

        <div class="form-group">
          <label>${icon('eye', 'ic-14')} Click Tracking</label>
          <label class="toggle-row">
            <input type="checkbox" name="clickTracking" ${state.tracking.clickTracking ? 'checked' : ''}>
            <span class="toggle" ></span>
            <span class="muted small">Rewrites links through a tracking redirect. OFF is recommended for Gmail.</span>
          </label>
        </div>

        <div class="form-group">
          <label>${icon('shield', 'ic-14')} Conservative Sending Mode</label>
          <label class="toggle-row">
            <input type="checkbox" name="conservativeMode" ${state.deliverability.conservativeMode ? 'checked' : ''}>
            <span class="toggle" ></span>
            <span class="muted small">Sequential sends with a small randomized delay; no marketing wrappers added to your email.</span>
          </label>
        </div>

        <div class="form-group">
          <label>${icon('x', 'ic-14')} Stop conditions</label>
          <div class="deliv-grid">
            <label class="toggle-row c"><input type="checkbox" name="stopOnReply" ${state.deliverability.stopOnReply ? 'checked' : ''}><span class="toggle"></span> Stop on Reply</label>
            <label class="toggle-row c"><input type="checkbox" name="stopOnBounce" ${state.deliverability.stopOnBounce ? 'checked' : ''}><span class="toggle"></span> Stop on Bounce</label>
            <label class="toggle-row c"><input type="checkbox" name="stopOnUnsubscribe" ${state.deliverability.stopOnUnsubscribe ? 'checked' : ''}><span class="toggle"></span> Stop on Unsubscribe</label>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Daily Send Limit (per account)</label>
            <input type="number" name="dailySendLimit" min="0" value="${state.deliverability.dailySendLimit}" />
          </div>
          <div class="form-group">
            <label>Min delay (s)</label>
            <input type="number" name="delayMinSec" min="0" value="${state.deliverability.delayMinSec}" />
          </div>
          <div class="form-group">
            <label>Max delay (s)</label>
            <input type="number" name="delayMaxSec" min="0" value="${state.deliverability.delayMaxSec}" />
          </div>
        </div>

        <div class="form-group">
          <label>${icon('fileText', 'ic-14')} Optional Footer (plain outreach)</label>
          <textarea name="footerText" class="em-msg" rows="2" placeholder="If this isn't relevant, just let me know and I won't follow up.">${escapeHtml(state.deliverability.footerText)}</textarea>
        </div>`;
      foot.innerHTML = `
        <button class="btn btn-ghost" data-wc-back>${icon('arrowLeft')} Back</button>
        <button class="btn btn-primary" data-wc-save>${icon('save')} Save Campaign</button>`;
    }
  }

  modal.addEventListener('click', (e) => {
    const next = e.target.closest('[data-wc-next]');
    const back = e.target.closest('[data-wc-back]');
    const save = e.target.closest('[data-wc-save]');

    if (back) {
      capture();
      state.step = Math.max(1, state.step - 1);
      renderStep();
      return;
    }

    if (next) {
      capture();
      if (state.step === 1 && !state.name) return UI.toast('Please enter a campaign name.', 'error');
      if (state.step === 2 && !state.selected.size) return UI.toast('Select at least one lead for the audience.', 'error');
      state.step = Math.min(5, state.step + 1);
      renderStep();
      return;
    }

    if (save) {
      submitCampaign();
    }

    const stepgo = e.target.closest('[data-wc-stepgo]');
    if (stepgo) {
      const target = parseInt(stepgo.dataset.wcStepgo, 10);
      if (target < state.step) {
        state.step = target;
        renderStep();
      }
    }
  });

  async function submitCampaign() {
    capture();
    if (!state.name) return UI.toast('Please enter a campaign name.', 'error');
    if (!state.accountId) return UI.toast('Please choose a sender account.', 'error');
    if (!state.subject) return UI.toast('Please enter a subject line.', 'error');
    if (!state.body) return UI.toast('Please write the email body.', 'error');

    const saveBtn = modal.querySelector('[data-wc-save]');
    const original = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `${icon('refreshCw', 'ic-14 spin')} Saving...`;

    try {
      const campaign = await API.campaigns.create({
        name: state.name, accountId: state.accountId, subject: state.subject, body: state.body,
        tracking: state.tracking, deliverability: state.deliverability
      });
      await API.campaigns.assignLeads(campaign.id, [...state.selected]);
      UI.toast(`Campaign "${state.name}" created with ${state.selected.size} leads.`);
      close();
      renderCampaigns();
    } catch (err) {
      UI.toast('Failed to create campaign: ' + err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = original;
    }
  }

  renderStep();
}

function showEditCampaignModal(c) {
  const tr = c.tracking || { openTracking: false, clickTracking: false };
  const dv = c.deliverability || { conservativeMode: true, stopOnReply: true, stopOnBounce: true, stopOnUnsubscribe: true, dailySendLimit: 40, delayMinSec: 90, delayMaxSec: 180, footerText: '' };

  const body = `
    <form id="edit-campaign-form" class="form-grid">
      <div class="form-group">
        <label>Campaign Name</label>
        <input type="text" name="name" value="${escapeHtml(c.name)}" required>
      </div>
      <div class="form-group">
        <label>Subject Line</label>
        <input type="text" name="subject" value="${escapeHtml(c.subject || '')}" required>
      </div>
      <div class="form-group">
        <label>Email Body <span class="em-lbl-opt">HTML supported</span></label>
        <textarea name="body" rows="6">${escapeHtml(c.body || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <select name="status">
            <option value="draft" ${c.status === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="paused" ${c.status === 'paused' ? 'selected' : ''}>Paused</option>
            <option value="active" ${c.status === 'active' ? 'selected' : ''}>Active</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="border-top:1px solid var(--line);padding-top:16px;margin-top:8px">
        <label>${icon('shield', 'ic-14')} Gmail Deliverability Mode</label>
        <div class="muted small" style="margin-bottom:12px">Tracking and sender behavior for this campaign.</div>
        <div class="form-group">
          <label class="toggle-row"><input type="checkbox" name="openTracking" ${tr.openTracking ? 'checked' : ''}><span class="toggle"></span> Open Tracking</label>
        </div>
        <div class="form-group">
          <label class="toggle-row"><input type="checkbox" name="clickTracking" ${tr.clickTracking ? 'checked' : ''}><span class="toggle"></span> Click Tracking</label>
        </div>
        <div class="form-group">
          <label class="toggle-row"><input type="checkbox" name="conservativeMode" ${dv.conservativeMode ? 'checked' : ''}><span class="toggle"></span> Conservative Sending Mode</label>
        </div>
        <div class="deliv-grid">
          <label class="toggle-row c"><input type="checkbox" name="stopOnReply" ${dv.stopOnReply ? 'checked' : ''}><span class="toggle"></span> Stop on Reply</label>
          <label class="toggle-row c"><input type="checkbox" name="stopOnBounce" ${dv.stopOnBounce ? 'checked' : ''}><span class="toggle"></span> Stop on Bounce</label>
          <label class="toggle-row c"><input type="checkbox" name="stopOnUnsubscribe" ${dv.stopOnUnsubscribe ? 'checked' : ''}><span class="toggle"></span> Stop on Unsubscribe</label>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Daily Send Limit</label>
            <input type="number" name="dailySendLimit" min="0" value="${dv.dailySendLimit}">
          </div>
          <div class="form-group">
            <label>Min delay (s)</label>
            <input type="number" name="delayMinSec" min="0" value="${dv.delayMinSec}">
          </div>
          <div class="form-group">
            <label>Max delay (s)</label>
            <input type="number" name="delayMaxSec" min="0" value="${dv.delayMaxSec}">
          </div>
        </div>
        <div class="form-group">
          <label>Optional Footer</label>
          <textarea name="footerText" class="em-msg" rows="2">${escapeHtml(dv.footerText || '')}</textarea>
        </div>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-ghost" data-close-modal>Cancel</button>
    <button class="btn btn-primary" id="save-edit-campaign">${icon('save')} Save Changes</button>`;

  UI.modal('Edit Campaign', body, { wide: true, footer });

  UI.on('#save-edit-campaign', 'click', async () => {
    const form = document.getElementById('edit-campaign-form');
    const fd = new FormData(form);
    const cb = (n) => form.querySelector(`input[name="${n}"]`)?.checked === true;
    try {
      await API.campaigns.update(c.id, {
        name: fd.get('name').trim(),
        subject: fd.get('subject').trim(),
        body: fd.get('body').trim(),
        status: fd.get('status'),
        tracking: { openTracking: cb('openTracking'), clickTracking: cb('clickTracking') },
        deliverability: {
          conservativeMode: cb('conservativeMode'),
          stopOnReply: cb('stopOnReply'),
          stopOnBounce: cb('stopOnBounce'),
          stopOnUnsubscribe: cb('stopOnUnsubscribe'),
          dailySendLimit: parseInt(fd.get('dailySendLimit'), 10) || 40,
          delayMinSec: parseInt(fd.get('delayMinSec'), 10) || 90,
          delayMaxSec: parseInt(fd.get('delayMaxSec'), 10) || 180,
          footerText: fd.get('footerText') || '',
        },
      });
      UI.closeModal();
      UI.toast('Campaign updated.');
      renderCampaigns();
    } catch (err) {
      UI.toast('Failed to update campaign: ' + err.message, 'error');
    }
  });
}
