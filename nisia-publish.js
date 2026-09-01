(() => {
  'use strict';

  const SUPABASE_URL = 'https://ffgfigkeeeauzkifopei.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_w_R4Kqq3UqNKQuv6erQzAQ_bXBkw8Bc';
  const AUTH_STORAGE_KEY = 'nisia-naxos-auth-v1';
  let client = null;
  let panel = null;
  let status = null;
  let publishButton = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase?.createClient) throw new Error('Nisia connection library is unavailable.');
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: AUTH_STORAGE_KEY,
      },
    });
    return client;
  }

  function setStatus(message, error = false) {
    if (!status) return;
    status.textContent = message || '';
    status.style.color = error ? '#a12622' : '';
  }

  function modal(fields, title) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.35);display:grid;place-items:center;padding:20px';
      const card = document.createElement('form');
      card.style.cssText = 'width:min(100%,390px);background:white;border-radius:22px;padding:20px;display:grid;gap:12px;box-shadow:0 18px 50px rgba(0,0,0,.18)';
      const heading = document.createElement('strong');
      heading.textContent = title;
      heading.style.fontSize = '18px';
      card.appendChild(heading);
      const inputs = {};
      fields.forEach((field) => {
        const label = document.createElement('label');
        label.style.cssText = 'display:grid;gap:5px;font-size:13px';
        label.append(document.createTextNode(field.label));
        const input = document.createElement('input');
        input.type = field.type || 'text';
        input.name = field.name;
        input.required = true;
        input.autocomplete = field.autocomplete || 'off';
        input.inputMode = field.inputMode || '';
        input.maxLength = field.maxLength || 200;
        input.style.cssText = 'min-height:44px;border:1px solid #ccc;border-radius:12px;padding:0 11px;font:inherit';
        label.appendChild(input);
        card.appendChild(label);
        inputs[field.name] = input;
      });
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:4px';
      const cancel = document.createElement('button');
      cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.className = 'secondary';
      const submit = document.createElement('button');
      submit.type = 'submit'; submit.textContent = 'Continue';
      actions.append(cancel, submit); card.appendChild(actions); overlay.appendChild(card); document.body.appendChild(overlay);
      const finish = (value) => { overlay.remove(); resolve(value); };
      cancel.addEventListener('click', () => finish(null));
      overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(null); });
      card.addEventListener('submit', (event) => {
        event.preventDefault();
        const values = {};
        Object.entries(inputs).forEach(([key, input]) => values[key] = input.value.trim());
        finish(values);
      });
      setTimeout(() => fields[0] && inputs[fields[0].name]?.focus(), 0);
    });
  }

  async function ensureSignedIn() {
    const nisia = getClient();
    let { data: { session } } = await nisia.auth.getSession();
    if (!session) {
      const credentials = await modal([
        { name: 'email', label: 'Nisia admin email', type: 'email', autocomplete: 'username' },
        { name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password' },
      ], 'Connect Naxos to Nisia');
      if (!credentials) return null;
      const { data, error } = await nisia.auth.signInWithPassword(credentials);
      if (error || !data.session) throw new Error('Nisia sign-in failed.');
      session = data.session;
    }

    const { data: aal, error: aalError } = await nisia.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;
    if (aal?.currentLevel !== 'aal2') {
      const { data: factors, error: factorsError } = await nisia.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const factor = (factors?.totp || []).find((item) => item.status === 'verified');
      if (!factor) throw new Error('Set up staff MFA in Nisia before publishing courses.');
      const verification = await modal([
        { name: 'code', label: 'Authenticator code', type: 'text', inputMode: 'numeric', maxLength: 6, autocomplete: 'one-time-code' },
      ], 'Verify Nisia access');
      if (!verification) return null;
      const code = verification.code.replace(/\D/g, '').slice(0, 6);
      if (code.length !== 6) throw new Error('Enter the 6-digit authenticator code.');
      const { error } = await nisia.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) throw new Error('Authenticator code was not accepted.');
      ({ data: { session } } = await nisia.auth.getSession());
    }
    return session;
  }

  async function currentPointer() {
    const generate = document.getElementById('generateQr');
    const payload = document.getElementById('qrPayload');
    if (!generate || !payload) throw new Error('This course cannot currently be exported.');
    generate.click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (!payload.value.trim()) throw new Error('Naxos has not passed its mapping audit, so it cannot be published yet.');
    let pointer;
    try { pointer = JSON.parse(payload.value); } catch { throw new Error('The Naxos course pointer is invalid.'); }
    if (!pointer?.packUrl) throw new Error('The Naxos course pointer is incomplete.');
    return pointer;
  }

  async function publish() {
    if (publishButton?.disabled) return;
    publishButton.disabled = true;
    setStatus('Preparing Nisia…');
    try {
      const session = await ensureSignedIn();
      if (!session) { setStatus('Publishing cancelled.'); return; }
      const pointer = await currentPointer();
      setStatus('Publishing course to Nisia…');
      const nisia = getClient();
      const { data, error } = await nisia.functions.invoke('naxos-publish-course', { body: { pointer } });
      if (error || !data?.course?.id) throw new Error(data?.error || 'Nisia could not publish this course.');
      const suffix = data.development_only ? ' Development/test pack.' : '';
      setStatus(data.already_published ? `Already in Nisia.${suffix}` : `Published to Nisia · ${data.criteria} criteria.${suffix}`);
    } catch (error) {
      console.error('Nisia publish failed', error);
      setStatus(error?.message || 'Could not publish to Nisia.', true);
    } finally {
      publishButton.disabled = false;
    }
  }

  function install() {
    const exportPanel = document.getElementById('exportPanel');
    if (!exportPanel || document.getElementById('nisiaPublishPanel')) return;
    panel = document.createElement('div');
    panel.id = 'nisiaPublishPanel';
    panel.style.cssText = 'width:100%;margin-top:12px;padding-top:12px;border-top:1px solid var(--line,#ddd);display:flex;flex-wrap:wrap;align-items:center;gap:10px';
    publishButton = document.createElement('button');
    publishButton.type = 'button';
    publishButton.textContent = 'Publish to Nisia';
    publishButton.addEventListener('click', publish);
    status = document.createElement('span');
    status.style.cssText = 'font-size:.82rem;color:var(--muted,#666);line-height:1.35';
    status.textContent = 'Publishes the versioned course only — no learner data.';
    panel.append(publishButton, status);
    exportPanel.appendChild(panel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();