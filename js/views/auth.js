async function renderAuth() {
  const view = document.getElementById('view');
  view.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <h1 class="auth-title">Samparka</h1>
          <p class="auth-subtitle">Lead Intelligence Engine</p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Sign In</button>
          <button class="auth-tab" data-tab="register">Sign Up</button>
        </div>

        <form id="auth-form" class="auth-form">
          <div id="auth-name-field" class="form-group" style="display:none">
            <label class="form-label">Full Name</label>
            <input type="text" name="name" class="form-input" placeholder="John Smith" autocomplete="name">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" name="email" class="form-input" placeholder="you@company.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" name="password" class="form-input" placeholder="At least 6 characters" required autocomplete="current-password">
          </div>
          <div id="auth-error" class="auth-error" style="display:none"></div>
          <button type="submit" class="btn btn-primary btn-full auth-submit">
            <span class="auth-submit-text">Sign In</span>
            <span class="auth-submit-loading" style="display:none">Loading...</span>
          </button>
        </form>
      </div>
    </div>
  `;

  const tabs = view.querySelectorAll('.auth-tab');
  const nameField = view.querySelector('#auth-name-field');
  const submitText = view.querySelector('.auth-submit-text');
  const form = view.querySelector('#auth-form');
  const errorEl = view.querySelector('#auth-error');
  let mode = 'login';

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      mode = tab.dataset.tab;
      nameField.style.display = mode === 'register' ? 'block' : 'none';
      submitText.textContent = mode === 'register' ? 'Create Account' : 'Sign In';
      errorEl.style.display = 'none';
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const data = {
      email: form.email.value.trim(),
      password: form.password.value,
    };
    if (mode === 'register') {
      data.name = form.name.value.trim();
      if (!data.name) {
        errorEl.textContent = 'Name is required';
        errorEl.style.display = 'block';
        return;
      }
    }

    const submitBtn = form.querySelector('.auth-submit');
    submitBtn.disabled = true;
    submitText.textContent = mode === 'register' ? 'Creating account...' : 'Signing in...';

    try {
      const result = mode === 'register'
        ? await API.auth.register(data)
        : await API.auth.login(data);

      Auth.setSession(result.token, result.user);
      Store._state.currentUser = result.user;
      UI.buildSidebar();
      UI.buildTopbar();
      navigateTo('dashboard');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitText.textContent = mode === 'register' ? 'Create Account' : 'Sign In';
    }
  });
}
