const TEMPLATE_CATEGORIES = { cold_intro: 'Cold Intro', follow_up: 'Follow Up', proposal: 'Proposal', thank_you: 'Thank You', custom: 'Custom' };

async function renderTemplates() {
  const gen = getRenderGeneration();
  const activeCategory = Store.get('templateCategory') || '';

  let templates = [];
  try {
    const params = {};
    if (activeCategory) params.category = activeCategory;
    templates = await API.templates.list(params);
    if (gen !== getRenderGeneration()) return;
    Store._state.templates = templates;
  } catch (err) {
    UI.toast('Failed to load templates: ' + err.message, 'error');
    templates = Store.get('templates') || [];
  }

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Email Templates</h1>
        <p class="page-sub">${templates.length} templates saved</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" data-action="add-template">${icon('plus')} New Template</button>
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="chips" id="template-filters">
          <button class="chip ${!activeCategory ? 'on' : ''}" data-template-cat="">All</button>
          ${Object.entries(TEMPLATE_CATEGORIES).map(([k, v]) =>
            `<button class="chip ${activeCategory === k ? 'on' : ''}" data-template-cat="${k}">${v}</button>`
          ).join('')}
        </div>
      </div>
      <div class="template-grid">
        ${templates.length ? templates.map(t => templateCard(t)).join('') : '<div style="text-align:center;padding:40px;color:var(--text-3)">No templates yet. Create one to reuse in campaigns.</div>'}
      </div>
    </div>`;

  if (gen !== getRenderGeneration()) return;
  UI.renderView(html);
  bindTemplateEvents();
}

function templateCard(t) {
  return `
    <div class="template-card" data-template-id="${t.id}">
      <div class="template-card-head">
        <span class="template-cat-badge">${escapeHtml(TEMPLATE_CATEGORIES[t.category] || t.category)}</span>
        <span class="template-usage">${t.usageCount || 0} uses</span>
      </div>
      <div class="template-card-name">${escapeHtml(t.name)}</div>
      ${t.subject ? `<div class="template-card-subject">${escapeHtml(t.subject)}</div>` : ''}
      <div class="template-card-preview">${escapeHtml((t.body || '').substring(0, 120))}${(t.body || '').length > 120 ? '...' : ''}</div>
      <div class="template-card-footer">
        <button class="ibtn" data-template-edit="${t.id}" title="Edit">${icon('edit', 'ic-14')}</button>
        <button class="ibtn" data-template-delete="${t.id}" title="Delete">${icon('trash', 'ic-14')}</button>
      </div>
    </div>`;
}

function bindTemplateEvents() {
  UI.delegate('#view', '[data-template-cat]', 'click', (e, el) => {
    Store.set('templateCategory', el.dataset.templateCat);
    renderTemplates();
  });

  UI.delegate('#view', '[data-action="add-template"]', 'click', () => showTemplateModal());

  UI.delegate('#view', '[data-template-edit]', 'click', async (e, el) => {
    e.stopPropagation();
    try {
      const template = await API.templates.get(el.dataset.templateEdit);
      showTemplateModal(template);
    } catch (err) {
      UI.toast('Failed to load template.', 'error');
    }
  });

  UI.delegate('#view', '[data-template-delete]', 'click', async (e, el) => {
    e.stopPropagation();
    if (confirm('Delete this template?')) {
      try {
        await API.templates.delete(el.dataset.templateDelete);
        UI.toast('Template deleted.');
        renderTemplates();
      } catch (err) {
        UI.toast('Delete failed: ' + err.message, 'error');
      }
    }
  });

  // Click card to view
  UI.delegate('#view', '[data-template-id]', 'click', async (e, el) => {
    if (e.target.closest('[data-template-edit]') || e.target.closest('[data-template-delete]')) return;
    try {
      const template = await API.templates.get(el.dataset.templateId);
      showTemplateDetail(template);
    } catch (err) {
      UI.toast('Failed to load template.', 'error');
    }
  });
}

function showTemplateModal(template = null) {
  const isEdit = !!template;
  const placeholders = ['{{firstName}}', '{{lastName}}', '{{company}}', '{{industry}}', '{{title}}', '{{name}}', '{{first_name}}', '{{company_name}}', '{{sender_name}}', '{{phone_number}}'];

  const body = `
    <form id="template-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Template Name</label>
          <input type="text" name="name" value="${escapeHtml(template?.name || '')}" placeholder="e.g. Cold Intro - Hospitality" required>
        </div>
        <div class="form-group">
          <label>Category</label>
          <select name="category">
            ${Object.entries(TEMPLATE_CATEGORIES).map(([k, v]) => `<option value="${k}" ${template?.category === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Subject Line</label>
        <input type="text" name="subject" value="${escapeHtml(template?.subject || '')}" placeholder="e.g. Partnership opportunity for {{company}}">
      </div>
      <div class="form-group">
        <label>Body (HTML supported)</label>
        <div class="template-placeholders">
          ${placeholders.map(p => `<button type="button" class="em-chip" data-ph="${p}">${p}</button>`).join('')}
        </div>
        <textarea name="body" rows="10" placeholder="<p>Hi {{firstName}},</p>&#10;&#10;<p>I'd love to discuss...</p>">${escapeHtml(template?.body || '')}</textarea>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" data-close-modal>Cancel</button>
    <button class="btn btn-primary" id="save-template-btn">${icon('save')} ${isEdit ? 'Update' : 'Create'} Template</button>`;

  UI.modal(isEdit ? 'Edit Template' : 'New Template', body, { wide: true, footer });

  // Placeholder insertion
  document.querySelectorAll('#template-form .em-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const ta = document.querySelector('#template-form textarea[name="body"]');
      ta.value += chip.dataset.ph;
      ta.focus();
    });
  });

  UI.on('#save-template-btn', 'click', async () => {
    const form = document.getElementById('template-form');
    const fd = new FormData(form);
    const data = {
      name: fd.get('name').trim(),
      subject: fd.get('subject').trim(),
      body: fd.get('body'),
      category: fd.get('category'),
    };
    if (!data.name) return UI.toast('Template name is required.', 'error');

    try {
      if (isEdit) {
        await API.templates.update(template.id, data);
        UI.toast('Template updated.');
      } else {
        await API.templates.create(data);
        UI.toast('Template created.');
      }
      UI.closeModal();
      renderTemplates();
    } catch (err) {
      UI.toast('Failed to save template: ' + err.message, 'error');
    }
  });
}

function showTemplateDetail(template) {
  const body = `
    <div class="template-detail">
      <div class="template-detail-row">
        <span class="info-label">Category</span>          <span class="template-cat-badge">${escapeHtml(TEMPLATE_CATEGORIES[template.category] || template.category)}</span>
      </div>
      <div class="template-detail-row">
        <span class="info-label">Subject</span>
        <span>${escapeHtml(template.subject || '(none)')}</span>
      </div>
      <div class="template-detail-row">
        <span class="info-label">Times Used</span>
        <span>${template.usageCount || 0}</span>
      </div>
      <div class="template-detail-row" style="flex-direction:column;gap:4px">
        <span class="info-label">Body Preview</span>
        <div class="template-preview-box" style="white-space:pre-wrap">${escapeHtml(template.body || '') || '<em>Empty</em>'}</div>
      </div>
    </div>`;

  const footer = `
    <button class="btn btn-secondary" data-close-modal>Close</button>
    <button class="btn btn-primary" id="template-edit-btn">${icon('edit')} Edit</button>`;

  UI.modal(template.name, body, { wide: true, footer });

  UI.on('#template-edit-btn', 'click', () => {
    UI.closeModal();
    setTimeout(() => showTemplateModal(template), 250);
  });
}
