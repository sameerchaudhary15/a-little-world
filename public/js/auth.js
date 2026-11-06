/* /create: sign up, log in, or use a reset link. */
(function () {
  const { $, esc, api } = UI;
  const card = $("#authCard");
  const params = new URLSearchParams(location.search);
  const reset = params.get("reset");
  const nextParam = params.get("next") || "";
  const safeNext = /^\/studio(\/[a-z0-9/-]*)?$/.test(nextParam) ? nextParam : "";

  const art = $("#authArt");
  if (art && window.Flora) art.innerHTML = ["rose", "daisy", "tulip", "sprig", "poppy"].map((f, i) => `<div class="af af${i}">${Flora.flower(f, { seed: i * 3 + 2 })}</div>`).join("");

  const field = (label, id, type, attrs = "") => `<label class="fld"><span>${esc(label)}</span><input id="${id}" type="${type}" ${attrs}></label>`;

  function render(mode) {
    const signup = mode === "signup";
    card.innerHTML = `
      <p class="eyebrow">${signup ? "Create your account" : "Welcome back"}</p>
      <h1>${signup ? "Every beautiful surprise starts somewhere." : "Back to your studio."}</h1>
      <form id="authForm" novalidate>
        ${signup ? field("Your name", "aName", "text", 'autocomplete="name" maxlength="80" required') : ""}
        ${field("Email", "aEmail", "email", 'autocomplete="email" inputmode="email" required')}
        ${field("Password", "aPw", "password", `autocomplete="${signup ? "new-password" : "current-password"}" required minlength="8"`)}
        ${signup ? '<p class="fine">At least 8 characters. Your envelopes stay in your account, and only you can edit them.</p>' : ""}
        <p class="form-err" id="aErr" role="alert"></p>
        <button class="btn primary wide" type="submit">${signup ? "Create my account" : "Log in"}</button>
      </form>
      <p class="auth-switch">${signup ? "Already have an account?" : "New here?"} <button type="button" class="linkish" id="aSwitch">${signup ? "Log in" : "Create an account"}</button></p>
      ${signup ? "" : '<p class="fine">Forgotten your password? Ask the site owner for a reset link.</p>'}`;
    $("#aSwitch").onclick = () => render(signup ? "login" : "signup");
    $("#authForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button[type=submit]"), err = $("#aErr");
      err.textContent = ""; btn.disabled = true;
      try {
        const body = { email: $("#aEmail").value, password: $("#aPw").value };
        if (signup) body.name = $("#aName").value;
        await api("POST", signup ? "/api/account/register" : "/api/account/login", body);
        location.href = safeNext || (signup ? "/studio/create" : "/studio");
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    };
    const first = card.querySelector("input"); first && first.focus();
  }

  function renderReset() {
    card.innerHTML = `<p class="eyebrow">Reset your password</p><h1>Choose a new password.</h1>
      <form id="resetForm">${field("New password", "rPw", "password", 'autocomplete="new-password" required minlength="8"')}<p class="form-err" id="rErr" role="alert"></p><button class="btn primary wide" type="submit">Save and log in</button></form>`;
    $("#resetForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button"); btn.disabled = true; $("#rErr").textContent = "";
      try { await api("POST", "/api/account/reset", { token: reset, password: $("#rPw").value }); location.href = "/studio"; }
      catch (ex) { $("#rErr").textContent = ex.message; btn.disabled = false; }
    };
  }

  if (reset) renderReset(); else render(safeNext ? "login" : "signup");
})();
