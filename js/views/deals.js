const DEAL_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const DEAL_STAGE_LABELS = { lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', won: 'Won', lost: 'Lost' };
const DEAL_STAGE_ICONS = { lead: 'circle', qualified: 'target', proposal: 'fileText', negotiation: 'messageSquare', won: 'checkCircle', lost: 'xCircle' };

async function renderDeals() {
  const gen = getRenderGeneration();

  let deals = [];
  let metrics = { totalDeals: 0, wonValue: 0, pipelineValue: 0, conversionRate: '0.0' };

  try {
    deals = await API.deals.list();
    metrics = await API.deals.metrics();
    if (gen !== getRenderGeneration()) return;
    Store._state.deals = deals;
  } catch (err) {
    UI.toast('Failed to load deals: ' + err.message, 'error');
    deals = Store.get('deals') || [];
  }

  const formatCurrency = (v) => {
    if (v >= 1000000) return 'Rs ' + (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return 'Rs ' + (v / 1000).toFixed(1) + 'K';
    return 'Rs ' + (v || 0).toFixed(0);
  };

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Deals</h1>
        <p class="page-sub">${metrics.totalDeals} deals · ${formatCurrency(metrics.pipelineValue)} pipeline</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="export-deals">${icon('download')} Export</button>
        <button class="btn btn-primary" data-action="add-deal">${icon('plus')} New Deal</button>
      </div>
    </div>

    <div class="metrics" style="grid-template-columns:repeat(4,1fr)">
      ${metricCard('target', 'i-indigo', metrics.totalDeals, 'Total Deals')}
      ${metricCard('dollarSign', 'i-green', formatCurrency(metrics.wonValue), 'Won Value')}
      ${metricCard('trendingUp', 'i-blue', formatCurrency(metrics.pipelineValue), 'Pipeline Value')}
      ${metricCard('barChart', 'i-amber', metrics.conversionRate + '%', 'Win Rate')}
    </div>

    <div class="deal-board mt24">
      ${DEAL_STAGES.map(stage => {
        const stageDeals = deals.filter(d => d.stage === stage);
        const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
        return `
          <div class="deal-col">
            <div class="deal-col-head">
              <span class="deal-col-title">${DEAL_STAGE_LABELS[stage]} <span class="deal-col-count">${stageDeals.length}</span></span>
              <span class="deal-col-value">${formatCurrency(stageValue)}</span>
            </div>
            <div class="deal-col-body">
              ${stageDeals.length ? stageDeals.map(d => `
                <div class="deal-card" data-deal-id="${d.id}">
                  <div class="deal-card-name">${escapeHtml(d.name)}</div>
                  <div class="deal-card-value">${formatCurrency(d.value)}</div>
                  ${d.leadName ? `<div class="deal-card-lead">${icon('user', 'ic-12')} ${escapeHtml(d.leadName)}</div>` : ''}
                  <div class="deal-card-meta">
                    <span class="deal-card-prob">${d.probability || 0}%</span>
                    ${d.expectedCloseDate ? `<span class="deal-card-date">${UI.formatDate(d.expectedCloseDate)}</span>` : ''}
                  </div>
                  <div class="deal-card-actions">
                    <button class="ibtn" data-deal-edit="${d.id}" title="Edit">${icon('edit', 'ic-14')}</button>
                    <button class="ibtn" data-deal-delete="${d.id}" title="Delete">${icon('trash', 'ic-14')}</button>
                  </div>
                </div>
              `).join('') : '<div class="deal-empty">No deals</div>'}
            </div>
          </div>
        `;
      }).join('')}
    </div>`;

  if (gen !== getRenderGeneration()) return;
  UI.renderView(html);
  bindDealsEvents();
}

function bindDealsEvents() {
  UI.delegate('#view', '[data-action="add-deal"]', 'click', () => showDealModal());

  UI.delegate('#view', '[data-action="export-deals"]', 'click', async () => {
    try {
      await API.export.deals();
      UI.toast('Deals exported.');
    } catch (err) {
      UI.toast('Export failed: ' + err.message, 'error');
    }
  });

  UI.delegate('#view', '[data-deal-edit]', 'click', async (e, el) => {
    e.stopPropagation();
    try {
      const deal = await API.deals.get(el.dataset.dealEdit);
      showDealModal(deal);
    } catch (err) {
      UI.toast('Failed to load deal: ' + err.message, 'error');
    }
  });

  UI.delegate('#view', '[data-deal-delete]', 'click', async (e, el) => {
    e.stopPropagation();
    if (confirm('Delete this deal?')) {
      try {
        await API.deals.delete(el.dataset.dealDelete);
        UI.toast('Deal deleted.');
        renderDeals();
      } catch (err) {
        UI.toast('Delete failed: ' + err.message, 'error');
      }
    }
  });

  // Click card to view detail
  UI.delegate('#view', '[data-deal-id]', 'click', async (e, el) => {
    if (e.target.closest('[data-deal-edit]') || e.target.closest('[data-deal-delete]')) return;
    try {
      const deal = await API.deals.get(el.dataset.dealId);
      showDealDetail(deal);
    } catch (err) {
      UI.toast('Failed to load deal.', 'error');
    }
  });
}

async function showDealModal(deal = null) {
  let leads = [];
  try { leads = await API.leads.list(); } catch (e) {}

  const isEdit = !!deal;
  const body = `
    <form id="deal-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Deal Name</label>
          <input type="text" name="name" value="${escapeHtml(deal?.name || '')}" placeholder="e.g. Samparka for Hilton Delhi" required>
        </div>
        <div class="form-group">
          <label>Value ($)</label>
          <input type="number" name="value" value="${deal?.value || ''}" placeholder="0" min="0" step="100">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Stage</label>
          <select name="stage">
            ${DEAL_STAGES.map(s => `<option value="${s}" ${deal?.stage === s ? 'selected' : ''}>${DEAL_STAGE_LABELS[s]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Probability (%)</label>
          <input type="number" name="probability" value="${deal?.probability || 10}" min="0" max="100">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Linked Lead</label>
          <select name="leadId">
            <option value="">None</option>
            ${leads.map(l => `<option value="${l.id}" ${deal?.leadId === l.id ? 'selected' : ''}>${escapeHtml(l.name)} — ${escapeHtml(l.company || '')}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Expected Close</label>
          <input type="date" name="expectedCloseDate" value="${deal?.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea name="notes" rows="3" placeholder="Deal notes...">${escapeHtml(deal?.notes || '')}</textarea>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" data-close-modal>Cancel</button>
    <button class="btn btn-primary" id="save-deal-btn">${icon('save')} ${isEdit ? 'Update' : 'Create'} Deal</button>`;

  UI.modal(isEdit ? 'Edit Deal' : 'New Deal', body, { footer });

  UI.on('#save-deal-btn', 'click', async () => {
    const form = document.getElementById('deal-form');
    const fd = new FormData(form);
    const data = {
      name: fd.get('name').trim(),
      value: parseFloat(fd.get('value')) || 0,
      stage: fd.get('stage'),
      probability: parseInt(fd.get('probability')) || 10,
      leadId: fd.get('leadId') || null,
      expectedCloseDate: fd.get('expectedCloseDate') || null,
      notes: fd.get('notes').trim(),
    };
    if (!data.name) return UI.toast('Deal name is required.', 'error');

    try {
      if (isEdit) {
        await API.deals.update(deal.id, data);
        UI.toast('Deal updated.');
      } else {
        await API.deals.create(data);
        UI.toast('Deal created.');
      }
      UI.closeModal();
      renderDeals();
    } catch (err) {
      UI.toast('Failed to save deal: ' + err.message, 'error');
    }
  });
}

function showDealDetail(deal) {
  const formatCurrency = (v) => 'Rs ' + (v || 0).toLocaleString();

  const body = `
    <div class="deal-detail">
      <div class="deal-detail-row">
        <span class="info-label">Value</span>
        <span style="font-weight:700;font-size:18px;color:var(--brand)">${formatCurrency(deal.value)}</span>
      </div>
      <div class="deal-detail-row">
        <span class="info-label">Stage</span>
        <span class="badge">${DEAL_STAGE_LABELS[deal.stage] || deal.stage}</span>
      </div>
      <div class="deal-detail-row">
        <span class="info-label">Probability</span>
        <span>${deal.probability || 0}%</span>
      </div>
      ${deal.leadName ? `<div class="deal-detail-row"><span class="info-label">Lead</span><span>${escapeHtml(deal.leadName)}${deal.leadCompany ? ' — ' + escapeHtml(deal.leadCompany) : ''}</span></div>` : ''}
      ${deal.expectedCloseDate ? `<div class="deal-detail-row"><span class="info-label">Expected Close</span><span>${UI.formatDate(deal.expectedCloseDate)}</span></div>` : ''}
      ${deal.actualCloseDate ? `<div class="deal-detail-row"><span class="info-label">Closed</span><span>${UI.formatDate(deal.actualCloseDate)}</span></div>` : ''}
      ${deal.notes ? `<div class="deal-detail-row" style="flex-direction:column;gap:4px"><span class="info-label">Notes</span><p class="muted small">${escapeHtml(deal.notes)}</p></div>` : ''}
    </div>`;

  const footer = `
    <button class="btn btn-secondary" data-close-modal>Close</button>
    <button class="btn btn-primary" id="deal-edit-btn">${icon('edit')} Edit</button>`;

  UI.modal(deal.name, body, { footer });

  UI.on('#deal-edit-btn', 'click', () => {
    UI.closeModal();
    setTimeout(() => showDealModal(deal), 250);
  });
}
