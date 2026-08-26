let _replies = [];

async function renderReplies() {
  const gen = getRenderGeneration();
  const view = UI.el('#view');
  if (!view) return;
  view.innerHTML = '<div class="loading">Loading replies...</div>';

  try {
    _replies = await API.emails.replies();
  } catch (e) {
    _replies = [];
  }

  if (gen !== getRenderGeneration()) return;

  const positive = _replies.filter(r => r.sentiment === 'positive').length;
  const neutral = _replies.filter(r => r.sentiment === 'neutral').length;
  const negative = _replies.filter(r => r.sentiment === 'negative').length;

  let accounts = [];
  try {
    accounts = await API.accounts.list();
  } catch (e) {}

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Replies</h1>
        <p class="page-sub">${_replies.length} replies received</p>
      </div>
      <div class="page-actions">
        ${accounts.length ? `<button class="btn btn-secondary" data-action="sync-replies">${icon('refreshCw')} Sync Replies</button>` : ''}
        ${!accounts.length ? `<p class="muted small" style="color:var(--accent)">Connect Gmail in Settings to receive replies</p>` : ''}
      </div>
    </div>

    <div class="metrics" style="grid-template-columns:repeat(4,1fr)">
      ${metricCard('inbox', 'i-blue', _replies.length, 'Total Replies')}
      ${metricCard('smilePlus', 'i-green', positive, 'Positive')}
      ${metricCard('meh', 'i-amber', neutral, 'Neutral')}
      ${metricCard('frown', 'i-red', negative, 'Negative')}
    </div>

    <div class="card mt24">
      <div class="toolbar">
        <div class="chips" id="reply-filters">
          <button class="chip on" data-rfilter="all">All (${_replies.length})</button>
          <button class="chip" data-rfilter="positive">Positive</button>
          <button class="chip" data-rfilter="neutral">Neutral</button>
          <button class="chip" data-rfilter="negative">Negative</button>
        </div>
      </div>
      <div id="replies-list">
        ${repliesList(_replies)}
      </div>
    </div>`;

  if (gen !== getRenderGeneration()) return;
  UI.renderView(html);
  bindReplyEvents();
}

function repliesList(replies) {
  if (!replies.length) {
    return '<div style="text-align:center;padding:40px;color:var(--text-3)">No replies yet. Connect Gmail and sync to fetch replies.</div>';
  }

  return replies.map(r => `
    <div class="reply-item" data-reply="${r.id}">
      <div class="reply-head">
        <div class="row" style="gap:12px">
          ${avatar(r.fromEmail || 'Unknown')}
          <div>
            <div class="cell-main">${escapeHtml(r.fromEmail || 'Unknown')}</div>
            <div class="cell-sub">${escapeHtml(r.subject || '')}</div>
          </div>
        </div>
        <div class="row" style="gap:8px">
          <span class="badge ${r.sentiment === 'positive' ? 'st-res' : r.sentiment === 'neutral' ? 'st-new' : 'st-dnc'}">${r.sentiment || 'neutral'}</span>
          <span class="muted small">${UI.formatDate(r.receivedAt || r.createdAt)}</span>
        </div>
      </div>
      <div class="reply-body">
        <div class="reply-subject">${icon('mail', 'ic-16')} ${escapeHtml(r.subject || 'No subject')}</div>
        <p class="reply-text">${escapeHtml(r.snippet || r.body || '')}</p>
      </div>
      <div class="reply-actions">
        <button class="btn btn-sm btn-primary" data-reply-action="reply" data-rid="${r.id}">${icon('reply')} Reply</button>
        <button class="btn btn-sm btn-secondary" data-reply-action="forward" data-rid="${r.id}">${icon('forward')} Forward</button>
        ${r.leadId ? `<button class="btn btn-sm btn-ghost" data-reply-action="view-lead" data-lead-id="${r.leadId}">${icon('user')} View Lead</button>` : ''}
      </div>
    </div>
  `).join('');
}

function bindReplyEvents() {
  UI.delegate('#view', '[data-rfilter]', 'click', (e, el) => {
    UI.$$('[data-rfilter]', UI.el('#reply-filters')).forEach(c => c.classList.remove('on'));
    el.classList.add('on');
    const f = el.dataset.rfilter;
    const filtered = f === 'all' ? _replies : _replies.filter(r => r.sentiment === f);
    UI.html('#replies-list', repliesList(filtered));
  });

  UI.delegate('#view', '[data-reply-action="reply"]', 'click', (e, el) => {
    e.stopPropagation();
    const reply = _replies.find(r => r.id === el.dataset.rid);
    if (reply) showReplyComposer(reply);
  });

  UI.delegate('#view', '[data-reply-action="forward"]', 'click', (e, el) => {
    e.stopPropagation();
    const reply = _replies.find(r => r.id === el.dataset.rid);
    if (reply) showForwardComposer(reply);
  });

  UI.delegate('#view', '[data-reply-action="view-lead"]', 'click', (e, el) => {
    e.stopPropagation();
    Store.navigate('leads', { selectedLeadId: el.dataset.leadId });
  });

  UI.delegate('#view', '[data-action="sync-replies"]', 'click', async () => {
    try {
      const accounts = await API.accounts.list();
      if (!accounts.length) return UI.toast('No connected accounts');
      UI.toast('Syncing replies...');
      const result = await API.emails.syncReplies(accounts[0].id);
      UI.toast(`Synced ${result.synced} new replies from ${result.total} messages.`);
      renderReplies();
    } catch (err) {
      UI.toast('Sync failed: ' + err.message);
    }
  });
}

async function showReplyComposer(reply) {
  let accounts = [];
  try {
    accounts = await API.accounts.list();
  } catch (e) {}

  const body = `
    <div class="form-grid">
      <div class="form-group">
        <label>To</label>
        <input type="email" value="${escapeHtml(reply.fromEmail || '')}" readonly style="background:var(--surface-2)">
      </div>
      <div class="form-group">
        <label>From Account</label>
        <select class="form-input" id="reply-account">
          ${accounts.map(a => `<option value="${a.id}">${a.email}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Subject</label>
        <input type="text" value="Re: ${escapeHtml(reply.subject || '')}" id="reply-subject" readonly style="background:var(--surface-2)">
      </div>
      <div class="form-group">
        <label>Original Message</label>
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;color:var(--text-2);max-height:120px;overflow-y:auto">${escapeHtml(reply.body || reply.snippet || '')}</div>
      </div>
      <div class="form-group">
        <label>Your Reply</label>
        <textarea id="reply-body" class="notes-area" placeholder="Type your reply here..." style="min-height:140px"></textarea>
      </div>
    </div>`;

  const footer = `
    <button class="btn btn-secondary" data-close-modal>Cancel</button>
    <button class="btn btn-primary" id="send-reply-btn">${icon('send')} Send Reply</button>`;

  UI.modal(`Reply to ${reply.fromEmail || 'Unknown'}`, body, { wide: true, footer });

  UI.on('#send-reply-btn', 'click', async () => {
    const replyBody = document.getElementById('reply-body').value.trim();
    const accountId = document.getElementById('reply-account')?.value;
    if (!replyBody) return UI.toast('Please write a reply.', 'error');
    if (!accountId) return UI.toast('No sender account selected', 'error');

    try {
      await API.emails.send({
        accountId,
        to: reply.fromEmail,
        subject: `Re: ${reply.subject || ''}`,
        html: replyBody,
        leadId: reply.leadId,
        inReplyTo: reply.messageId
      });
      UI.closeModal();
      UI.toast('Reply sent successfully.');
      renderReplies();
    } catch (err) {
      UI.toast('Failed to send: ' + err.message);
    }
  });
}

async function showForwardComposer(reply) {
  let accounts = [];
  try {
    accounts = await API.accounts.list();
  } catch (e) {}

  const body = `
    <div class="form-grid">
      <div class="form-group">
        <label>Forward To</label>
        <input type="email" id="forward-to" placeholder="Enter email address">
      </div>
      <div class="form-group">
        <label>From Account</label>
        <select class="form-input" id="forward-account">
          ${accounts.map(a => `<option value="${a.id}">${a.email}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Subject</label>
        <input type="text" value="Fwd: ${escapeHtml(reply.subject || '')}" id="forward-subject">
      </div>
      <div class="form-group">
        <label>Original Message</label>
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;color:var(--text-2);max-height:120px;overflow-y:auto">${escapeHtml(reply.body || reply.snippet || '')}</div>
      </div>
      <div class="form-group">
        <label>Add a Note (optional)</label>
        <textarea id="forward-note" class="notes-area" placeholder="Add a note to the forwarded message..." style="min-height:100px"></textarea>
      </div>
    </div>`;

  const footer = `
    <button class="btn btn-secondary" data-close-modal>Cancel</button>
    <button class="btn btn-primary" id="send-forward-btn">${icon('forward')} Forward</button>`;

  UI.modal(`Forward Reply from ${reply.fromEmail || 'Unknown'}`, body, { wide: true, footer });

  UI.on('#send-forward-btn', 'click', async () => {
    const to = document.getElementById('forward-to').value.trim();
    const accountId = document.getElementById('forward-account')?.value;
    const subject = document.getElementById('forward-subject')?.value;
    const note = document.getElementById('forward-note')?.value?.trim();
    if (!to) return UI.toast('Please enter an email address.', 'error');
    if (!accountId) return UI.toast('No sender account selected', 'error');

    const fwdBody = `${note ? note + '\n\n---------- Forwarded message ----------\n' : ''}${reply.body || reply.snippet || ''}`;

    try {
      await API.emails.send({ accountId, to, subject, html: fwdBody });
      UI.closeModal();
      UI.toast(`Reply forwarded to ${to}.`);
    } catch (err) {
      UI.toast('Failed to forward: ' + err.message);
    }
  });
}
