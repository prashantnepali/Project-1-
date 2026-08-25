async function renderTeam() {
  const view = document.getElementById('view');
  const user = Auth.user;

  view.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Team Management</h2>
        <p class="page-desc">Manage your team members and roles</p>
      </div>
      <button class="btn btn-primary" id="btn-create-team">
        ${SVGIcons.plus} Create Team
      </button>
    </div>
    <div id="team-content" class="team-content">
      <div class="loading-state">Loading teams...</div>
    </div>
  `;

  const content = view.querySelector('#team-content');

  async function loadTeams() {
    try {
      const teams = await API.teams.list();

      if (!teams.length) {
        content.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">${SVGIcons.users}</div>
            <h3>No teams yet</h3>
            <p>Create a team to collaborate with others on leads.</p>
          </div>
        `;
        return;
      }

      let html = '<div class="team-list">';
      for (const team of teams) {
        html += `
          <div class="team-card" data-team-id="${team.id}">
            <div class="team-card-header">
              <h3 class="team-name">${esc(team.name)}</h3>
              <span class="badge">${team.memberCount} member${team.memberCount !== 1 ? 's' : ''}</span>
            </div>
            <div class="team-card-meta">
              Created ${formatRelativeTime(team.createdAt)}
            </div>
            <button class="btn btn-sm btn-outline team-manage-btn" data-team-id="${team.id}">Manage</button>
          </div>
        `;
      }
      html += '</div>';
      content.innerHTML = html;

      content.querySelectorAll('.team-manage-btn').forEach(btn => {
        btn.addEventListener('click', () => loadTeamDetail(btn.dataset.teamId));
      });
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><p>Failed to load teams: ${esc(err.message)}</p></div>`;
    }
  }

  async function loadTeamDetail(teamId) {
    try {
      const team = await API.teams.get(teamId);
      let html = `
        <button class="btn btn-sm btn-ghost" id="back-to-teams">${SVGIcons.arrowLeft} Back to teams</button>
        <div class="team-detail-header">
          <h3>${esc(team.name)}</h3>
          <span class="badge">Your role: ${esc(team.yourRole)}</span>
        </div>
      `;

      if (team.yourRole === 'admin') {
        html += `
          <div class="invite-form">
            <input type="email" class="form-input" id="invite-email" placeholder="Invite by email...">
            <select class="form-input" id="invite-role" style="width:120px">
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button class="btn btn-primary btn-sm" id="btn-invite">Invite</button>
          </div>
        `;
      }

      html += '<div class="member-list">';
      for (const member of team.members) {
        const isYou = member.id === user.id;
        html += `
          <div class="member-row">
            <div class="member-avatar">${(member.name || '?')[0].toUpperCase()}</div>
            <div class="member-info">
              <div class="member-name">${esc(member.name)}${isYou ? ' (you)' : ''}</div>
              <div class="member-email">${esc(member.email)}</div>
            </div>
            <span class="badge">${esc(member.role)}</span>
            ${team.yourRole === 'admin' && !isYou ? `
              <select class="form-input member-role-select" data-user-id="${member.id}" style="width:100px">
                <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
                <option value="member" ${member.role === 'member' ? 'selected' : ''}>Member</option>
                <option value="viewer" ${member.role === 'viewer' ? 'selected' : ''}>Viewer</option>
              </select>
              <button class="btn btn-sm btn-danger member-remove-btn" data-user-id="${member.id}">Remove</button>
            ` : ''}
          </div>
        `;
      }
      html += '</div>';
      content.innerHTML = html;

      content.querySelector('#back-to-teams').addEventListener('click', loadTeams);

      const inviteBtn = content.querySelector('#btn-invite');
      if (inviteBtn) {
        inviteBtn.addEventListener('click', async () => {
          const email = content.querySelector('#invite-email').value.trim();
          const role = content.querySelector('#invite-role').value;
          if (!email) return;
          try {
            await API.teams.invite(teamId, email, role);
            UI.toast('Member invited');
            loadTeamDetail(teamId);
          } catch (err) {
            UI.toast(err.message, 'error');
          }
        });
      }

      content.querySelectorAll('.member-role-select').forEach(sel => {
        sel.addEventListener('change', async () => {
          try {
            await API.teams.updateRole(teamId, sel.dataset.userId, sel.value);
            UI.toast('Role updated');
          } catch (err) {
            UI.toast(err.message, 'error');
            loadTeamDetail(teamId);
          }
        });
      });

      content.querySelectorAll('.member-remove-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Remove this member?')) return;
          try {
            await API.teams.removeMember(teamId, btn.dataset.userId);
            UI.toast('Member removed');
            loadTeamDetail(teamId);
          } catch (err) {
            UI.toast(err.message, 'error');
          }
        });
      });
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><p>Failed to load team: ${esc(err.message)}</p></div>`;
    }
  }

  view.querySelector('#btn-create-team').addEventListener('click', async () => {
    const name = prompt('Team name:');
    if (!name) return;
    try {
      const team = await API.teams.create(name);
      Auth._user.teamId = team.id;
      localStorage.setItem('samparka_user', JSON.stringify(Auth._user));
      UI.toast('Team created');
      loadTeams();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });

  loadTeams();
}
