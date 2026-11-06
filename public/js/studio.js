/* Creator Studio: dashboard, envelope list, the creation wizard, responses and account. Only ever shows the logged-in creator's data. */
(function () {
  const { $, $$, esc, api, toast, copy, date, dateTime, dialog, confirmDo } = UI;
  const C = window.LW_CATALOG;
  const app = $("#app");
  const path = location.pathname.replace(/\/+$/, "");
  UI.onUnauthorised = () => { location.href = `/create?next=${encodeURIComponent(path)}`; };

  $$("[data-nav]").forEach((a) => { const h = a.getAttribute("href"); if (h === path || (h === "/studio/experiences" && path.startsWith("/studio/edit"))) a.setAttribute("aria-current", "page"); });

  const STATUS = { published: ["Live", "ok"], draft: ["Draft", "draft"], disabled: ["Link off", "off"], expired: ["Expired", "off"], removed: ["Taken down", "off"], suspended: ["Paused", "off"] };
  const statusChip = (s) => { const [t, c] = STATUS[s] || [s, "off"]; return `<span class="chip chip-${c}">${esc(t)}</span>`; };
  const fullUrl = (e) => `${location.origin}/envelope/${e.slug}`;
  const miniEnv = (e) => `<div class="mini mini-${esc(e.relationship)}" aria-hidden="true">${e.coverUrl ? `<img src="${esc(e.coverUrl)}" alt="" loading="lazy">` : "<i></i>"}</div>`;

  /* ---------- share sheet (also used by the editor) ---------- */
  async function shareSheet(id) {
    const e = await api("GET", `/api/studio/envelopes/${id}`);
    const url = fullUrl(e);
    const wa = `https://wa.me/?text=${encodeURIComponent(`${e.recipientName}, I made you something. Open it when you have a quiet moment: ${url}`)}`;
    const expires = e.expiresAt ? new Date(e.expiresAt).toISOString().slice(0, 10) : "";
    await dialog({
      title: e.status === "published" ? `Ready for ${e.recipientName}` : "Your link",
      className: "dlg-share",
      body: `
        <label class="fld"><span>Their private link</span><input id="shUrl" readonly value="${esc(url)}"></label>
        <div class="share-row">
          <button class="btn primary" id="shCopy" type="button">Copy link</button>
          <a class="btn wa" href="${esc(wa)}" target="_blank" rel="noopener">Share on WhatsApp</a>
          <a class="btn quiet" href="${esc(url)}" target="_blank" rel="noopener">Open it</a>
          <a class="btn quiet" href="/studio/preview/${esc(e.id)}" target="_blank" rel="noopener">Preview</a>
        </div>
        <p class="fine">Anyone with this link can open the envelope, so send it only to ${esc(C.fill("{them}", e))}. It doesn't let anyone edit it.</p>
        <div class="share-ctl">
          <label class="switch"><input type="checkbox" id="shOn" ${e.disabled ? "" : "checked"}><span>Link is on</span></label>
          <label class="fld"><span>Close the link on (optional)</span><input type="date" id="shExp" value="${expires}" min="${new Date().toISOString().slice(0, 10)}"></label>
        </div>
        <a class="linkish" href="/studio/edit/${esc(e.id)}">Edit this envelope</a>`,
      onOpen(d) {
        $("#shUrl", d).onclick = (ev) => ev.target.select();
        $("#shCopy", d).onclick = async (ev) => { if (await copy(url)) { ev.target.textContent = "Copied"; setTimeout(() => (ev.target.textContent = "Copy link"), 1800); } };
        $("#shOn", d).onchange = async (ev) => { try { await api("POST", `/api/studio/envelopes/${id}/link`, { disabled: !ev.target.checked }); toast(ev.target.checked ? "Link is on" : "Link is off: it won't open any more"); } catch (x) { toast(x.message, true); } };
        $("#shExp", d).onchange = async (ev) => {
          try { await api("POST", `/api/studio/envelopes/${id}/link`, { expiresAt: ev.target.value ? new Date(`${ev.target.value}T23:59:59`).toISOString() : null }); toast(ev.target.value ? `Link closes after ${ev.target.value}` : "No closing date"); }
          catch (x) { toast(x.message, true); }
        };
      },
    });
  }
  window.StudioShare = shareSheet;

  /* ---------- envelope rows ---------- */
  function envRow(e) {
    return `<article class="env-row" data-id="${esc(e.id)}">
      ${miniEnv(e)}
      <div class="env-main">
        <h3><a href="/studio/edit/${esc(e.id)}">For ${esc(e.recipientName)}</a> ${statusChip(e.status)}</h3>
        <p class="env-sub">${esc(C.RELATIONSHIPS[e.relationship]?.label || "")} · ${esc(e.intentLabel)}</p>
        <p class="env-nums"><b>${e.visits}</b> ${e.visits === 1 ? "visit" : "visits"} · <b>${e.responses}</b> ${e.responses === 1 ? "response" : "responses"} · edited ${date(e.updatedAt)}</p>
      </div>
      <div class="env-acts">
        <a class="btn small quiet" href="/studio/edit/${esc(e.id)}">Edit</a>
        <a class="btn small quiet" href="/studio/preview/${esc(e.id)}" target="_blank" rel="noopener">Preview</a>
        ${e.draft ? "" : `<button class="btn small quiet" data-copy="${esc(fullUrl(e))}" type="button">Copy link</button><button class="btn small quiet" data-share="${esc(e.id)}" type="button">Share</button>`}
        <a class="btn small quiet" href="/studio/responses?e=${esc(e.id)}">Answers</a>
        <button class="btn small quiet del" data-del="${esc(e.id)}" data-name="${esc(e.recipientName)}" type="button">Delete</button>
      </div>
    </article>`;
  }
  function wireRows(root, reload) {
    root.onclick = async (ev) => {
      const b = ev.target.closest("button"); if (!b) return;
      if (b.dataset.copy) { (await copy(b.dataset.copy)) && toast("Link copied"); }
      if (b.dataset.share) { try { await shareSheet(b.dataset.share); reload(); } catch (x) { toast(x.message, true); } }
      if (b.dataset.del) {
        if (!(await confirmDo(`Delete the envelope for ${b.dataset.name}?`, "This removes its link, photographs and every response. It can't be undone."))) return;
        try { await api("DELETE", `/api/studio/envelopes/${b.dataset.del}`); toast("Deleted"); reload(); } catch (x) { toast(x.message, true); }
      }
    };
  }
  const loading = () => { app.innerHTML = `<p class="loading" role="status">Unfolding…</p>`; };
  const showError = (x) => { app.innerHTML = `<div class="empty"><h1>That didn't load.</h1><p>${esc(x.message)}</p><button class="btn quiet" type="button">Try again</button></div>`; $(".empty button").onclick = () => location.reload(); };
  const emptyState = () => `<div class="empty"><div class="empty-art" aria-hidden="true">${Flora.flower("rose", { seed: 7 })}${Flora.flower("daisy", { seed: 3 })}${Flora.flower("sprig", { seed: 9 })}</div><h1>Every beautiful surprise starts somewhere.</h1><p>Pick a person, say what you've been meaning to say, and send them something they can open.</p><a class="btn primary" href="/studio/create">Create your first envelope</a></div>`;

  /* ---------- dashboard ---------- */
  async function dashboard() {
    loading();
    const [me, list] = await Promise.all([api("GET", "/api/account/me"), api("GET", "/api/studio/envelopes")]);
    if (!list.length) { app.innerHTML = emptyState(); return; }
    const drafts = list.filter((e) => e.draft), live = list.filter((e) => !e.draft);
    const visits = list.reduce((n, e) => n + e.visits, 0), resp = list.reduce((n, e) => n + e.responses, 0);
    app.innerHTML = `
      <header class="page-head"><div><p class="eyebrow">Hello, ${esc(me.user.name.split(" ")[0])}</p><h1>Your studio</h1></div><a class="btn primary" href="/studio/create">New envelope</a></header>
      <dl class="ledger">
        <div><dt>Envelopes</dt><dd>${list.length}</dd></div><div><dt>Published</dt><dd>${live.length}</dd></div><div><dt>Drafts</dt><dd>${drafts.length}</dd></div>
        <div><dt>Visits</dt><dd>${visits}</dd></div><div><dt>Responses</dt><dd>${resp}</dd></div>
      </dl>
      <section><h2 class="sec-h">Recently edited</h2><div id="rows">${list.slice(0, 5).map(envRow).join("")}</div>${list.length > 5 ? `<a class="linkish" href="/studio/experiences">See all ${list.length} envelopes</a>` : ""}</section>`;
    wireRows($("#rows"), dashboard);
  }

  /* ---------- all envelopes ---------- */
  async function experiences(filter = "all") {
    loading();
    const list = await api("GET", "/api/studio/envelopes");
    if (!list.length) { app.innerHTML = emptyState(); return; }
    const shown = filter === "all" ? list : list.filter((e) => (filter === "draft" ? e.draft : !e.draft));
    app.innerHTML = `
      <header class="page-head"><div><h1>My envelopes</h1></div><a class="btn primary" href="/studio/create">New envelope</a></header>
      <div class="tabs" role="group" aria-label="Filter">${[["all", "All"], ["live", "Published"], ["draft", "Drafts"]].map(([k, l]) => `<button type="button" class="tab" data-f="${k}" aria-pressed="${k === filter}">${l}</button>`).join("")}</div>
      <div id="rows">${shown.map(envRow).join("") || '<p class="fine">Nothing here yet.</p>'}</div>`;
    $$(".tab", app).forEach((t) => (t.onclick = () => experiences(t.dataset.f)));
    wireRows($("#rows"), () => experiences(filter));
  }

  /* ---------- wizard ---------- */
  const REL_ART = { partner: "rose", bestie: "poppy", friend: "daisy", mom: "blossom", dad: "tulip" };
  async function wizard() {
    const state = { step: 1, relationship: "", intent: "", gender: "unspecified", recipientName: "", fromName: "", proposalMode: "direct" };
    try { state.fromName = (await api("GET", "/api/account/me")).user.name.split(" ")[0]; } catch {}
    const crumbs = () => `<ol class="steps" aria-label="Progress">${["Who it's for", "The idea", "The details"].map((s, i) => `<li class="${i + 1 === state.step ? "on" : i + 1 < state.step ? "done" : ""}"${i + 1 === state.step ? ' aria-current="step"' : ""}>${s}</li>`).join("")}</ol>`;
    const render = () => {
      if (state.step === 1) {
        app.innerHTML = `<div class="wiz wiz-1">${crumbs()}<h1>Who is this little surprise for?</h1><div class="rel-grid">${C.relationshipIds.map((id, i) => `
          <button type="button" class="rel rel-${id}" data-r="${id}"><span class="rel-art" aria-hidden="true">${Flora.flower(REL_ART[id], { seed: i + 4 })}</span><span class="rel-t">${esc(C.RELATIONSHIPS[id].label)}</span><span class="rel-l">${esc(C.RELATIONSHIPS[id].line)}</span></button>`).join("")}</div></div>`;
        $$(".rel", app).forEach((b) => (b.onclick = () => { state.relationship = b.dataset.r; state.intent = ""; state.step = 2; render(); }));
      } else if (state.step === 2) {
        const rel = state.relationship;
        app.innerHTML = `<div class="wiz wiz-2 tint-${rel}">${crumbs()}<button type="button" class="linkish back">← Back</button><h1>What would you like to create for them?</h1><div class="intent-list">${C.INTENTS[rel].map((x) => `
          <button type="button" class="intent" data-i="${esc(x.id)}"><span class="intent-t">${esc(x.label)}</span><span class="intent-b">${esc(x.blurb)}</span></button>`).join("")}</div></div>`;
        $(".back", app).onclick = () => { state.step = 1; render(); };
        $$(".intent", app).forEach((b) => (b.onclick = () => { state.intent = b.dataset.i; state.step = 3; render(); }));
      } else {
        const propose = state.intent === "propose";
        app.innerHTML = `<form class="wiz wiz-3 tint-${state.relationship}" id="wizForm" novalidate>${crumbs()}<button type="button" class="linkish back">← Back</button><h1>Who will receive this envelope?</h1>
          <label class="fld"><span>Their name</span><input id="wName" maxlength="60" required placeholder="What you actually call them" value="${esc(state.recipientName)}" autocomplete="off"></label>
          <fieldset class="fset"><legend>How should we refer to them?</legend><p class="fine">This only changes words like "she" or "they". Nothing else about the envelope changes.</p>
            <div class="seg">${[["female", "Female"], ["male", "Male"], ["unspecified", "Prefer not to specify"]].map(([v, l]) => `<label><input type="radio" name="g" value="${v}" ${state.gender === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></fieldset>
          <label class="fld"><span>Your name, as they know you</span><input id="wFrom" maxlength="60" value="${esc(state.fromName)}"></label>
          ${propose ? `<fieldset class="fset"><legend>How would you like to ask?</legend><div class="mode">
            <label><input type="radio" name="pm" value="direct" ${state.proposalMode === "direct" ? "checked" : ""}><span><b>A direct proposal</b><small>Ends with a clear question: "Will you marry me?"</small></span></label>
            <label><input type="radio" name="pm" value="gentle" ${state.proposalMode === "gentle" ? "checked" : ""}><span><b>A gentle romantic appreciation</b><small>Ends softly: "Can I keep choosing you?"</small></span></label></div>
            <p class="fine">Either way, they can always answer "I need a little time", or not answer at all. You can change every word later.</p></fieldset>` : ""}
          <p class="form-err" id="wErr" role="alert"></p>
          <button class="btn primary wide" type="submit">Make the first draft</button></form>`;
        $(".back", app).onclick = () => { state.recipientName = $("#wName").value; state.fromName = $("#wFrom").value; state.step = 2; render(); };
        $("#wName").focus();
        $("#wizForm").onsubmit = async (ev) => {
          ev.preventDefault();
          const btn = ev.target.querySelector("button[type=submit]"), err = $("#wErr");
          state.recipientName = $("#wName").value.trim(); state.fromName = $("#wFrom").value.trim();
          state.gender = $("input[name=g]:checked").value;
          if (propose) state.proposalMode = $("input[name=pm]:checked").value;
          if (!state.recipientName) { err.textContent = "Please tell us their name."; $("#wName").focus(); return; }
          btn.disabled = true; btn.textContent = "Writing your first draft…"; err.textContent = "";
          try { const e = await api("POST", "/api/studio/envelopes", state); location.href = `/studio/edit/${e.id}`; }
          catch (x) { err.textContent = x.message; btn.disabled = false; btn.textContent = "Make the first draft"; }
        };
      }
      scrollTo(0, 0);
    };
    render();
  }

  /* ---------- their little responses ---------- */
  const responseCard = (r) => `<article class="resp" data-env="${esc(r.envelopeId)}">
    <header class="resp-head"><h3>${esc(r.recipientName)}</h3><span class="chip ${r.complete ? "chip-ok" : "chip-draft"}">${r.complete ? "Completed" : "In progress"}</span><span class="resp-when">${dateTime(r.submittedAt || r.updatedAt)}</span></header>
    ${r.proposal ? `<div class="resp-big"><span>${esc(C.fill("{Their}", r))} reply to your question</span><strong>${esc(r.proposal.label)}</strong></div>` : ""}
    ${r.answers.length ? `<dl class="qa">${r.answers.map((a) => `<div><dt>${esc(a.question)}</dt><dd>${esc(a.answer)}</dd></div>`).join("")}</dl>` : ""}
    ${r.quiz ? `<div class="resp-big"><span>Quiz result</span><strong>${esc(r.quiz.title)}</strong></div>` : ""}
    ${r.feedback ? `<blockquote class="resp-fb"><span>${esc(C.fill("{They}", r))} wrote back</span>${esc(r.feedback.text)}</blockquote>` : ""}
    <footer class="resp-foot"><a class="linkish" href="/api/studio/envelopes/${esc(r.envelopeId)}/export?format=csv">Download CSV</a><a class="linkish" href="/api/studio/envelopes/${esc(r.envelopeId)}/export?format=json">JSON</a><button class="linkish del" type="button" data-rd="${esc(r.id)}" data-e="${esc(r.envelopeId)}">Delete this response</button></footer>
  </article>`;
  async function responses() {
    loading();
    const want = new URLSearchParams(location.search).get("e") || "";
    const [rows, envs] = await Promise.all([api("GET", "/api/studio/responses"), api("GET", "/api/studio/envelopes")]);
    const draw = (sel) => {
      const shown = sel ? rows.filter((r) => r.envelopeId === sel) : rows;
      $("#respList").innerHTML = shown.map(responseCard).join("") || `<div class="empty small"><h2>Nothing yet.</h2><p>When someone answers, it will appear here. Only you can see it here in your studio.</p></div>`;
    };
    app.innerHTML = `<header class="page-head"><div><h1>Their little responses</h1><p class="sub">What they've said back to you. Nobody else's studio can see these.</p></div></header>
      ${envs.length > 1 ? `<label class="fld fld-inline"><span>Show</span><select id="respFilter"><option value="">Everyone</option>${envs.map((e) => `<option value="${esc(e.id)}"${e.id === want ? " selected" : ""}>For ${esc(e.recipientName)} (${esc(e.intentLabel)})</option>`).join("")}</select></label>` : ""}
      <div id="respList"></div>`;
    draw(want);
    $("#respFilter")?.addEventListener("change", (e) => draw(e.target.value));
    $("#respList").onclick = async (ev) => {
      const b = ev.target.closest("[data-rd]"); if (!b) return;
      if (!(await confirmDo("Delete this response?", "It can't be recovered."))) return;
      try { await api("DELETE", `/api/studio/envelopes/${b.dataset.e}/responses/${b.dataset.rd}`); const i = rows.findIndex((r) => r.id === b.dataset.rd); rows.splice(i, 1); draw($("#respFilter")?.value || want); toast("Deleted"); } catch (x) { toast(x.message, true); }
    };
  }

  /* ---------- account ---------- */
  async function account() {
    loading();
    const { user } = await api("GET", "/api/account/me");
    app.innerHTML = `<header class="page-head"><div><h1>Account</h1><p class="sub">${esc(user.email)} · joined ${date(user.createdAt)}</p></div><button class="btn quiet" id="logout" type="button">Log out</button></header>
      <div class="acct">
        <form id="nameForm" class="acct-block"><h2 class="sec-h">Your name</h2><label class="fld"><span>Name</span><input id="acName" value="${esc(user.name)}" maxlength="80" required></label><button class="btn quiet" type="submit">Save name</button></form>
        <form id="pwForm" class="acct-block"><h2 class="sec-h">Change password</h2><label class="fld"><span>Current password</span><input id="acCur" type="password" autocomplete="current-password" required></label><label class="fld"><span>New password</span><input id="acNew" type="password" minlength="8" autocomplete="new-password" required></label><button class="btn quiet" type="submit">Change password</button></form>
        <form id="delForm" class="acct-block danger"><h2 class="sec-h">Delete my account</h2><p class="fine">This deletes your account, every envelope, every link, photograph and response. It can't be undone.</p><label class="fld"><span>Type your password to confirm</span><input id="acDel" type="password" autocomplete="current-password" required></label><button class="btn danger" type="submit">Delete everything</button></form>
      </div>`;
    $("#logout").onclick = async () => { await api("POST", "/api/account/logout", {}); location.href = "/"; };
    $("#nameForm").onsubmit = async (e) => { e.preventDefault(); try { await api("PATCH", "/api/account/me", { name: $("#acName").value }); toast("Saved"); } catch (x) { toast(x.message, true); } };
    $("#pwForm").onsubmit = async (e) => { e.preventDefault(); try { await api("POST", "/api/account/password", { current: $("#acCur").value, password: $("#acNew").value }); e.target.reset(); toast("Password changed"); } catch (x) { toast(x.message, true); } };
    $("#delForm").onsubmit = async (e) => {
      e.preventDefault();
      if (!(await confirmDo("Delete your whole account?", "Every envelope and response will be gone for good.", "Delete everything"))) return;
      try { await api("POST", "/api/account/delete", { password: $("#acDel").value }); location.href = "/"; } catch (x) { toast(x.message, true); }
    };
  }

  /* ---------- route ---------- */
  const routes = { "/studio": dashboard, "/studio/experiences": experiences, "/studio/create": wizard, "/studio/responses": responses, "/studio/account": account };
  const edit = path.match(/^\/studio\/edit\/([a-z0-9]{12})$/);
  (edit ? () => StudioEditor.mount(app, edit[1]) : routes[path] || dashboard)().catch(showError);
})();
