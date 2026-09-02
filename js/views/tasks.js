const TASK_TYPES = { follow_up: 'Follow Up', call: 'Call', meeting: 'Meeting', email: 'Email', note: 'Note' };
const TASK_TYPE_ICONS = { follow_up: 'clock', call: 'phone', meeting: 'calendar', email: 'mail', note: 'edit' };
const TASK_PRIORITY_CLS = { high: 'prio-high', medium: 'prio-med', low: 'prio-low' };

async function renderTasks() {
  const gen = getRenderGeneration();
  const activeFilter = Store.get('taskFilter') || 'pending';

  let tasks = [];
  let stats = { total: 0, overdue: 0, pending: 0, completed: 0 };

  try {
    const params = {};
    if (activeFilter === 'pending') params.completed = 'false';
    if (activeFilter === 'completed') params.completed = 'true';
    if (activeFilter === 'overdue') params.overdue = 'true';

    tasks = await API.tasks.list(params);
    stats = await API.tasks.stats();
    if (gen !== getRenderGeneration()) return;
    Store._state.tasks = tasks;
  } catch (err) {
    UI.toast('Failed to load tasks: ' + err.message, 'error');
    tasks = Store.get('tasks') || [];
  }

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Tasks</h1>
        <p class="page-sub">${stats.pending} pending · ${stats.overdue} overdue · ${stats.completed} completed</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="export-tasks">${icon('download')} Export</button>
        <button class="btn btn-primary" data-action="add-task">${icon('plus')} New Task</button>
      </div>
    </div>

    <div class="metrics" style="grid-template-columns:repeat(4,1fr)">
      ${metricCard('list', 'i-indigo', stats.total, 'Total Tasks')}
      ${metricCard('clock', 'i-amber', stats.pending, 'Pending')}
      ${metricCard('alertTriangle', 'i-red', stats.overdue, 'Overdue')}
      ${metricCard('checkCircle', 'i-green', stats.completed, 'Completed')}
    </div>

    <div class="card mt24">
      <div class="toolbar">
        <div class="chips" id="task-filters">
          <button class="chip ${activeFilter === 'pending' ? 'on' : ''}" data-task-filter="pending">Pending (${stats.pending})</button>
          <button class="chip ${activeFilter === 'overdue' ? 'on' : ''}" data-task-filter="overdue">Overdue (${stats.overdue})</button>
          <button class="chip ${activeFilter === 'completed' ? 'on' : ''}" data-task-filter="completed">Completed (${stats.completed})</button>
          <button class="chip ${activeFilter === 'all' ? 'on' : ''}" data-task-filter="all">All (${stats.total})</button>
        </div>
      </div>
      <div class="task-list">
        ${tasks.length ? tasks.map(t => taskItem(t)).join('') : '<div style="text-align:center;padding:40px;color:var(--text-3)">No tasks match this filter.</div>'}
      </div>
    </div>`;

  if (gen !== getRenderGeneration()) return;
  UI.renderView(html);
  bindTasksEvents();
}

function taskItem(t) {
  const isOverdue = !t.completedAt && t.dueDate && new Date(t.dueDate) < new Date();
  const isCompleted = !!t.completedAt;

  return `
    <div class="task-item ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}">
      <div class="task-check">
        <button class="task-toggle ${isCompleted ? 'done' : ''}" data-task-toggle="${t.id}" data-completed="${isCompleted ? 'true' : 'false'}" title="${isCompleted ? 'Mark pending' : 'Mark complete'}">
          ${isCompleted ? icon('checkCircle') : icon('circle')}
        </button>
      </div>
      <div class="task-body">
        <div class="task-title ${isCompleted ? 'strikethrough' : ''}">${escapeHtml(t.title)}</div>
        <div class="task-meta">
          <span class="task-type-badge">${icon(TASK_TYPE_ICONS[t.type] || 'activity', 'ic-12')} ${TASK_TYPES[t.type] || t.type}</span>
          <span class="prio ${TASK_PRIORITY_CLS[t.priority] || ''}">${t.priority || 'medium'}</span>
          ${t.dueDate ? `<span class="task-due ${isOverdue ? 'overdue-text' : ''}">${icon('calendar', 'ic-12')} ${UI.formatDate(t.dueDate)}</span>` : ''}
          ${t.leadName ? `<span class="task-lead">${icon('user', 'ic-12')} ${escapeHtml(t.leadName)}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="ibtn" data-task-edit="${t.id}" title="Edit">${icon('edit', 'ic-14')}</button>
        <button class="ibtn" data-task-delete="${t.id}" title="Delete">${icon('trash', 'ic-14')}</button>
      </div>
    </div>`;
}

function bindTasksEvents() {
  UI.delegate('#view', '[data-task-filter]', 'click', (e, el) => {
    Store.set('taskFilter', el.dataset.taskFilter);
    renderTasks();
  });

  UI.delegate('#view', '[data-action="add-task"]', 'click', () => showTaskModal());

  UI.delegate('#view', '[data-action="export-tasks"]', 'click', async () => {
    try {
      await API.export.tasks();
      UI.toast('Tasks exported.');
    } catch (err) {
      UI.toast('Export failed: ' + err.message, 'error');
    }
  });

  UI.delegate('#view', '[data-task-toggle]', 'click', async (e, el) => {
    e.stopPropagation();
    const completed = el.dataset.completed === 'true';
    try {
      await API.tasks.update(el.dataset.taskToggle, { completed: !completed });
      UI.toast(completed ? 'Task reopened.' : 'Task completed!');
      renderTasks();
    } catch (err) {
      UI.toast('Failed to update task: ' + err.message, 'error');
    }
  });

  UI.delegate('#view', '[data-task-edit]', 'click', async (e, el) => {
    e.stopPropagation();
    try {
      const task = await API.tasks.get(el.dataset.taskEdit);
      showTaskModal(task);
    } catch (err) {
      UI.toast('Failed to load task.', 'error');
    }
  });

  UI.delegate('#view', '[data-task-delete]', 'click', async (e, el) => {
    e.stopPropagation();
    if (confirm('Delete this task?')) {
      try {
        await API.tasks.delete(el.dataset.taskDelete);
        UI.toast('Task deleted.');
        renderTasks();
      } catch (err) {
        UI.toast('Delete failed: ' + err.message, 'error');
      }
    }
  });
}

async function showTaskModal(task = null) {
  let leads = [];
  try { leads = await API.leads.list(); } catch (e) {}

  const isEdit = !!task;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDue = tomorrow.toISOString().split('T')[0];

  const body = `
    <form id="task-form" class="form-grid">
      <div class="form-group">
        <label>Title</label>
        <input type="text" name="title" value="${escapeHtml(task?.title || '')}" placeholder="e.g. Follow up with Hilton manager" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type</label>
          <select name="type">
            ${Object.entries(TASK_TYPES).map(([k, v]) => `<option value="${k}" ${task?.type === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select name="priority">
            <option value="low" ${task?.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${(!task || task?.priority === 'medium') ? 'selected' : ''}>Medium</option>
            <option value="high" ${task?.priority === 'high' ? 'selected' : ''}>High</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Due Date</label>
          <input type="date" name="dueDate" value="${task?.dueDate ? task.dueDate.split('T')[0] : defaultDue}">
        </div>
        <div class="form-group">
          <label>Linked Lead</label>
          <select name="leadId">
            <option value="">None</option>
            ${leads.map(l => `<option value="${l.id}" ${task?.leadId === l.id ? 'selected' : ''}>${escapeHtml(l.name)} — ${escapeHtml(l.company || '')}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea name="description" rows="3" placeholder="Optional notes...">${escapeHtml(task?.description || '')}</textarea>
      </div>
    </form>`;

  const footer = `
    <button class="btn btn-secondary" data-close-modal>Cancel</button>
    <button class="btn btn-primary" id="save-task-btn">${icon('save')} ${isEdit ? 'Update' : 'Create'} Task</button>`;

  UI.modal(isEdit ? 'Edit Task' : 'New Task', body, { footer });

  UI.on('#save-task-btn', 'click', async () => {
    const form = document.getElementById('task-form');
    const fd = new FormData(form);
    const data = {
      title: fd.get('title').trim(),
      type: fd.get('type'),
      priority: fd.get('priority'),
      dueDate: fd.get('dueDate') || null,
      leadId: fd.get('leadId') || null,
      description: fd.get('description').trim(),
    };
    if (!data.title) return UI.toast('Task title is required.', 'error');

    try {
      if (isEdit) {
        await API.tasks.update(task.id, data);
        UI.toast('Task updated.');
      } else {
        await API.tasks.create(data);
        UI.toast('Task created.');
      }
      UI.closeModal();
      renderTasks();
    } catch (err) {
      UI.toast('Failed to save task: ' + err.message, 'error');
    }
  });
}
