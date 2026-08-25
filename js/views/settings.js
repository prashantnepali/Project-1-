function renderSettings() {
  const settings = Store.get('settings');

  const html = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="page-sub">Configure your Samparka Lead Engine preferences.</p>
      </div>
    </div>

    <div class="grid-2">
      <div class="dash-col">
        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon('user')} Profile</div>
          </div>
          <div class="card-body">
            <div class="settings-form">
              <div class="form-row">
                <div class="form-group">
                  <label>Full Name</label>
                  <input type="text" value="Prashant Kumar" id="s-name">
                </div>
                <div class="form-group">
                  <label>Email</label>
                  <input type="email" value="prashant@samparka.io" id="s-email">
                </div>
              </div>
              <div class="form-group">
                <label>Role</label>
                <input type="text" value="Admin" readonly style="background:var(--surface-2)">
              </div>
              <button class="btn btn-primary mt8" id="save-profile">${icon('save')} Save Profile</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon('mail')} Email Settings</div>
          </div>
          <div class="card-body">
            <div class="settings-form">
              <div class="form-group">
                <label>Email Domain</label>
                <input type="text" value="${settings.emailDomain}" id="s-domain">
              </div>
              <div class="form-group">
                <label>API Key</label>
                <div class="row" style="gap:8px">
                  <input type="password" value="${settings.apiKey || 'sk-xxxx-xxxx-xxxx'}" id="s-apikey" style="flex:1">
                  <button class="btn btn-sm btn-secondary" id="toggle-apikey">${icon('eye', 'ic-14')}</button>
                </div>
              </div>
              <button class="btn btn-primary mt8" id="save-email-settings">${icon('save')} Save</button>
            </div>
          </div>
        </div>
      </div>

      <div class="dash-col">
        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon('settings')} Preferences</div>
          </div>
          <div class="card-body">
            <div class="settings-toggles">
              <div class="toggle-row">
                <div>
                  <div class="toggle-label">Auto-Enrich Leads</div>
                  <div class="toggle-desc">Automatically enrich new leads with company data</div>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="s-autoenrich" ${settings.autoEnrich ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="toggle-row">
                <div>
                  <div class="toggle-label">Email Notifications</div>
                  <div class="toggle-desc">Receive email alerts for new replies and updates</div>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="s-notifications" ${settings.notifications ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="toggle-row">
                <div>
                  <div class="toggle-label">Dark Mode</div>
                  <div class="toggle-desc">Switch to dark theme (coming soon)</div>
                </div>
                <label class="toggle">
                  <input type="checkbox" id="s-darkmode" ${settings.darkMode ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon('zap')} Integrations</div>
          </div>
          <div class="card-body">
            <div class="integrations-list">
              <div class="integration-row">
                <div class="row" style="gap:12px">
                  <div class="int-icon">${icon('linkedin')}</div>
                  <div>
                    <div class="toggle-label">LinkedIn</div>
                    <div class="toggle-desc">Connect your LinkedIn account</div>
                  </div>
                </div>
                <button class="btn btn-sm btn-secondary" data-action="connect-integration" data-name="LinkedIn">Connect</button>
              </div>
              <div class="integration-row">
                <div class="row" style="gap:12px">
                  <div class="int-icon">${icon('twitter')}</div>
                  <div>
                    <div class="toggle-label">Twitter / X</div>
                    <div class="toggle-desc">Import leads from Twitter</div>
                  </div>
                </div>
                <button class="btn btn-sm btn-secondary" data-action="connect-integration" data-name="Twitter">Connect</button>
              </div>
              <div class="integration-row">
                <div class="row" style="gap:12px">
                  <div class="int-icon">${icon('database')}</div>
                  <div>
                    <div class="toggle-label">HubSpot</div>
                    <div class="toggle-desc">Sync leads with HubSpot CRM</div>
                  </div>
                </div>
                <button class="btn btn-sm btn-secondary" data-action="connect-integration" data-name="HubSpot">Connect</button>
              </div>
              <div class="integration-row">
                <div class="row" style="gap:12px">
                  <div class="int-icon">${icon('database')}</div>
                  <div>
                    <div class="toggle-label">Salesforce</div>
                    <div class="toggle-desc">Sync leads with Salesforce</div>
                  </div>
                </div>
                <button class="btn btn-sm btn-secondary" data-action="connect-integration" data-name="Salesforce">Connect</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="border-color:#fca5a5">
          <div class="card-head" style="border-bottom-color:#fecaca">
            <div class="card-title" style="color:var(--red)">${icon('alertTriangle')} Danger Zone</div>
          </div>
          <div class="card-body">
            <div class="spread">
              <div>
                <div class="toggle-label">Delete All Data</div>
                <div class="toggle-desc">Permanently remove all leads, campaigns, and settings</div>
              </div>
              <button class="btn btn-danger" data-action="delete-all">${icon('trash')} Delete Everything</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  UI.renderView(html);
  bindSettingsEvents();
}

function bindSettingsEvents() {
  UI.on('#save-profile', 'click', () => {
    const name = document.getElementById('s-name').value.trim();
    const email = document.getElementById('s-email').value.trim();
    if (!name || !email) return UI.toast('Name and email are required.', 'error');
    const settings = Store.get('settings');
    settings.profileName = name;
    settings.profileEmail = email;
    Store.set('settings', settings);
    UI.toast('Profile saved successfully.');
  });

  UI.on('#save-email-settings', 'click', () => {
    const domain = document.getElementById('s-domain').value.trim();
    const apiKey = document.getElementById('s-apikey').value.trim();
    if (!domain) return UI.toast('Email domain is required.', 'error');
    const settings = Store.get('settings');
    settings.emailDomain = domain;
    settings.apiKey = apiKey;
    Store.set('settings', settings);
    UI.toast('Email settings saved.');
  });

  UI.on('#toggle-apikey', 'click', () => {
    const input = document.getElementById('s-apikey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  UI.delegate('#view', '.toggle input', 'change', (e) => {
    const id = e.target.id;
    const settings = Store.get('settings');
    const map = { 's-autoenrich': 'autoEnrich', 's-notifications': 'notifications', 's-darkmode': 'darkMode' };
    if (map[id]) {
      settings[map[id]] = e.target.checked;
      Store.set('settings', settings);
    }
    UI.toast('Preference updated.');
  });

  UI.delegate('#view', '[data-action="connect-integration"]', 'click', (e, el) => {
    const name = el.dataset.name;
    UI.toast(`${name} integration would connect here.`);
  });

  UI.delegate('#view', '[data-action="delete-all"]', 'click', () => {
    if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
      Store.init();
      UI.toast('All data has been deleted.');
      renderSettings();
      UI.buildSidebar();
    }
  });
}
