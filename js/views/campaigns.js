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
    const openRate = c.sent ? Math.round((c.opened / c.sent) * 100) : 0;
    const replyRate = c.sent ? Math.round((c.replied / c.sent) * 100) : 0;

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
}

async function showCampaignDetail(c) {
  const openRate = c.sent ? Math.round((c.opened / c.sent) * 100) : 0;
  const clickRate = c.opened ? Math.round((c.clicked / c.opened) * 100) : 0;
  const replyRate = c.sent ? Math.round((c.replied / c.sent) * 100) : 0;
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
    <div class="metrics" style="grid-template-columns:repeat(4,1fr)">
      ${metricCard('send', 'i-blue', c.sent, 'Sent')}
      ${metricCard('eye', 'i-indigo', c.opened, 'Opened')}
      ${metricCard('messageSquare', 'i-green', replyCount, 'Replied')}
      ${metricCard('alertCircle', 'i-red', c.bounced, 'Bounced')}
    </div>
    <div class="mt24">
      <h4 style="margin-bottom:12px">Funnel</h4>
      <div class="funnel">
        <div class="fn-row"><div class="fn-label">Sent</div><div class="fn-track"><div class="fn-bar" style="width:100%"></div></div><div class="fn-val">${c.sent}</div></div>
        <div class="fn-row"><div class="fn-label">Delivered</div><div class="fn-track"><div class="fn-bar" style="width:${c.sent ? (c.delivered/c.sent)*100 : 0}%"></div></div><div class="fn-val">${c.delivered}</div></div>
        <div class="fn-row"><div class="fn-label">Opened</div><div class="fn-track"><div class="fn-bar" style="width:${openRate}%"></div></div><div class="fn-val">${c.opened}</div><div class="fn-conv">${openRate}%</div></div>
        <div class="fn-row"><div class="fn-label">Clicked</div><div class="fn-track"><div class="fn-bar" style="width:${clickRate}%"></div></div><div class="fn-val">${c.clicked}</div><div class="fn-conv">${clickRate}%</div></div>
        <div class="fn-row"><div class="fn-label">Replied</div><div class="fn-track"><div class="fn-bar" style="width:${replyRate}%"></div></div><div class="fn-val">${replyCount}</div><div class="fn-conv">${replyRate}%</div></div>
      </div>
    </div>
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
      await API.campaigns.assignLeads(c.id, [el.dataset.leadId]); // This won't work for remove, need a delete endpoint
    } catch (err) {
      UI.toast('Failed to remove lead');
    }
  });
}

function campaignLeadBadge(status) {
  const colors = { pending: 'st-new', sent: 'st-sent', replied: 'st-res', failed: 'st-dnc' };
  return `<span class="badge ${colors[status] || 'st-new'}">${status}</span>`;
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

const CAMPAIGN_STEPS = ['Details', 'Audience', 'Sender', 'Email'];
const CAMPAIGN_PLACEHOLDERS = ['{{firstName}}', '{{lastName}}', '{{company}}', '{{industry}}', '{{title}}'];

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
  }

  function updateSteps() {
    modal.querySelectorAll('.wc-step').forEach((el, i) => {
      el.classList.toggle('on', i === state.step - 1);
      el.classList.toggle('done', i < state.step - 1);
    });
  }

  function renderStep() {
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
      body.innerHTML = `
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
      state.step = Math.min(4, state.step + 1);
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
      const campaign = await API.campaigns.create({ name: state.name, accountId: state.accountId, subject: state.subject, body: state.body });
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
