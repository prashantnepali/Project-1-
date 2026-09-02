const DASH_PIPELINE = [
  { key: 'lead', label: 'Lead' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

const NEEDS_ICON = {
  reply: 'messageSquare',
  task: 'alertCircle',
  engaged: 'zap',
  proposal: 'fileText',
};

const NEEDS_ICON_CLS = {
  reply: 'ne-r',
  task: 'ne-r',
  engaged: 'ne-h',
  proposal: 'ne-a',
};

async function renderDashboard() {
  const gen = getRenderGeneration();
  let d = null;
  let activities = [];

  try {
    d = await API.dashboard.overview();
    if (gen !== getRenderGeneration()) return;
  } catch (err) {}

  try {
    activities = await API.activities.list({ limit: 8 });
    if (gen !== getRenderGeneration()) return;
    Store._state.activities = activities;
  } catch (err) {
    activities = Store.getActivities().slice(0, 8);
  }

  const m = (d && d.metrics) || {};
  const leads = m.leads || { total: 0, newThisWeek: 0 };
  const campaigns = m.campaigns || { total: 0, active: 0, sentToday: 0 };
  const replies = m.replies || { total: 0, positive: 0, needResponse: 0 };
  const deals = m.deals || { total: 0, open: 0, pipelineValue: 0 };
  const tasks = m.tasks || { total: 0, overdue: 0, dueToday: 0 };
  const needs = (d && d.needsAttention) || [];
  const pipeline = (d && d.pipeline) || {};
  const perf = (d && d.campaignPerf) || { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 };
  const bestCampaign = (d && d.bestCampaign) || null;

  const formatMoney = (v) => {
    v = v || 0;
    return v >= 100000 ? 'Rs ' + (v / 100000).toFixed(1).replace(/\.0$/, '') + 'L'
      : v >= 1000 ? 'Rs ' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
      : 'Rs ' + String(v);
  };

  const openRate = perf.sent ? Math.round((perf.opened / perf.sent) * 100) : 0;
  const clickRate = perf.sent ? Math.round((perf.clicked / perf.sent) * 100) : 0;
  const replyRate = perf.sent ? Math.round((perf.replied / perf.sent) * 100) : 0;

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">Welcome back, Prashant. Here's your lead engine overview.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" data-action="create-campaign">${icon('send')} Create Campaign</button>
        <button class="btn btn-primary" data-action="add-lead">${icon('plus')} Add Lead</button>
      </div>
    </div>

    <div class="dash-metrics">
      <div class="dash-metric" data-nav="leads">
        <div class="dm-top">
          <div class="dm-ic i-indigo">${icon('users')}</div>
          <div class="dm-sub">${leads.newThisWeek > 0 ? '+' + leads.newThisWeek + ' this wk' : '&nbsp;'}</div>
        </div>
        <div class="dm-val">${leads.total}</div>
        <div class="dm-label">LEADS</div>
      </div>

      <div class="dash-metric" data-nav="campaigns">
        <div class="dm-top">
          <div class="dm-ic i-blue">${icon('send')}</div>
          <div class="dm-sub">${campaigns.sentToday > 0 ? campaigns.sentToday + ' sent today' : '&nbsp;'}</div>
        </div>
        <div class="dm-val">${campaigns.active}</div>
        <div class="dm-label">ACTIVE CAMPAIGNS</div>
      </div>

      <div class="dash-metric" data-nav="replies">
        <div class="dm-top">
          <div class="dm-ic i-teal">${icon('messageSquare')}</div>
          <div class="dm-sub">${replies.positive > 0 ? replies.positive + ' positive' : '&nbsp;'}</div>
        </div>
        <div class="dm-val">${replies.needResponse}</div>
        <div class="dm-label">REPLIES NEED RESPONSE</div>
      </div>

      <div class="dash-metric" data-nav="deals">
        <div class="dm-top">
          <div class="dm-ic i-green">${icon('dollarSign')}</div>
          <div class="dm-sub">${deals.open} open deals</div>
        </div>
        <div class="dm-val">${formatMoney(deals.pipelineValue)}</div>
        <div class="dm-label">SALES PIPELINE</div>
      </div>

      <div class="dash-metric" data-nav="tasks">
        <div class="dm-top">
          <div class="dm-ic i-amber">${icon('clock')}</div>
          <div class="dm-sub ${tasks.overdue ? 'dm-alert' : ''}">${tasks.overdue > 0 ? tasks.overdue + ' overdue' : '&nbsp;'}</div>
        </div>
        <div class="dm-val">${tasks.dueToday}</div>
        <div class="dm-label">TASKS DUE TODAY</div>
      </div>
    </div>

    <div class="dash-grid2 mt24">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">${icon('alertCircle', 'ic-16')} Needs Attention</div>
            <div class="card-sub">Items that need your action</div>
          </div>
          <button class="btn btn-sm btn-ghost" data-nav="tasks">View all ${icon('arrowRight')}</button>
        </div>
        <div class="needs-list">
          ${needs.length ? needs.map(n => `
            <div class="needs-item" data-need-nav="${n.nav}" ${n.leadId ? `data-need-lead="${n.leadId}"` : ''}>
              <div class="needs-ic ${NEEDS_ICON_CLS[n.type]}">${icon(NEEDS_ICON[n.type])}</div>
              <div class="needs-label">${escapeHtml(n.label)}</div>
              <div class="needs-arrow">${icon('chevronRight', 'ic-14')}</div>
            </div>
          `).join('') : `<div class="needs-empty">${icon("checkCircle")} All caught up — nothing needs attention.</div>`}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">${icon('target', 'ic-16')} Sales Pipeline</div>
            <div class="card-sub">Deals across stages · ${formatMoney(deals.pipelineValue)}</div>
          </div>
          <button class="btn btn-sm btn-ghost" data-nav="deals">View ${icon('arrowRight')}</button>
        </div>
        <div class="pipe-bars">
          ${DASH_PIPELINE.map(p => {
            const stage = pipeline[p.key] || { count: 0, value: 0 };
            const max = Math.max(...DASH_PIPELINE.map(x => (pipeline[x.key] || {}).count || 0), 1);
            const pct = Math.round((stage.count / max) * 100);
            const isWon = p.key === 'won';
            const isLost = p.key === 'lost';
            return `
              <div class="pb-row">
                <div class="pb-label">${p.label}</div>
                <div class="pb-track">
                  <div class="pb-fill ${isWon ? 'pb-won' : isLost ? 'pb-lost' : ''}" style="width:${Math.max(pct, stage.count ? 8 : 0)}%"></div>
                </div>
                <div class="pb-count">${stage.count}</div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div class="dash-grid2 mt16">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">${icon('barChart', 'ic-16')} Campaign Performance</div>
            <div class="card-sub">Email engagement across all campaigns</div>
          </div>
          <button class="btn btn-sm btn-ghost" data-nav="analytics">View ${icon('arrowRight')}</button>
        </div>
        <div class="cp-stats">
          <div class="cp-item">
            <div class="cp-val">${perf.sent}</div>
            <div class="cp-lbl">Sent</div>
          </div>
          <div class="cp-item">
            <div class="cp-val">${openRate}%</div>
            <div class="cp-lbl">Opened</div>
          </div>
          <div class="cp-item">
            <div class="cp-val">${clickRate}%</div>
            <div class="cp-lbl">Clicked</div>
          </div>
          <div class="cp-item">
            <div class="cp-val">${replyRate}%</div>
            <div class="cp-lbl">Replied</div>
          </div>
        </div>
        ${bestCampaign ? `
          <div class="cp-best">
            <div class="cp-best-ic">${icon('award')}</div>
            <div>
              <div class="cp-best-lbl">Best campaign</div>
              <div class="cp-best-name">${escapeHtml(bestCampaign.name)}</div>
            </div>
            <div class="cp-best-meta">${bestCampaign.sent} sent</div>
          </div>` : ''}
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">${icon('activity', 'ic-16')} Recent Activity</div>
            <div class="card-sub">Latest actions across the platform</div>
          </div>
          <button class="btn btn-sm btn-ghost" data-nav="analytics">View ${icon('arrowRight')}</button>
        </div>
        <div class="act-list">
          ${activities.length ? activities.map(a => renderActivityItem(a)).join('') : '<div class="act-item" style="justify-content:center;color:var(--text-3);padding:32px">No activity yet</div>'}
        </div>
      </div>
    </div>`;

  if (gen !== getRenderGeneration()) return;
  UI.renderView(html);
  bindDashboardEvents();
}

function renderActivityItem(a) {
  if (a.type === 'reply_received') {
    let meta = {};
    try { meta = (typeof a.metadata === 'string') ? JSON.parse(a.metadata || '{}') : (a.metadata || {}); } catch {}
    const replyText = (meta.snippet || '').trim();
    return `
      <div class="act-item">
        <div class="act-ic">${icon('messageSquare')}</div>
        <div class="act-body">
          <div>${escapeHtml(a.description)}</div>
          ${replyText ? `<div class="act-reply">${escapeHtml(replyText)}</div>` : ''}
          <time>${UI.formatDate(a.timestamp)}</time>
        </div>
      </div>`;
  }
  return `
    <div class="act-item">
      <div class="act-ic ${getActivityIconCls(a.type)}">${icon(getActivityIcon(a.type))}</div>
      <div class="act-body">
        <div>${escapeHtml(a.description)}</div>
        <time>${UI.formatDate(a.timestamp)}</time>
      </div>
    </div>`;
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

  UI.delegate('#view', '[data-action="create-campaign"]', 'click', () => {
    showNewCampaignModal();
  });

  UI.delegate('#view', '[data-need-nav]', 'click', (e, el) => {
    const nav = el.dataset.needNav;
    const leadId = el.dataset.needLead;
    if (leadId && nav === 'leads') {
      Store.navigate('leads', { selectedLeadId: leadId });
    } else {
      Store.navigate(nav);
    }
  });
}

async function showSendEmailModal(prefill) {
  const [accounts, templates] = await Promise.all([
    API.accounts.list(),
    API.templates.list().catch(() => []),
  ]);
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

  const TEMPLATE_CATEGORIES = { cold_intro: 'Cold Intro', follow_up: 'Follow Up', proposal: 'Proposal', thank_you: 'Thank You', custom: 'Custom' };
  const tplOptions = (templates || []).map(t =>
    `<option value="${t.id}" data-subject="${escapeHtml(t.subject || '')}" data-body-encoded="${btoa(unescape(encodeURIComponent(t.body || '')))}">${escapeHtml(t.name)} (${escapeHtml(TEMPLATE_CATEGORIES[t.category] || t.category || 'Custom')})</option>`
  ).join('');

  const placeholders = ['{{firstName}}', '{{lastName}}', '{{company}}', '{{title}}', '{{first_name}}', '{{company_name}}', '{{sender_name}}', '{{phone_number}}'];

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

          <div class="form-group">
            <label>${icon('fileText', 'ic-14')} Load Template</label>
            <div class="em-select-wrap">
              <select id="send-email-template">
                <option value="">— Write from scratch —</option>
                ${tplOptions}
              </select>
              ${icon('chevronDown', 'ic-14 em-select-caret')}
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>${icon('mail', 'ic-14')} To</label>
              <input type="email" name="to" placeholder="recipient@example.com" required value="${escapeHtml((prefill && prefill.to) || '')}" />
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

  const templatePick = modal.querySelector('#send-email-template');
  if (templatePick) {
    templatePick.addEventListener('change', () => {
      const opt = templatePick.selectedOptions[0];
      if (opt && opt.value) {
        const subj = opt.dataset.subject || '';
        const bd = opt.dataset.bodyEncoded ? decodeURIComponent(escape(atob(opt.dataset.bodyEncoded))) : '';
        modal.querySelector('input[name="subject"]').value = subj;
        msgArea.value = bd;
        API.templates.use(opt.value).catch(() => {});
      }
    });
  }

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
      leadId: (prefill && prefill.leadId) || undefined,
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
