function renderCampaigns() {
  const campaigns = Store.getCampaigns();
  const active = campaigns.filter(c => c.status === 'active').length;
  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalReplied = campaigns.reduce((s, c) => s + c.replied, 0);

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Campaigns</h1>
        <p class="page-sub">${campaigns.length} campaigns in your account</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" data-action="new-campaign">${icon('plus')} New Campaign</button>
      </div>
    </div>

    <div class="metrics">
      ${metricCard('send', 'i-blue', totalSent, 'Total Sent')}
      ${metricCard('eye', 'i-indigo', campaigns.reduce((s, c) => s + c.opened, 0), 'Opened')}
      ${metricCard('messageSquare', 'i-green', totalReplied, 'Replied')}
      ${metricCard('play', 'i-teal', active, 'Active')}
      ${metricCard('pause', 'i-amber', campaigns.filter(c => c.status === 'paused').length, 'Paused')}
      ${metricCard('edit', 'i-slate', campaigns.filter(c => c.status === 'draft').length, 'Drafts')}
    </div>

    <div class="card mt24">
      <div class="toolbar">
        <div class="chips" id="campaign-filters">
          <button class="chip on" data-cfilter="all">All (${campaigns.length})</button>
          <button class="chip" data-cfilter="active">Active (${active})</button>
          <button class="chip" data-cfilter="paused">Paused (${campaigns.filter(c => c.status === 'paused').length})</button>
          <button class="chip" data-cfilter="draft">Draft (${campaigns.filter(c => c.status === 'draft').length})</button>
        </div>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Template</th>
              <th>Sent</th>
              <th>Opened</th>
              <th>Replied</th>
              <th>Open Rate</th>
              <th>Reply Rate</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="campaigns-tbody">
            ${campaignRows(campaigns)}
          </tbody>
        </table>
      </div>
    </div>`;

  UI.renderView(html);
  bindCampaignEvents(campaigns);
}

function campaignRows(campaigns) {
  if (!campaigns.length) {
    return `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-3)">No campaigns found.</td></tr>`;
  }

  return campaigns.map(c => {
    const openRate = c.sent ? Math.round((c.opened / c.sent) * 100) : 0;
    const replyRate = c.sent ? Math.round((c.replied / c.sent) * 100) : 0;

    return `
    <tr class="row-click" data-campaign="${c.id}">
      <td>
        <div class="cell-main">${c.name}</div>
        <div class="cell-sub">${UI.formatDate(c.createdAt)}</div>
      </td>
      <td>${campaignBadge(c.status)}</td>
      <td>${c.template}</td>
      <td>${UI.formatNumber(c.sent)}</td>
      <td>${UI.formatNumber(c.opened)}</td>
      <td>${UI.formatNumber(c.replied)}</td>
      <td>${ring(openRate, 'sm')}</td>
      <td>${ring(replyRate, 'sm')}</td>
      <td>
        <div class="td-actions">
          ${c.status === 'active' ? `<button class="ibtn" data-campaign-pause="${c.id}">${icon('pause', 'ic-14')}</button>` : ''}
          ${c.status === 'paused' ? `<button class="ibtn" data-campaign-play="${c.id}">${icon('play', 'ic-14')}</button>` : ''}
          <button class="ibtn" data-campaign-edit="${c.id}">${icon('edit', 'ic-14')}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function bindCampaignEvents(campaigns) {
  UI.delegate('#view', '[data-cfilter]', 'click', (e, el) => {
    UI.$$('[data-cfilter]', UI.el('#campaign-filters')).forEach(c => c.classList.remove('on'));
    el.classList.add('on');
    const f = el.dataset.cfilter;
    const filtered = f === 'all' ? campaigns : campaigns.filter(c => c.status === f);
    UI.html('#campaigns-tbody', campaignRows(filtered));
  });

  UI.delegate('#view', '[data-campaign]', 'click', (e, el) => {
    const c = Store.getCampaignById(el.dataset.campaign);
    if (c) showCampaignDetail(c);
  });

  UI.delegate('#view', '[data-campaign-pause]', 'click', (e, el) => {
    e.stopPropagation();
    const c = Store.getCampaignById(el.dataset.campaignPause);
    if (c) {
      c.status = 'paused';
      UI.toast(`Campaign "${c.name}" paused.`);
      renderCampaigns();
    }
  });

  UI.delegate('#view', '[data-campaign-play]', 'click', (e, el) => {
    e.stopPropagation();
    const c = Store.getCampaignById(el.dataset.campaignPlay);
    if (c) {
      c.status = 'active';
      UI.toast(`Campaign "${c.name}" activated.`);
      renderCampaigns();
    }
  });

  UI.delegate('#view', '[data-action="new-campaign"]', 'click', () => {
    UI.toast('Campaign builder would open here.');
  });
}

function showCampaignDetail(c) {
  const openRate = c.sent ? Math.round((c.opened / c.sent) * 100) : 0;
  const clickRate = c.opened ? Math.round((c.clicked / c.opened) * 100) : 0;
  const replyRate = c.sent ? Math.round((c.replied / c.sent) * 100) : 0;

  const body = `
    <div class="spread" style="margin-bottom:20px">
      <div>${campaignBadge(c.status)}</div>
      <div class="muted small">Created ${UI.formatDate(c.createdAt)}</div>
    </div>
    <div class="metrics" style="grid-template-columns:repeat(4,1fr)">
      ${metricCard('send', 'i-blue', c.sent, 'Sent')}
      ${metricCard('eye', 'i-indigo', c.opened, 'Opened')}
      ${metricCard('messageSquare', 'i-green', c.replied, 'Replied')}
      ${metricCard('alertCircle', 'i-red', c.bounced, 'Bounced')}
    </div>
    <div class="mt24">
      <h4 style="margin-bottom:12px">Funnel</h4>
      <div class="funnel">
        <div class="fn-row"><div class="fn-label">Sent</div><div class="fn-track"><div class="fn-bar" style="width:100%"></div></div><div class="fn-val">${c.sent}</div></div>
        <div class="fn-row"><div class="fn-label">Delivered</div><div class="fn-track"><div class="fn-bar" style="width:${c.sent ? (c.delivered/c.sent)*100 : 0}%"></div></div><div class="fn-val">${c.delivered}</div></div>
        <div class="fn-row"><div class="fn-label">Opened</div><div class="fn-track"><div class="fn-bar" style="width:${openRate}%"></div></div><div class="fn-val">${c.opened}</div><div class="fn-conv">${openRate}%</div></div>
        <div class="fn-row"><div class="fn-label">Clicked</div><div class="fn-track"><div class="fn-bar" style="width:${clickRate}%"></div></div><div class="fn-val">${c.clicked}</div><div class="fn-conv">${clickRate}%</div></div>
        <div class="fn-row"><div class="fn-label">Replied</div><div class="fn-track"><div class="fn-bar" style="width:${replyRate}%"></div></div><div class="fn-val">${c.replied}</div><div class="fn-conv">${replyRate}%</div></div>
      </div>
    </div>
    <div class="mt24">
      <h4 style="margin-bottom:8px">Subject Line</h4>
      <p style="font-size:13px;color:var(--text-2)">${c.subject}</p>
    </div>
    <div class="mt16">
      <h4 style="margin-bottom:8px">Target Audience</h4>
      <div class="chips">
        <span class="chip on">${c.leads.length} leads</span>
        <span class="chip">${c.template}</span>
      </div>
    </div>`;

  UI.modal(c.name, body, { wide: true });
}
