function renderReplies() {
  const replies = Store.getReplies();
  const unreadCount = Store.getUnreadRepliesCount();

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Replies</h1>
        <p class="page-sub">${replies.length} replies received · ${unreadCount} unread</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-action="mark-all-read">${icon('check')} Mark All Read</button>
      </div>
    </div>

    <div class="metrics" style="grid-template-columns:repeat(4,1fr)">
      ${metricCard('inbox', 'i-blue', replies.length, 'Total Replies')}
      ${metricCard('smilePlus', 'i-green', replies.filter(r => r.sentiment === 'positive').length, 'Positive')}
      ${metricCard('meh', 'i-amber', replies.filter(r => r.sentiment === 'neutral').length, 'Neutral')}
      ${metricCard('frown', 'i-red', replies.filter(r => r.sentiment === 'negative').length, 'Negative')}
    </div>

    <div class="card mt24">
      <div class="toolbar">
        <div class="chips" id="reply-filters">
          <button class="chip on" data-rfilter="all">All (${replies.length})</button>
          <button class="chip" data-rfilter="unread">Unread (${unreadCount})</button>
          <button class="chip" data-rfilter="positive">Positive</button>
          <button class="chip" data-rfilter="neutral">Neutral</button>
          <button class="chip" data-rfilter="negative">Negative</button>
        </div>
      </div>
      <div id="replies-list">
        ${repliesList(replies)}
      </div>
    </div>`;

  UI.renderView(html);
  bindReplyEvents(replies);
}

function repliesList(replies) {
  if (!replies.length) {
    return '<div style="text-align:center;padding:40px;color:var(--text-3)">No replies match your filters.</div>';
  }

  return replies.map(r => `
    <div class="reply-item ${!r.read ? 'unread' : ''}" data-reply="${r.id}">
      <div class="reply-head">
        <div class="row" style="gap:12px">
          ${avatar(r.leadName)}
          <div>
            <div class="cell-main">${r.leadName}</div>
            <div class="cell-sub">${r.company}</div>
          </div>
        </div>
        <div class="row" style="gap:8px">
          <span class="badge ${r.sentiment === 'positive' ? 'st-res' : r.sentiment === 'neutral' ? 'st-new' : 'st-dnc'}">${r.sentiment}</span>
          <span class="muted small">${UI.formatDate(r.receivedAt)}</span>
        </div>
      </div>
      <div class="reply-body">
        <div class="reply-subject">${icon('mail', 'ic-16')} ${r.subject}</div>
        <p class="reply-text">${r.body}</p>
      </div>
      <div class="reply-actions">
        <button class="btn btn-sm btn-primary" data-reply-action="reply" data-rid="${r.id}">${icon('reply')} Reply</button>
        <button class="btn btn-sm btn-secondary" data-reply-action="forward" data-rid="${r.id}">${icon('forward')} Forward</button>
        <button class="btn btn-sm btn-ghost" data-reply-action="view-lead" data-rid="${r.id}" data-lead-id="${r.leadId}">${icon('user')} View Lead</button>
      </div>
    </div>
  `).join('');
}

function bindReplyEvents(replies) {
  UI.delegate('#view', '[data-rfilter]', 'click', (e, el) => {
    UI.$$('[data-rfilter]', UI.el('#reply-filters')).forEach(c => c.classList.remove('on'));
    el.classList.add('on');
    const f = el.dataset.rfilter;
    let filtered;
    if (f === 'all') filtered = replies;
    else if (f === 'unread') filtered = replies.filter(r => !r.read);
    else filtered = replies.filter(r => r.sentiment === f);
    UI.html('#replies-list', repliesList(filtered));
  });

  UI.delegate('#view', '[data-reply]', 'click', (e, el) => {
    if (e.target.closest('[data-reply-action]')) return;
    const reply = replies.find(r => r.id === el.dataset.reply);
    if (reply) {
      Store.markReplyRead(reply.id);
      el.classList.remove('unread');
    }
  });

  UI.delegate('#view', '[data-reply-action="reply"]', 'click', (e, el) => {
    const reply = replies.find(r => r.id === el.dataset.rid);
    if (reply) showReplyComposer(reply);
  });

  UI.delegate('#view', '[data-reply-action="forward"]', 'click', (e, el) => {
    const reply = replies.find(r => r.id === el.dataset.rid);
    if (reply) showForwardComposer(reply);
  });

  UI.delegate('#view', '[data-reply-action="view-lead"]', 'click', (e, el) => {
    Store.navigate('leads', { selectedLeadId: el.dataset.leadId });
  });

  UI.delegate('#view', '[data-action="mark-all-read"]', 'click', () => {
    replies.forEach(r => Store.markReplyRead(r.id));
    UI.toast('All replies marked as read.');
    renderReplies();
    UI.buildSidebar();
  });
}

function showReplyComposer(reply) {
  const body = `
    <div class="form-grid">
      <div class="form-group">
        <label>To</label>
        <input type="email" value="${reply.leadEmail}" readonly style="background:var(--surface-2)">
      </div>
      <div class="form-group">
        <label>Subject</label>
        <input type="text" value="${reply.subject}" readonly style="background:var(--surface-2)">
      </div>
      <div class="form-group">
        <label>Original Message</label>
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;color:var(--text-2);max-height:120px;overflow-y:auto">${reply.body}</div>
      </div>
      <div class="form-group">
        <label>Your Reply</label>
        <textarea id="reply-body" class="notes-area" placeholder="Type your reply here..." style="min-height:140px"></textarea>
      </div>
    </div>`;

  const footer = `
    <button class="btn btn-secondary" data-close-modal>Cancel</button>
    <button class="btn btn-primary" id="send-reply-btn">${icon('send')} Send Reply</button>`;

  UI.modal(`Reply to ${reply.leadName}`, body, { wide: true, footer });

  setTimeout(() => {
    UI.on('#send-reply-btn', 'click', () => {
      const body = document.getElementById('reply-body').value.trim();
      if (!body) return UI.toast('Please write a reply.', 'error');
      Store.markReplyRead(reply.id);
      UI.closeModal();
      UI.toast(`Reply sent to ${reply.leadName}.`);
      renderReplies();
      UI.buildSidebar();
    });
  }, 50);
}

function showForwardComposer(reply) {
  const body = `
    <div class="form-grid">
      <div class="form-group">
        <label>Forward To</label>
        <input type="email" id="forward-to" placeholder="Enter email address">
      </div>
      <div class="form-group">
        <label>Subject</label>
        <input type="text" value="Fwd: ${reply.subject}" id="forward-subject">
      </div>
      <div class="form-group">
        <label>Original Message</label>
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;color:var(--text-2);max-height:120px;overflow-y:auto">${reply.body}</div>
      </div>
      <div class="form-group">
        <label>Add a Note (optional)</label>
        <textarea id="forward-note" class="notes-area" placeholder="Add a note to the forwarded message..." style="min-height:100px"></textarea>
      </div>
    </div>`;

  const footer = `
    <button class="btn btn-secondary" data-close-modal>Cancel</button>
    <button class="btn btn-primary" id="send-forward-btn">${icon('forward')} Forward</button>`;

  UI.modal(`Forward Reply from ${reply.leadName}`, body, { wide: true, footer });

  setTimeout(() => {
    UI.on('#send-forward-btn', 'click', () => {
      const to = document.getElementById('forward-to').value.trim();
      if (!to) return UI.toast('Please enter an email address.', 'error');
      UI.closeModal();
      UI.toast(`Reply forwarded to ${to}.`);
      Store.markReplyRead(reply.id);
      renderReplies();
      UI.buildSidebar();
    });
  }, 50);
}
