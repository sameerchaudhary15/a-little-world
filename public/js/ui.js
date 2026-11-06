/* Small helpers shared by the sign-up page, the studio and the admin panel. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function api(method, url, body, raw) {
    const opts = { method, headers: { "X-LW": "1" } };
    if (raw) { opts.body = raw; opts.headers["Content-Type"] = raw.type || "application/octet-stream"; }
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }
    let r;
    try { r = await fetch(url, opts); } catch { throw new Error("We couldn't reach the server. Check your connection and try again."); }
    const j = await r.json().catch(() => null);
    if (r.status === 401 && UI.onUnauthorised && !url.startsWith("/api/account/") && !url.startsWith("/api/auth/")) UI.onUnauthorised();
    if (!r.ok) throw Object.assign(new Error(j?.error || "Something went wrong. Please try again."), { status: r.status });
    return j;
  }

  let toastTimer;
  function toast(msg, isError) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg; t.classList.toggle("err", !!isError); t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), isError ? 5000 : 2600);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.append(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch {}
      ta.remove(); return ok;
    }
  }
  const date = (s) => (s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
  const dateTime = (s) => (s ? new Date(s).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");

  // accessible modal. Resolves true/false for confirm dialogs. `body` is trusted markup.
  function dialog({ title, body = "", actions = [], onOpen, className = "" }) {
    return new Promise((resolve) => {
      const d = document.createElement("dialog");
      d.className = `dlg ${className}`;
      d.innerHTML = `<button class="dlg-x" type="button" aria-label="Close">×</button><h2>${esc(title)}</h2><div class="dlg-body">${body}</div>${actions.length ? `<div class="dlg-actions">${actions.map((a, i) => `<button type="button" class="${a.cls || "btn quiet"}" data-a="${i}">${esc(a.label)}</button>`).join("")}</div>` : ""}`;
      document.body.append(d);
      const finish = (v) => { d.close(); d.remove(); resolve(v); };
      d.addEventListener("cancel", (e) => { e.preventDefault(); finish(false); });
      $(".dlg-x", d).onclick = () => finish(false);
      $$("[data-a]", d).forEach((b) => (b.onclick = () => finish(actions[+b.dataset.a].value)));
      d.showModal();
      onOpen && onOpen(d, finish);
    });
  }
  const confirmDo = (title, body, label = "Delete", cls = "btn danger") => dialog({ title, body: `<p>${esc(body)}</p>`, actions: [{ label: "Keep it", value: false }, { label, value: true, cls }] });

  window.UI = { $, $$, esc, api, toast, copy, date, dateTime, dialog, confirmDo, onUnauthorised: null };
})();
