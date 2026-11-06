/* The private control room. This file is only sent after the server has checked the admin session,
   and every API behind it re-checks that session on every call. */
(function () {
  const { $, $$, esc, api, toast, copy, date, dateTime, dialog, confirmDo } = UI;
  const C = window.LW_CATALOG;
  const main = $("#panel");
  const path = location.pathname.replace(/\/+$/, "");
  UI.onUnauthorised = () => { location.href = "/admin"; };

  $$("[data-nav]").forEach((a) => { const h = a.getAttribute("href"); if (h === path || (h !== "/admin" && path.startsWith(h + "/"))) a.setAttribute("aria-current", "page"); });
  $("#logoutBtn").onclick = async () => { await api("POST", "/api/auth/logout", {}); location.href = "/admin"; };

  const num = (n) => Number(n || 0).toLocaleString();
  const STATUS = { published: ["Live", "ok"], draft: ["Draft", "warn"], disabled: ["Link off", "off"], expired: ["Expired", "off"], removed: ["Taken down", "bad"], suspended: ["Creator suspended", "bad"] };
  const chip = (s) => { const [t, c] = STATUS[s] || [s, "off"]; return `<span class="st st-${c}">${esc(t)}</span>`; };
  const GENDER = { female: "Female", male: "Male", unspecified: "Not specified" };
  const loading = () => { main.innerHTML = `<p class="muted pad" role="status">Loading…</p>`; };

  /* ----- a horizontal bar list: magnitude, one hue, direct labels ----- */
  function barList(rows, labelKey = "label", valueKey = "count") {
    if (!rows.length) return `<p class="muted">Nothing yet.</p>`;
    const max = Math.max(...rows.map((r) => r[valueKey]), 1);
    return `<ul class="bars">${rows.map((r) => `<li title="${esc(r[labelKey])}: ${num(r[valueKey])}"><span class="bar-l">${esc(r[labelKey])}</span><span class="bar-t"><i style="width:${Math.max(2, (r[valueKey] / max) * 100)}%"></i></span><span class="bar-v">${num(r[valueKey])}</span></li>`).join("")}</ul>`;
  }

  /* ----- pagination + table helpers ----- */
  const pager = (d) => (d.pages > 1 ? `<nav class="pager" aria-label="Pages"><button type="button" class="btn-s" data-page="${d.page - 1}"${d.page <= 1 ? " disabled" : ""}>Previous</button><span>Page ${d.page} of ${d.pages} · ${num(d.total)} in all</span><button type="button" class="btn-s" data-page="${d.page + 1}"${d.page >= d.pages ? " disabled" : ""}>Next</button></nav>` : `<p class="muted small">${num(d.total)} in all</p>`);
  const td = (label, html, cls = "") => `<td data-l="${esc(label)}" class="${cls}">${html}</td>`;

  function listPage({ title, sub, exportHref, filters = "", load, row, columns, empty, after }) {
    main.innerHTML = `<header class="ph"><div><h1>${esc(title)}</h1>${sub ? `<p class="muted">${esc(sub)}</p>` : ""}</div>${exportHref ? `<a class="btn-s" href="${exportHref}">Export to CSV</a>` : ""}</header>
      <form class="tools" id="tools" role="search"><label class="fld grow"><span>Search</span><input id="q" type="search" placeholder="Name, email, words…"></label>${filters}</form>
      <div id="out"></div>`;
    let page = 1;
    const out = $("#out");
    const run = async () => {
      out.innerHTML = `<p class="muted pad" role="status">Loading…</p>`;
      const params = new URLSearchParams({ q: $("#q").value, page });
      $$("#tools select").forEach((s) => s.value && params.set(s.name, s.value));
      try {
        const d = await load(params);
        out.innerHTML = d.items.length ? `${columns ? `<div class="tw"><table class="tbl"><thead><tr>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>${d.items.map(row).join("")}</tbody></table></div>` : d.items.map(row).join("")}${pager(d)}` : `<p class="muted pad">${esc(empty)}</p>`;
        $$("[data-page]", out).forEach((b) => (b.onclick = () => { page = +b.dataset.page; run(); }));
        after && after(out, run);
      } catch (x) { out.innerHTML = `<p class="err pad">${esc(x.message)}</p>`; }
    };
    let timer;
    $("#q").oninput = () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; run(); }, 280); };
    $$("#tools select").forEach((s) => (s.onchange = () => { page = 1; run(); }));
    $("#tools").onsubmit = (e) => { e.preventDefault(); page = 1; run(); };
    run();
  }

  /* ----- overview ----- */
  async function overview() {
    loading();
    const d = await api("GET", "/api/control/overview"), t = d.totals;
    main.innerHTML = `<header class="ph"><div><h1>Overview</h1><p class="muted">The whole platform, right now.</p></div></header>
      <dl class="kpis">
        ${[["Registered creators", t.creators], ["Envelopes generated", t.envelopes], ["Recipient links opened", t.opened], ["Questionnaires completed", t.completed], ["Answers received", t.answers], ["Photographs uploaded", t.photos]].map(([l, v]) => `<div><dt>${l}</dt><dd>${num(v)}</dd></div>`).join("")}
      </dl>
      <div class="two">
        <section class="box"><h2>Most popular relationships</h2>${barList(d.relationships)}</section>
        <section class="box"><h2>Most popular experiences</h2>${barList(d.experiences.slice(0, 8))}</section>
        <section class="box"><h2>Recently created</h2>${d.recentEnvelopes.length ? `<ul class="plain">${d.recentEnvelopes.map((e) => `<li><a href="/admin/envelopes/${esc(e.id)}"><b>For ${esc(e.recipientName)}</b></a> <span class="muted">by ${esc(e.creatorName)}</span> ${chip(e.status)}<br><span class="muted small">${esc(e.intentLabel)} · ${date(e.createdAt)}</span></li>`).join("")}</ul>` : `<p class="muted">No envelopes yet.</p>`}</section>
        <section class="box"><h2>Recently active creators</h2>${d.recentCreators.length ? `<ul class="plain">${d.recentCreators.map((u) => `<li><a href="/admin/users/${esc(u.id)}"><b>${esc(u.name)}</b></a> <span class="muted">${esc(u.email)}</span><br><span class="muted small">${u.envelopes} envelopes · active ${dateTime(u.lastActiveAt)}</span></li>`).join("")}</ul>` : `<p class="muted">No creators yet.</p>`}</section>
      </div>`;
  }

  /* ----- creators ----- */
  function users() {
    listPage({
      title: "Creators", sub: "Everyone who has registered.", exportHref: "/api/control/export/users",
      filters: `<label class="fld"><span>Status</span><select name="status"><option value="">All</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>`,
      columns: ["Creator", "Registered", "Last active", "Envelopes", "Visits", "Responses", "Status"], empty: "No creators match that.",
      load: (p) => api("GET", `/api/control/users?${p}`),
      row: (u) => `<tr>${td("Creator", `<a href="/admin/users/${esc(u.id)}"><b>${esc(u.name)}</b></a><br><span class="muted small">${esc(u.email)}</span>`)}${td("Registered", date(u.createdAt))}${td("Last active", dateTime(u.lastActiveAt))}${td("Envelopes", num(u.envelopes), "n")}${td("Visits", num(u.visits), "n")}${td("Responses", num(u.responses), "n")}${td("Status", u.suspended ? `<span class="st st-bad">Suspended</span>` : `<span class="st st-ok">Active</span>`)}</tr>`,
    });
  }
  async function userDetail(id) {
    loading();
    const u = await api("GET", `/api/control/users/${id}`);
    main.innerHTML = `<a class="back" href="/admin/users">← Creators</a>
      <header class="ph"><div><h1>${esc(u.name)}</h1><p class="muted">${esc(u.email)}</p></div>
        <div class="acts"><button class="btn-s" id="uReset" type="button">Make a password reset link</button><button class="btn-s" id="uSusp" type="button">${u.suspended ? "Reactivate" : "Suspend"}</button><button class="btn-s danger" id="uDel" type="button">Delete account</button></div></header>
      <dl class="meta"><div><dt>Status</dt><dd>${u.suspended ? `<span class="st st-bad">Suspended</span>` : `<span class="st st-ok">Active</span>`}</dd></div><div><dt>Registered</dt><dd>${date(u.createdAt)}</dd></div><div><dt>Last active</dt><dd>${dateTime(u.lastActiveAt)}</dd></div><div><dt>Envelopes</dt><dd>${u.envelopes} (${u.published} published)</dd></div><div><dt>Total visits</dt><dd>${num(u.visits)}</dd></div><div><dt>Responses</dt><dd>${num(u.responses)}</dd></div></dl>
      <section class="box"><h2>Their envelopes</h2>${u.envelopesList.length ? `<ul class="plain">${u.envelopesList.map((e) => `<li><a href="/admin/envelopes/${esc(e.id)}"><b>For ${esc(e.recipientName)}</b></a> ${chip(e.status)}<br><span class="muted small">${esc(e.intentLabel)} · ${num(e.visits)} visits · ${e.completed} completed · ${date(e.createdAt)}</span></li>`).join("")}</ul>` : `<p class="muted">None yet.</p>`}</section>`;
    $("#uSusp").onclick = async () => {
      const next = !u.suspended;
      if (next && !(await confirmDo(`Suspend ${u.name}?`, "They'll be logged out, and all of their envelope links will stop working until you reactivate them.", "Suspend"))) return;
      try { await api("PATCH", `/api/control/users/${id}`, { suspended: next }); toast(next ? "Suspended" : "Reactivated"); userDetail(id); } catch (x) { toast(x.message, true); }
    };
    $("#uDel").onclick = async () => {
      if (!(await confirmDo(`Delete ${u.name}'s account?`, `This permanently deletes the account and ${u.envelopes} envelope(s), with their links, photographs and responses.`))) return;
      try { await api("DELETE", `/api/control/users/${id}`); location.href = "/admin/users"; } catch (x) { toast(x.message, true); }
    };
    $("#uReset").onclick = async () => {
      try {
        const { path: p } = await api("POST", `/api/control/users/${id}/reset-link`, {});
        const url = location.origin + p;
        await dialog({ title: "Reset link", body: `<p>Send this to ${esc(u.name)} privately. It works once, for 24 hours.</p><label class="fld"><span>Link</span><input readonly value="${esc(url)}" id="rl"></label>`, actions: [{ label: "Copy", value: true, cls: "btn-p" }], onOpen: (d) => { $("#rl", d).select(); } }).then((v) => v && copy(url).then(() => toast("Copied")));
      } catch (x) { toast(x.message, true); }
    };
  }

  /* ----- envelopes ----- */
  function envelopes() {
    listPage({
      title: "Envelopes", sub: "Everything created on the platform.", exportHref: "/api/control/export/envelopes",
      filters: `<label class="fld"><span>Relationship</span><select name="relationship"><option value="">All</option>${C.relationshipIds.map((r) => `<option value="${r}">${esc(C.RELATIONSHIPS[r].label)}</option>`).join("")}</select></label>
        <label class="fld"><span>Status</span><select name="status"><option value="">All</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join("")}</select></label>`,
      columns: ["Recipient", "Creator", "Relationship", "Gender", "Experience", "Link", "Created", "Visits", "Done", "Photos", "Status", ""], empty: "No envelopes match that.",
      load: (p) => api("GET", `/api/control/envelopes?${p}`),
      row: (e) => `<tr>
        ${td("Recipient", `<a href="/admin/envelopes/${esc(e.id)}"><b>${esc(e.recipientName)}</b></a>`)}${td("Creator", `${esc(e.creatorName)}${e.ownerId ? `<br><a class="muted small" href="/admin/users/${esc(e.ownerId)}">${esc(e.creatorEmail)}</a>` : ""}`)}
        ${td("Relationship", esc(e.relationshipLabel))}${td("Gender", esc(GENDER[e.gender] || ""))}${td("Experience", esc(e.intentLabel))}
        ${td("Link", `<button type="button" class="linkish" data-copy="${esc(location.origin + e.url)}" title="${esc(e.url)}">Copy</button>`)}${td("Created", date(e.createdAt))}${td("Visits", num(e.visits), "n")}${td("Done", num(e.completed), "n")}${td("Photos", num(e.photos), "n")}${td("Status", chip(e.status))}
        ${td("", `<a class="linkish" href="/admin/envelopes/${esc(e.id)}">Open</a>`)}</tr>`,
      after: (out) => { $$("[data-copy]", out).forEach((b) => (b.onclick = async () => { (await copy(b.dataset.copy)) && toast("Link copied"); })); },
    });
  }
  const responseCard = (r) => `<article class="rc"><header><h3>${esc(r.recipientName || "Recipient")}${r.creatorName ? ` <span class="muted small">envelope by ${r.ownerId ? `<a href="/admin/users/${esc(r.ownerId)}">${esc(r.creatorName)}</a>` : esc(r.creatorName)}${r.creatorEmail ? ` · ${esc(r.creatorEmail)}` : ""}</span>` : ""}</h3>
      <span class="st ${r.complete ? "st-ok" : "st-warn"}">${r.complete ? "Completed" : "In progress"}</span><span class="muted small">${dateTime(r.submittedAt || r.updatedAt)}</span>${r.envelopeId && r.kind !== "legacy" && r.intentLabel ? `<a class="small" href="/admin/envelopes/${esc(r.envelopeId)}">${esc(r.intentLabel)}</a>` : r.intentLabel ? `<span class="small muted">${esc(r.intentLabel)}</span>` : ""}</header>
      ${r.proposal ? `<p class="hl"><span>Proposal reply</span>${esc(r.proposal.label)}</p>` : ""}${r.quiz ? `<p class="hl"><span>Quiz result</span>${esc(r.quiz.title)}</p>` : ""}${r.meter ? `<p class="hl"><span>Friendship meter</span>${esc(r.meter.score)}% · ${esc(r.meter.title)}</p>` : ""}
      ${r.answers?.length ? `<dl class="qa">${r.answers.map((a) => `<div><dt>${esc(a.question)}</dt><dd>${esc(a.answer)}</dd></div>`).join("")}</dl>` : ""}
      ${r.feedback ? `<p class="hl"><span>Written message</span>${esc(r.feedback.text)}</p>` : ""}
      ${r.kind !== "legacy" ? `<button type="button" class="linkish del" data-rdel="${esc(r.id)}">Delete this response</button>` : ""}</article>`;
  async function envelopeDetail(id) {
    loading();
    const d = await api("GET", `/api/control/envelopes/${id}`), e = d.summary, cfg = d.config, legacy = d.kind === "legacy";
    const previewHref = legacy ? e.url : `/admin/preview/${id}`;
    main.innerHTML = `<a class="back" href="/admin/envelopes">← Envelopes</a>
      <header class="ph"><div><h1>For ${esc(e.recipientName)}</h1><p class="muted">${esc(e.intentLabel)} ${chip(e.status)}</p></div>
        <div class="acts"><a class="btn-s" href="${esc(previewHref)}" target="_blank" rel="noopener">Preview</a><button class="btn-s" id="eDis" type="button">${e.adminDisabled ? "Restore link" : "Disable link"}</button><button class="btn-s danger" id="eDel" type="button">Delete</button></div></header>
      <dl class="meta">
        <div><dt>Creator</dt><dd>${d.creator ? `<a href="/admin/users/${esc(d.creator.id)}">${esc(d.creator.name)}</a><br><span class="muted small">${esc(d.creator.email)}</span>` : esc(e.creatorName || "You (original studio)")}</dd></div>
        <div><dt>Recipient gender</dt><dd>${esc(GENDER[e.gender] || "")}</dd></div>
        <div><dt>Unique link</dt><dd><button class="linkish" id="eCopy" type="button">Copy link</button><br><span class="muted small brk">${esc(e.url)}</span></dd></div>
        <div><dt>Created</dt><dd>${date(e.createdAt)}</dd></div><div><dt>Visits</dt><dd>${num(e.visits)}</dd></div><div><dt>Completed</dt><dd>${num(e.completed)}</dd></div><div><dt>Photographs</dt><dd>${num(e.photos)}</dd></div>
      </dl>
      ${cfg?.gallery.photos.length ? `<section class="box"><h2>Uploaded photographs</h2><div class="thumbs">${cfg.gallery.photos.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="${esc(p.caption || "Uploaded photograph")}" loading="lazy"></a>`).join("")}</div></section>` : ""}
      <section class="box"><h2>Submitted responses</h2>${d.responses.length ? d.responses.map((r) => responseCard({ ...r, recipientName: e.recipientName })).join("") : `<p class="muted">None yet.</p>`}</section>
      ${cfg ? `<section class="box"><h2>Everything the creator wrote</h2>
        <dl class="qa">
          <div><dt>Opening</dt><dd>${esc(cfg.opening.greeting)}\n${esc(cfg.opening.message)}</dd></div>
          <div><dt>Sections, in order</dt><dd>${cfg.sections.filter((s) => s.on).map((s) => esc(C.SECTION_LABELS[s.id])).join(" → ")}</dd></div>
          <div><dt>Compliments</dt><dd>${cfg.compliments.map(esc).join("\n")}</dd></div>
          <div><dt>Questions</dt><dd>${cfg.questions.filter((q) => q.on).map((q) => esc(q.q)).join("\n")}</dd></div>
          <div><dt>Letters</dt><dd>${cfg.letters.map((l) => `${esc(l.title)}: ${esc(l.text)}`).join("\n\n")}</dd></div>
          <div><dt>Bouquet</dt><dd>${esc(C.BOUQUET.kinds[cfg.bouquet.kind]?.label)}, ${cfg.bouquet.count} stems, ${esc(C.BOUQUET.wraps[cfg.bouquet.wrap]?.label)}, ${esc(C.BOUQUET.ribbons[cfg.bouquet.ribbon]?.label)}\n${esc(cfg.bouquet.note)}\n${cfg.bouquet.messages.map(esc).join("\n")}</dd></div>
          <div><dt>Secrets</dt><dd>${cfg.secrets.map((s) => esc(s.text)).join("\n")}</dd></div>
          ${cfg.intent === "propose" ? `<div><dt>Proposal</dt><dd>${esc(cfg.proposal.lead)}\n${cfg.proposal.lines.map(esc).join("\n")}\n${esc(cfg.proposal.question)}</dd></div>` : ""}
          <div><dt>Final letter</dt><dd>${esc(cfg.finale.title)}\n${esc(cfg.finale.letter)}\n${esc(cfg.finale.sign)}</dd></div>
        </dl></section>` : `<p class="muted">This is an original world. Edit its contents in <a href="/admin/worlds?w=${esc(id)}">Original worlds</a>.</p>`}`;
    $("#eCopy").onclick = async () => { (await copy(location.origin + e.url)) && toast("Link copied"); };
    $("#eDis").onclick = async () => {
      const next = !e.adminDisabled;
      if (next && !(await confirmDo("Disable this link?", "It will stop opening for everyone, and the creator can't turn it back on.", "Disable"))) return;
      try { await api("PATCH", `/api/control/envelopes/${id}`, { adminDisabled: next }); toast(next ? "Link disabled" : "Link restored"); envelopeDetail(id); } catch (x) { toast(x.message, true); }
    };
    $("#eDel").onclick = async () => {
      if (!(await confirmDo(`Delete the envelope for ${e.recipientName}?`, "This permanently deletes its link, photographs and responses."))) return;
      try { await api("DELETE", `/api/control/envelopes/${id}`); location.href = "/admin/envelopes"; } catch (x) { toast(x.message, true); }
    };
    wireResponseDelete(() => envelopeDetail(id));
  }
  function wireResponseDelete(reload, host = main) {
    $$("[data-rdel]", host).forEach((b) => (b.onclick = async () => {
      if (!(await confirmDo("Delete this response?", "It can't be recovered."))) return;
      try { await api("DELETE", `/api/control/responses/${b.dataset.rdel}`); toast("Deleted"); reload(); } catch (x) { toast(x.message, true); }
    }));
  }

  /* ----- responses ----- */
  function responses() {
    listPage({
      title: "Responses", sub: "Answers, quiz results, proposal replies and messages, each tied to its creator and envelope.", exportHref: "/api/control/export/responses",
      filters: `<label class="fld"><span>Show</span><select name="filter"><option value="">All</option><option value="complete">Completed</option><option value="progress">In progress</option><option value="proposal">Proposal replies</option><option value="feedback">Written messages</option></select></label>`,
      empty: "No responses match that.",
      load: (p) => api("GET", `/api/control/responses?${p}`),
      row: responseCard,
      after: (out, run) => wireResponseDelete(run, out),
    });
  }

  /* ----- analytics ----- */
  function dayBars(series, key, label) {
    const max = Math.max(...series.map((d) => d[key]), 1), total = series.reduce((n, d) => n + d[key], 0);
    return `<figure class="chart"><figcaption><b>${esc(label)}</b> <span class="muted">${num(total)} in 30 days</span></figcaption>
      <div class="dbars" role="img" aria-label="${esc(label)}: ${num(total)} in the last 30 days. Exact figures are in the table below.">${series.map((d) => `<span class="dbar" tabindex="-1" data-tip="${esc(date(d.day))}: ${num(d[key])}"><i style="height:${d[key] ? Math.max(4, (d[key] / max) * 100) : 0}%"></i></span>`).join("")}</div>
      <div class="daxis"><span>${esc(date(series[0].day))}</span><span>Today</span></div><p class="dmax muted small">Tallest bar: ${num(max === 1 && !total ? 0 : max)}</p></figure>`;
  }
  async function analytics() {
    loading();
    const d = await api("GET", "/api/control/analytics");
    const f = d.funnel;
    const steps = [["Created", f.created], ["Published", f.published], ["Opened", f.opened], ["Someone answered", f.answered], ["Questionnaire completed", f.completed]];
    main.innerHTML = `<header class="ph"><div><h1>Analytics</h1><p class="muted">Counted without identifying any visitor.</p></div></header>
      <div class="charts">${dayBars(d.series, "visits", "Link visits")}${dayBars(d.series, "created", "Envelopes created")}${dayBars(d.series, "signups", "New creators")}${dayBars(d.series, "completed", "Questionnaires completed")}</div>
      <div class="two"><section class="box"><h2>From created to answered</h2><p class="muted small">Envelopes that reached each stage.</p>${barList(steps.map(([label, count]) => ({ label, count })))}</section>
      <section class="box"><h2>Envelopes by status</h2>${barList(d.statuses.map((s) => ({ label: (STATUS[s.label] || [s.label])[0], count: s.count })))}</section></div>
      <section class="box"><details><summary>See the last 30 days as a table</summary><div class="tw"><table class="tbl plain-t"><thead><tr><th scope="col">Day</th><th scope="col">Visits</th><th scope="col">Created</th><th scope="col">New creators</th><th scope="col">Completed</th></tr></thead><tbody>${[...d.series].reverse().map((s) => `<tr><td>${esc(date(s.day))}</td><td class="n">${s.visits}</td><td class="n">${s.created}</td><td class="n">${s.signups}</td><td class="n">${s.completed}</td></tr>`).join("")}</tbody></table></div></details></section>
      <div class="tip" id="tip" hidden></div>`;
    const tip = $("#tip");
    $$(".dbar").forEach((b) => {
      b.onmouseenter = (e) => { tip.textContent = b.dataset.tip; tip.hidden = false; move(e); };
      b.onmousemove = move; b.onmouseleave = () => (tip.hidden = true);
    });
    function move(e) { tip.style.left = `${Math.min(e.clientX + 12, innerWidth - 150)}px`; tip.style.top = `${e.clientY - 34}px`; }
  }

  /* ----- route ----- */
  const fail = (x) => { main.innerHTML = `<p class="err pad">${esc(x.message)}</p>`; };
  let m;
  if ((m = path.match(/^\/admin\/users\/([a-z0-9]{12})$/))) userDetail(m[1]).catch(fail);
  else if ((m = path.match(/^\/admin\/envelopes\/([a-z0-9]{10,12})$/))) envelopeDetail(m[1]).catch(fail);
  else ({ "/admin": overview, "/admin/users": users, "/admin/envelopes": envelopes, "/admin/responses": responses, "/admin/analytics": analytics }[path] || overview)()?.catch?.(fail);
})();
