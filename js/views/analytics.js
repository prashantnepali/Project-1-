async function renderAnalytics() {
  let leads = Store.get('leads') || [];
  let metrics = { totalLeads: 0, newLeads: 0, qualified: 0, avgScore: 0 };

  try {
    leads = await API.leads.list();
    Store._state.leads = leads;
    metrics = await API.leads.metrics();
  } catch (err) {
    metrics = Store.getMetrics();
  }

  const campaigns = Store.getCampaigns();

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

  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Analytics</h1>
        <p class="page-sub">Performance insights across your lead engine.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="export-report">${icon('download')} Export Report</button>
      </div>
    </div>

    <div class="metrics">
      ${metricCard('users', 'i-indigo', metrics.totalLeads, 'Total Leads')}
      ${metricCard('trendingUp', 'i-green', metrics.avgScore, 'Avg Score')}
      ${metricCard('send', 'i-blue', UI.formatNumber(totalSent), 'Emails Sent')}
      ${metricCard('zap', 'i-amber', activeCampaigns, 'Active Campaigns')}
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

        <div class="card">
          <div class="card-head">
            <div class="card-title">Campaign Performance</div>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Campaign</th><th>Status</th><th>Sent</th><th>Open %</th><th>Reply %</th></tr>
              </thead>
              <tbody>
                ${campaigns.filter(c => c.sent > 0).slice(0, 6).map(c => {
                  const openRate = Math.round((c.opened / c.sent) * 100);
                  const replyRate = Math.round((c.replied / c.sent) * 100);
                  return `
                    <tr>
                      <td><div class="cell-main" style="font-size:12.5px">${escapeHtml(c.name)}</div></td>
                      <td>${campaignBadge(c.status)}</td>
                      <td>${c.sent}</td>
                      <td>${openRate}%</td>
                      <td>${replyRate}%</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;

  UI.renderView(html);
  UI.delegate('#view', '[data-action="export-report"]', 'click', () => {
    UI.toast('Export started — download will begin shortly.');
  });
}
