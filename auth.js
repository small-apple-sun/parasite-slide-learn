(function () {
  "use strict";

  const SESSION_KEY = "parasiteSlideLearn_authUser";
  const overlay = document.getElementById("authOverlay");
  const form = document.getElementById("authForm");
  const inputUser = document.getElementById("authUser");
  const inputPass = document.getElementById("authPass");
  const errEl = document.getElementById("authError");
  const btnLogout = document.getElementById("authLogout");

  function getConfig() {
    const c = window.__PARASITE_SLIDE_AUTH__;
    if (!c || !Array.isArray(c.users)) return { users: [] };
    return { users: c.users };
  }

  function hexFromBuffer(buf) {
    const a = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < a.length; i += 1) {
      s += a[i].toString(16).padStart(2, "0");
    }
    return s;
  }

  function timingSafeEqualHex(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const na = a.length;
    const nb = b.length;
    if (na !== nb) return false;
    let r = 0;
    for (let i = 0; i < na; i += 1) {
      r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return r === 0;
  }

  function normalizeHash(h) {
    if (typeof h !== "string") return "";
    return h.trim().toLowerCase();
  }

  async function sha256Utf8(plain) {
    const data = new TextEncoder().encode(plain);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return hexFromBuffer(hash);
  }

  function findUserEntry(users, username) {
    const u = String(username || "").trim();
    if (!u) return null;
    for (let i = 0; i < users.length; i += 1) {
      const row = users[i];
      if (!row || typeof row.username !== "string") continue;
      if (row.username.trim() === u) return row;
    }
    return null;
  }

  function sessionUsername() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const u = String(raw).trim();
      return u || null;
    } catch {
      return null;
    }
  }

  function setSession(username) {
    try {
      sessionStorage.setItem(SESSION_KEY, String(username).trim());
    } catch {
      /* ignore */
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  function showAuthError(msg) {
    if (!errEl) return;
    errEl.textContent = msg || "";
    errEl.classList.toggle("hidden", !msg);
  }

  function showOverlay(show) {
    if (!overlay) return;
    overlay.classList.toggle("hidden", !show);
    if (inputUser && show) {
      setTimeout(function () {
        inputUser.focus();
      }, 0);
    }
  }

  function updateLogoutVisibility(enabled) {
    if (!btnLogout) return;
    btnLogout.classList.toggle("hidden", !enabled);
  }

  function scopedStorageKey(base) {
    const users = getConfig().users;
    if (users.length === 0) return base;
    const u = sessionUsername();
    if (!u) return base;
    return base + "__" + encodeURIComponent(u);
  }

  window.__PARASITE_SLIDE_STORAGE_KEY__ = scopedStorageKey;

  let appLaunched = false;

  function startApp() {
    const start = window.__PARASITE_SLIDE_START__;
    if (typeof start !== "function") return;
    if (appLaunched) {
      location.reload();
      return;
    }
    appLaunched = true;
    start();
  }

  function isSessionValid(users) {
    const u = sessionUsername();
    if (!u) return false;
    return Boolean(findUserEntry(users, u));
  }

  async function onSubmit(e) {
    e.preventDefault();
    showAuthError("");
    const users = getConfig().users;
    const name = inputUser ? inputUser.value : "";
    const pass = inputPass ? inputPass.value : "";
    const row = findUserEntry(users, name);
    const expected = row ? normalizeHash(row.passwordSha256Hex) : "";
    if (!row || !expected || expected.length !== 64) {
      showAuthError("账号或密码错误");
      return;
    }
    let got;
    try {
      got = await sha256Utf8(pass);
    } catch {
      showAuthError("当前环境无法校验密码，请使用 HTTPS 或本地 http 打开");
      return;
    }
    if (!timingSafeEqualHex(got, expected)) {
      showAuthError("账号或密码错误");
      return;
    }
    setSession(row.username.trim());
    showOverlay(false);
    updateLogoutVisibility(true);
    if (inputPass) inputPass.value = "";
    startApp();
  }

  function onLogout() {
    clearSession();
    updateLogoutVisibility(false);
    const users = getConfig().users;
    if (users.length === 0) return;
    showOverlay(true);
    showAuthError("");
    if (inputPass) inputPass.value = "";
  }

  function boot() {
    const users = getConfig().users;

    if (users.length === 0) {
      showOverlay(false);
      updateLogoutVisibility(false);
      startApp();
      return;
    }

    if (btnLogout) {
      btnLogout.addEventListener("click", function () {
        onLogout();
      });
    }

    if (isSessionValid(users)) {
      showOverlay(false);
      updateLogoutVisibility(true);
      startApp();
      return;
    }

    clearSession();
    updateLogoutVisibility(false);
    showOverlay(true);
    if (form) form.addEventListener("submit", onSubmit);
  }

  boot();
})();
