async function renderAnalytics() {
  const gen = getRenderGeneration();
  let leads = Store.get('leads') || [];
  let metrics = { totalLeads: 0, newLeads: 0, qualified: 0, avgScore: 0 };
  let campaigns = [];
  let emailAnalytics = null;
  let dealMetrics = { totalDeals: 0, wonValue: 0, pipelineValue: 0, conversionRate: '0.0' };

  try {
    leads = await API.leads.list();
    Store._state.leads = leads;
    metrics = await API.leads.metrics();
  } catch (err) {
    metrics = Store.getMetrics();
  }

  try {
    campaigns = await API.campaigns.list();
    Store._state.campaigns = campaigns;
  } catch (err) {
    campaigns = [];
  }

  try {
    emailAnalytics = await API.campaigns.analyticsOverview();
  } catch (err) {
    emailAnalytics = null;
  }

  try {
    dealMetrics = await API.deals.metrics();
  } catch (e) {}

  const industryBreakdown = {};
  leads.forEach(l => { industryBreakdown[l.industry || 'Unknown'] = (industryBreakdown[l.industry || 'Unknown'] || 0) + 1; });
  const topIndustries = Object.entries(industryBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const sourceBreakdown = {};
  leads.forEach(l => { sourceBreakdown[l.source || 'Unknown'] = (sourceBreakdown[l.source || 'Unknown'] || 0) + 1; });

  const maxIndustry = topIndustries.length ? topIndustries[0][1] : 1;
  const maxSource = Math.max(...Object.values(sourceBreakdown), 1);

  const statusBreakdown = {};
  leads.forEach(l => { statusBreakdown[l.status] = (statusBreakdown[l.status] || 0) + 1; });

  const totalSent = emailAnalytics?.totalSends || campaigns.reduce((s, c) => s + c.sent, 0);
  const totalOpened = emailAnalytics?.totalOpened || campaigns.reduce((s, c) => s + c.opened, 0);
  const totalClicked = emailAnalytics?.totalClicked || campaigns.reduce((s, c) => s + c.clicked, 0);
  const totalReplied = emailAnalytics?.totalReplies || 0;
  const totalBounced = emailAnalytics?.totalBounced || 0;

  const overallOpenRate = emailAnalytics?.overallOpenRate || (totalSent ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0');
  const overallReplyRate = emailAnalytics?.overallReplyRate || (totalSent ? ((totalReplied / totalSent) * 100).toFixed(1) : '0.0');

  const perCampaign = emailAnalytics?.perCampaign || campaigns.filter(c => c.sent > 0).map(c => ({
    id: c.id, name: c.name, status: c.status, sent: c.sent, opened: c.opened,
    clicked: c.clicked, replied: c.replied, bounced: c.bounced, createdAt: c.createdAt,
    openRate: c.sent ? ((c.opened / c.sent) * 100).toFixed(1) : '0.0',
    clickRate: c.sent ? ((c.clicked / c.sent) * 100).toFixed(1) : '0.0',
  }));

  // Email funnel rows (dropdown-style, width relative to sent)
  const funnel = [
    { label: 'Sent', val: totalSent, pct: totalSent ? 100 : 0, cls: '' },
    { label: 'Opened', val: totalOpened, pct: totalSent ? (totalOpened / totalSent) * 100 : 0, cls: '' },
    { label: 'Clicked', val: totalClicked, pct: totalSent ? (totalClicked / totalSent) * 100 : 0, cls: '' },
    { label: 'Replied', val: totalReplied, pct: totalSent ? (totalReplied / totalSent) * 100 : 0, cls: '' },
    { label: 'Bounced', val: totalBounced, pct: totalSent ? (totalBounced / totalSent) * 100 : 0, cls: 'fn-harm' },
  ];

  // Lead pipeline
  const pipelineStages = ['new', 'qualified', 'contacted', 'replied', 'interested', 'demo', 'proposal', 'customer'];
  const pipelineMax = Math.max(...pipelineStages.map(s => statusBreakdown[s] || 0), 1);

  // Insights
  const insights = [];
  const bestCampaign = perCampaign.slice()
    .sort((a, b) => ((b.replied || 0) / Math.max(b.sent, 1)) - ((a.replied || 0) / Math.max(a.sent, 1)))[0];
  if (bestCampaign) {
    insights.push(`<b>${escapeHtml(bestCampaign.name)}</b> is currently your best campaign by reply rate.`);
  }
  if (totalReplied > 0) {
    insights.push(`${totalReplied} recipient${totalReplied === 1 ? '' : 's'} replied and may need follow-up.`);
  }
  if (totalBounced === 0) {
    insights.push('No email bounces detected — deliverability looks healthy.');
  } else {
    insights.push(`${totalBounced} email${totalBounced === 1 ? '' : 's'} bounced — review suppressed addresses.`);
  }
  if (dealMetrics.totalDeals > 0) {
    insights.push(`${dealMetrics.totalDeals} deal${dealMetrics.totalDeals === 1 ? '' : 's'} in your pipeline worth ${formatCurrency(dealMetrics.pipelineValue)}.`);
  }
  if (insights.length === 0) {
    insights.push('Send your first campaign to start generating performance insights.');
  }

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Analytics</h1>
        <p class="page-sub">Performance across your outreach and sales.</p>
      </div>
      <div class="page-actions">
        <div class="range-select">
          <select id="analytics-range" aria-label="Date range">
            <option value="7">Last 7 days</option>
            <option value="30" selected>Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          ${icon('chevronDown', 'ic-14 range-caret')}
        </div>
        <button class="btn btn-secondary" data-action="export-report">${icon('download')} Export</button>
      </div>
    </div>

    <div class="dash-metrics">
      <div class="dash-metric">
        <div class="dm-top"><div class="dm-ic i-indigo">${icon('users')}</div></div>
        <div class="dm-val">${metrics.totalLeads}</div>
        <div class="dm-label">LEADS</div>
      </div>
      <div class="dash-metric">
        <div class="dm-top"><div class="dm-ic i-blue">${icon('send')}</div></div>
        <div class="dm-val">${totalSent}</div>
        <div class="dm-label">EMAILS SENT</div>
      </div>
      <div class="dash-metric">
        <div class="dm-top"><div class="dm-ic i-teal">${icon('eye')}</div></div>
        <div class="dm-val">${overallOpenRate}%</div>
        <div class="dm-label">OPEN RATE</div>
      </div>
      <div class="dash-metric">
        <div class="dm-top"><div class="dm-ic i-green">${icon('messageSquare')}</div></div>
        <div class="dm-val">${overallReplyRate}%</div>
        <div class="dm-label">REPLY RATE</div>
      </div>
      <div class="dash-metric">
        <div class="dm-top"><div class="dm-ic i-amber">${icon('target')}</div></div>
        <div class="dm-val">${dealMetrics.totalDeals}</div>
        <div class="dm-label">DEALS</div>
      </div>
    </div>

    <div class="card mt24">
      <div class="card-head">
        <div>
          <div class="card-title">${icon('barChart', 'ic-16')} Campaign Performance</div>
          <div class="card-sub">Email engagement per campaign</div>
        </div>
        <button class="btn btn-sm btn-ghost" data-nav="campaigns">View all ${icon('arrowRight')}</button>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Sent</th>
              <th>Opened</th>
              <th>Clicked</th>
              <th>Replied</th>
              <th>Open %</th>
              <th>Reply %</th>
            </tr>
          </thead>
          <tbody>
            ${perCampaign.length ? perCampaign.slice(0, 10).map(c => `
              <tr>
                <td><div class="cell-main" style="font-size:12.5px">${escapeHtml(c.name)}</div></td>
                <td>${c.sent}</td>
                <td>${c.opened || 0}</td>
                <td>${c.clicked || 0}</td>
                <td>${c.replied || 0}</td>
                <td>${ring(parseFloat(c.openRate) || 0, 'sm')}</td>
                <td>${c.sent ? Math.round(((c.replied || 0) / c.sent) * 100) + '%' : '—'}</td>
              </tr>
            `).join('') : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-3)">No campaigns with sends yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="dash-grid2 mt16">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">${icon('layers', 'ic-16')} Email Funnel</div>
            <div class="card-sub">Sent to reply conversion</div>
          </div>
        </div>
        <div class="funnel">
          ${funnel.map(f => `
            <div class="fn-row">
              <div class="fn-label">${f.label}</div>
              <div class="fn-track"><div class="fn-bar ${f.cls}" style="width:${Math.max(f.pct, f.val ? 3 : 0)}%"></div></div>
              <div class="fn-val">${f.val}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">${icon('trendingUp', 'ic-16')} Lead Pipeline</div>
            <div class="card-sub">Leads across stages</div>
          </div>
          <button class="btn btn-sm btn-ghost" data-nav="leads">View ${icon('arrowRight')}</button>
        </div>
        <div class="pipe-bars">
          ${pipelineStages.map(stage => {
            const count = statusBreakdown[stage] || 0;
            const pct = Math.round((count / pipelineMax) * 100);
            return `
              <div class="pb-row">
                <div class="pb-label" style="width:96px">${STATUSES[stage] || stage}</div>
                <div class="pb-track"><div class="pb-fill" style="width:${Math.max(pct, count ? 8 : 0)}%"></div></div>
                <div class="pb-count">${count}</div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div class="dash-grid2 mt16">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">${icon('pieChart', 'ic-16')} Top Industries</div>
            <div class="card-sub">Where your leads operate</div>
          </div>
        </div>
        <div class="card-body" style="padding:18px 22px">
          ${topIndustries.map(([industry, count]) => `
            <div class="pb-row" style="margin-bottom:10px">
              <div class="pb-label" style="width:110px">${escapeHtml(industry)}</div>
              <div class="pb-track"><div class="pb-fill" style="width:${Math.max((count / maxIndustry) * 100, count ? 8 : 0)}%"></div></div>
              <div class="pb-count">${count}</div>
            </div>
          `).join('') || '<p class="muted small" style="text-align:center;padding:20px">No lead data yet</p>'}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">${icon('globe', 'ic-16')} Lead Sources</div>
            <div class="card-sub">Where leads came from</div>
          </div>
        </div>
        <div class="card-body" style="padding:18px 22px">
          ${Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]).map(([source, count]) => `
            <div class="pb-row" style="margin-bottom:10px">
              <div class="pb-label" style="width:110px">${escapeHtml(source)}</div>
              <div class="pb-track"><div class="pb-fill" style="width:${Math.max((count / maxSource) * 100, count ? 8 : 0)}%"></div></div>
              <div class="pb-count">${count}</div>
            </div>
          `).join('') || '<p class="muted small" style="text-align:center;padding:20px">No lead data yet</p>'}
        </div>
      </div>
    </div>

    <div class="card mt16">
      <div class="card-head">
        <div>
          <div class="card-title">${icon('zap', 'ic-16')} Insights</div>
          <div class="card-sub">Key takeaways to act on</div>
        </div>
      </div>
      <div class="insights-list">
        ${insights.map(i => `<div class="insight-item">${icon('chevronRight', 'ic-14 insight-arrow')}<span>${i}</span></div>`).join('')}
      </div>
    </div>`;

  if (gen !== getRenderGeneration()) return;
  UI.renderView(html);
  UI.delegate('#view', '[data-nav]', 'click', (e, el) => {
    e.preventDefault();
    Store.navigate(el.dataset.nav);
  });
  UI.delegate('#view', '[data-action="export-report"]', 'click', async () => {
    try {
      await API.export.analytics();
      UI.toast('Analytics report exported.');
    } catch (err) {
      UI.toast('Export failed: ' + err.message, 'error');
    }
  });
}

function formatCurrency(v) {
  v = v || 0;
  return v >= 100000 ? (v / 100000).toFixed(1).replace(/\.0$/, '') + 'L'
    : v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    : String(v);
}
