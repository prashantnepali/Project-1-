async function renderAnalytics() {
  const gen = getRenderGeneration();
  let leads = Store.get('leads') || [];
  let metrics = { totalLeads: 0, newLeads: 0, qualified: 0, avgScore: 0 };
  let campaigns = [];
  let emailAnalytics = null;

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

  const industryBreakdown = {};
  leads.forEach(l => { industryBreakdown[l.industry || 'Unknown'] = (industryBreakdown[l.industry || 'Unknown'] || 0) + 1; });
  const topIndustries = Object.entries(industryBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const sourceBreakdown = {};
  leads.forEach(l => { sourceBreakdown[l.source || 'Unknown'] = (sourceBreakdown[l.source || 'Unknown'] || 0) + 1; });

  const maxIndustry = topIndustries.length ? topIndustries[0][1] : 1;
  const maxSource = Math.max(...Object.values(sourceBreakdown), 1);

  const statusBreakdown = {};
  leads.forEach(l => { statusBreakdown[l.status] = (statusBreakdown[l.status] || 0) + 1; });

  const pipeline = {};
  PIPELINE.forEach(s => { pipeline[s] = 0; });
  leads.forEach(l => { if (pipeline[l.status] !== undefined) pipeline[l.status]++; });

  const totalSent = emailAnalytics?.totalSends || campaigns.reduce((s, c) => s + c.sent, 0);
  const totalOpened = emailAnalytics?.totalOpened || campaigns.reduce((s, c) => s + c.opened, 0);
  const totalClicked = emailAnalytics?.totalClicked || campaigns.reduce((s, c) => s + c.clicked, 0);
  const totalReplied = emailAnalytics?.totalReplies || 0;
  const totalBounced = emailAnalytics?.totalBounced || 0;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  const overallOpenRate = emailAnalytics?.overallOpenRate || (totalSent ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0');
  const overallClickRate = emailAnalytics?.overallClickRate || (totalSent ? ((totalClicked / totalSent) * 100).toFixed(1) : '0.0');
  const overallReplyRate = emailAnalytics?.overallReplyRate || (totalSent ? ((totalReplied / totalSent) * 100).toFixed(1) : '0.0');

  const perCampaign = emailAnalytics?.perCampaign || campaigns.filter(c => c.sent > 0).map(c => ({
    id: c.id, name: c.name, status: c.status, sent: c.sent, opened: c.opened,
    clicked: c.clicked, replied: c.replied, bounced: c.bounced, createdAt: c.createdAt,
    openRate: c.sent ? ((c.opened / c.sent) * 100).toFixed(1) : '0.0',
    clickRate: c.sent ? ((c.clicked / c.sent) * 100).toFixed(1) : '0.0',
  }));

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Analytics</h1>
        <p class="page-sub">Performance insights across your lead engine and email campaigns.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="export-report">${icon('download')} Export Report</button>
      </div>
    </div>

    <div class="metrics" style="grid-template-columns:repeat(6,1fr)">
      ${metricCard('users', 'i-indigo', metrics.totalLeads, 'Total Leads')}
      ${metricCard('send', 'i-blue', UI.formatNumber(totalSent), 'Emails Sent')}
      ${metricCard('eye', 'i-teal', UI.formatNumber(totalOpened), 'Opened')}
      ${metricCard('externalLink', 'i-amber', UI.formatNumber(totalClicked), 'Clicked')}
      ${metricCard('messageSquare', 'i-green', UI.formatNumber(totalReplied), 'Replied')}
      ${metricCard('alertCircle', 'i-red', UI.formatNumber(totalBounced), 'Bounced')}
    </div>

    <div class="metrics mt12" style="grid-template-columns:repeat(3,1fr)">
      ${metricCard('trendingUp', 'i-teal', overallOpenRate + '%', 'Open Rate')}
      ${metricCard('externalLink', 'i-amber', overallClickRate + '%', 'Click Rate')}
      ${metricCard('messageSquare', 'i-green', overallReplyRate + '%', 'Reply Rate')}
    </div>

    <div class="grid-2 mt24">
      <div class="dash-col">
        <div class="card">
          <div class="card-head">
            <div class="card-title">Pipeline Conversion</div>
          </div>
          <div class="funnel">
            ${PIPELINE.map((stage, i) => {
              const count = pipeline[stage];
              const pct = metrics.totalLeads ? Math.round((count / metrics.totalLeads) * 100) : 0;
              const conv = i > 0 && pipeline[PIPELINE[i-1]] ? Math.round((count / pipeline[PIPELINE[i-1]]) * 100) : 100;
              return `
                <div class="fn-row">
                  <div class="fn-label">${STATUSES[stage]}</div>
                  <div class="fn-track"><div class="fn-bar" style="width:${Math.max(pct, 2)}%"></div></div>
                  <div class="fn-val">${count}</div>
                  ${i > 0 ? `<div class="fn-conv">${conv}%</div>` : '<div class="fn-conv">—</div>'}
                </div>`;
            }).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">Email Engagement Funnel</div>
          </div>
          <div class="funnel">
            <div class="fn-row">
              <div class="fn-label">Sent</div>
              <div class="fn-track"><div class="fn-bar" style="width:100%"></div></div>
              <div class="fn-val">${totalSent}</div>
            </div>
            <div class="fn-row">
              <div class="fn-label">Opened</div>
              <div class="fn-track"><div class="fn-bar" style="width:${totalSent ? (totalOpened/totalSent)*100 : 0}%"></div></div>
              <div class="fn-val">${totalOpened}</div>
              <div class="fn-conv">${overallOpenRate}%</div>
            </div>
            <div class="fn-row">
              <div class="fn-label">Clicked</div>
              <div class="fn-track"><div class="fn-bar" style="width:${totalSent ? (totalClicked/totalSent)*100 : 0}%"></div></div>
              <div class="fn-val">${totalClicked}</div>
              <div class="fn-conv">${overallClickRate}%</div>
            </div>
            <div class="fn-row">
              <div class="fn-label">Replied</div>
              <div class="fn-track"><div class="fn-bar" style="width:${totalSent ? (totalReplied/totalSent)*100 : 0}%"></div></div>
              <div class="fn-val">${totalReplied}</div>
              <div class="fn-conv">${overallReplyRate}%</div>
            </div>
            <div class="fn-row">
              <div class="fn-label">Bounced</div>
              <div class="fn-track"><div class="fn-bar" style="width:${totalSent ? (totalBounced/totalSent)*100 : 0}%"></div></div>
              <div class="fn-val">${totalBounced}</div>
              <div class="fn-conv">${emailAnalytics?.bounceRate || (totalSent ? ((totalBounced / totalSent) * 100).toFixed(1) : '0.0')}%</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">Lead Sources</div>
          </div>
          <div class="card-body" style="padding:16px 20px">
            ${Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]).map(([source, count]) => `
              <div class="fn-row" style="margin-bottom:8px">
                <div class="fn-label" style="width:100px">${escapeHtml(source)}</div>
                <div class="fn-track"><div class="fn-bar" style="width:${(count / maxSource) * 100}%"></div></div>
                <div class="fn-val">${count}</div>
              </div>
            `).join('') || '<p class="muted small" style="text-align:center;padding:20px">No lead data yet</p>'}
          </div>
        </div>
      </div>

      <div class="dash-col">
        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title">${icon('barChart', 'ic-16')} Campaign Tracking Overview</div>
              <div class="card-sub">Per-campaign open, click, and reply rates</div>
            </div>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Clicked</th>
                  <th>Replies</th>
                  <th>Open %</th>
                  <th>Click %</th>
                </tr>
              </thead>
              <tbody>
                ${perCampaign.length ? perCampaign.slice(0, 10).map(c => `
                  <tr>
                    <td><div class="cell-main" style="font-size:12.5px">${escapeHtml(c.name)}</div></td>
                    <td>${campaignBadge(c.status)}</td>
                    <td>${c.sent}</td>
                    <td>${c.opened || 0}</td>
                    <td>${c.clicked || 0}</td>
                    <td>${c.replied || 0}</td>
                    <td>${ring(parseFloat(c.openRate) || 0, 'sm')}</td>
                    <td>${ring(parseFloat(c.clickRate) || 0, 'sm')}</td>
                  </tr>
                `).join('') : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-3)">No campaigns with sends yet</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">Top Industries</div>
          </div>
          <div class="card-body" style="padding:16px 20px">
            ${topIndustries.map(([industry, count]) => `
              <div class="fn-row" style="margin-bottom:8px">
                <div class="fn-label" style="width:100px">${escapeHtml(industry)}</div>
                <div class="fn-track"><div class="fn-bar" style="width:${(count / maxIndustry) * 100}%"></div></div>
                <div class="fn-val">${count}</div>
              </div>
            `).join('') || '<p class="muted small" style="text-align:center;padding:20px">No lead data yet</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">Status Distribution</div>
          </div>
          <div class="card-body" style="padding:16px 20px">
            <div class="grid-2" style="gap:10px">
              ${Object.entries(statusBreakdown).sort((a, b) => b[1] - a[1]).map(([status, count]) => `
                <div class="att-item" style="border-top:none;padding:10px 0">
                  <div class="row" style="gap:8px">
                    ${statusBadge(status)}
                  </div>
                  <div style="font-weight:700;font-size:14px">${count}</div>
                </div>
              `).join('') || '<p class="muted small" style="text-align:center;padding:20px;grid-column:1/-1">No leads yet</p>'}
            </div>
          </div>
        </div>
      </div>
    </div>`;

  if (gen !== getRenderGeneration()) return;
  UI.renderView(html);
  UI.delegate('#view', '[data-action="export-report"]', 'click', () => {
    UI.toast('Export started — download will begin shortly.');
  });
}
