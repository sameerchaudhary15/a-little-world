(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const G = window.gsap;
  const SECTIONS = LW_DEFAULTS.SECTIONS;
  const label = Object.fromEntries(SECTIONS.map((s) => [s.id, s.label]));

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 2200);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { const ta = document.createElement("textarea"); ta.value = text; document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch {} ta.remove(); return ok; }
  }
  async function api(method, url, body, raw) {
    const opts = { method, headers: { "X-LW": "1" }, credentials: "same-origin" };
    if (raw) { opts.body = raw; opts.headers["Content-Type"] = raw.type || "application/octet-stream"; }
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }
    const r = await fetch(url, opts);
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.startsWith("/api/auth")) { showGate(); throw new Error("Please log in."); }
    if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }
  const linkFor = (e) => `${location.origin}/surprise/${e.slug}`;

  /* ------------------------------------------------------------ gate */
  let setupMode = false;
  async function boot() {
    const s = await api("GET", "/api/auth/status");
    if (s.authed) return startApp();
    showGate(!s.setup);
  }
  function showGate(firstTime) {
    if (firstTime !== undefined) setupMode = firstTime;
    $("#app").hidden = true; $("#gate").hidden = false;
    $("#gateSprig").innerHTML = Flora.flower("sprig", { seed: 7 });
    $("#gateTitle").textContent = setupMode ? "Set up your studio." : "Welcome back.";
    $("#gateSub").textContent = setupMode ? "Choose a password. You'll use it to make and edit every little world. At least 8 characters." : "Enter your password to open the studio.";
    $("#gatePw2Wrap").hidden = !setupMode;
    $("#gatePw").autocomplete = setupMode ? "new-password" : "current-password";
    $("#gateBtn").textContent = setupMode ? "Create password" : "Open the studio";
    setTimeout(() => $("#gatePw").focus(), 50);
  }
  $("#gateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("#gatePw").value, err = $("#gateErr");
    err.hidden = true;
    if (setupMode && pw !== $("#gatePw2").value) { err.textContent = "those two don't match."; err.hidden = false; return; }
    try {
      await api("POST", setupMode ? "/api/auth/setup" : "/api/auth/login", { password: pw });
      $("#gatePw").value = ""; $("#gatePw2").value = "";
      startApp();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  $("#logoutBtn").onclick = async () => {
    if (dirty && !confirm("You have unsaved changes. Log out anyway?")) return;
    await api("POST", "/api/auth/logout"); dirty = false; location.reload();
  };

  /* ------------------------------------------------------------ list */
  let worlds = [];
  let cur = null;      // the experience being edited
  let dirty = false;
  let tab = "basics";

  async function startApp() {
    $("#gate").hidden = true; $("#app").hidden = false;
    await loadList();
    const want = new URLSearchParams(location.search).get("w");
    if (want && worlds.some((w) => w.id === want)) open(want);
  }
  async function loadList() {
    worlds = await api("GET", "/api/experiences");
    renderList();
  }
  const fmtDate = (s) => s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
  function renderList() {
    $("#worldCount").textContent = worlds.length ? `(${worlds.length})` : "";
    $("#worldEmpty").hidden = worlds.length > 0;
    $("#worldList").innerHTML = worlds.map((w) => {
      const status = w.submittedAt ? `answered ${w.answered}/${w.totalQuestions}` : w.answered ? `in progress · ${w.answered}/${w.totalQuestions}` : w.openedAt ? `opened ${fmtDate(w.openedAt)}` : "not opened yet";
      return `<li class="${cur && cur.id === w.id ? "active" : ""}" data-id="${w.id}">
        <button class="st-world">
          <span class="w-name">${esc(w.name)}</span>
          <span class="w-meta">${status}${w.personality ? " · quiz done" : ""}</span>
        </button></li>`;
    }).join("");
  }
  $("#worldList").addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    if (cur && li.dataset.id === cur.id) return;
    if (dirty && !confirm("You have unsaved changes. Leave without saving?")) return;
    open(li.dataset.id);
  });
  $("#newBtn").onclick = () => { $("#newForm").hidden = false; $("#newName").focus(); };
  $("#newCancel").onclick = () => { $("#newForm").hidden = true; };
  $("#newForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (dirty && !confirm("You have unsaved changes. Leave without saving?")) return;
    try {
      const created = await api("POST", "/api/experiences", { name: $("#newName").value, from: $("#newFrom").value });
      $("#newForm").reset(); $("#newForm").hidden = true;
      await loadList();
      open(created.id, created);
      toast(`${created.name}'s world is planted`);
    } catch (ex) { toast(ex.message); }
  });

  /* ------------------------------------------------------------ editor */
  const TABS = [
    ["basics", "Basics"], ["sections", "Sections"], ["words", "Compliments & words"], ["bouquet", "Bouquet"],
    ["garden", "Garden & stars"], ["letters", "Secret letters"], ["scrapbook", "Scrapbook"], ["questions", "Questions"],
    ["extras", "Wheel, wish & meter"], ["answers", "Answers"],
  ];

  async function open(id, preloaded) {
    cur = preloaded || await api("GET", `/api/experiences/${id}`);
    dirty = false; setDirty(false);
    history.replaceState(null, "", `/admin?w=${cur.id}`);
    $("#blank").hidden = true; $("#edit").hidden = false;
    renderHead(); renderTabs(); renderPanel();
    renderList();
    if (innerWidth < 900) $("#editor").scrollIntoView({ behavior: "smooth" });
  }
  function renderHead() {
    $("#edTitle").textContent = cur.name;
    const link = linkFor(cur);
    $("#edLink").textContent = link;
    $("#previewBtn").href = link;
    $("#waBtn").href = `https://wa.me/?text=${encodeURIComponent(`I made something for you ♡\n${link}`)}`;
  }
  $("#copyBtn").onclick = async () => toast((await copy(linkFor(cur))) ? "Link copied" : "Couldn't copy");
  $("#deleteBtn").onclick = async () => {
    if (!confirm(`Delete ${cur.name}'s little world for good? Their link will stop working and their answers will be deleted.`)) return;
    await api("DELETE", `/api/experiences/${cur.id}`);
    toast("Deleted"); cur = null; dirty = false;
    $("#edit").hidden = true; $("#blank").hidden = false;
    history.replaceState(null, "", "/admin");
    loadList();
  };
  function renderTabs() {
    $("#tabs").innerHTML = TABS.map(([id, l]) => `<button role="tab" aria-selected="${id === tab}" data-tab="${id}">${l}</button>`).join("");
  }
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    tab = b.dataset.tab; renderTabs(); renderPanel();
  });

  function setDirty(v = true) {
    dirty = v;
    $("#saveBtn").disabled = !v;
    $("#saveStatus").textContent = v ? "unsaved changes" : "all saved";
    $("#saveBar").classList.toggle("dirty", v);
  }
  addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  $("#saveBtn").onclick = save;
  addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "s" && cur) { e.preventDefault(); if (dirty) save(); } });
  async function save() {
    $("#saveBtn").disabled = true; $("#saveStatus").textContent = "saving…";
    try {
      const { id, slug, createdAt, updatedAt, responses, ...body } = cur;
      const saved = await api("PUT", `/api/experiences/${cur.id}`, body);
      cur = saved; setDirty(false); renderHead(); renderPanel(true);
      await loadList();
      toast("Saved");
    } catch (ex) { setDirty(true); toast(ex.message); }
  }

  /* --------- small form builders --------- */
  const field = (lbl, html, hint) => `<label class="a-field"><span class="a-label">${lbl}</span>${html}${hint ? `<span class="a-hint hand">${hint}</span>` : ""}</label>`;
  const input = (key, val, attrs = "") => `<input data-k="${key}" value="${esc(val)}" ${attrs}>`;
  const area = (key, val, rows = 3, attrs = "") => `<textarea data-k="${key}" rows="${rows}" ${attrs}>${esc(val)}</textarea>`;

  // get/set by "a.b.0.c" paths on cur
  const getPath = (p) => p.split(".").reduce((o, k) => (o == null ? o : o[k]), cur);
  const setPath = (p, v) => { const ks = p.split("."); const last = ks.pop(); const o = ks.reduce((o, k) => o[k], cur); o[last] = v; };
  function bindInputs(root) {
    $$("[data-k]", root).forEach((el) => {
      const ev = el.type === "checkbox" ? "change" : "input";
      el.addEventListener(ev, () => {
        setPath(el.dataset.k, el.type === "checkbox" ? el.checked : el.value);
        setDirty();
        if (el.dataset.k === "name") $("#edTitle").textContent = el.value || "…";
      });
    });
  }

  // editable list of strings: add / remove / reorder (or fixed-length)
  function listEditor(key, { fixed, labels, rows = 2, max = 40, maxLen = 400, addLabel = "add another", placeholder = "" } = {}) {
    const arr = getPath(key);
    const items = arr.map((v, i) => `
      <li>
        <span class="le-num">${labels ? esc(labels[i] || "") : String(i + 1).padStart(2, "0")}</span>
        <textarea rows="${rows}" maxlength="${maxLen}" data-k="${key}.${i}" placeholder="${esc(placeholder)}">${esc(v)}</textarea>
        ${fixed ? "" : `<span class="le-tools">
          <button type="button" data-le="up" data-i="${i}" aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button>
          <button type="button" data-le="down" data-i="${i}" aria-label="Move down" ${i === arr.length - 1 ? "disabled" : ""}>↓</button>
          <button type="button" data-le="del" data-i="${i}" aria-label="Remove">×</button></span>`}
      </li>`).join("");
    return `<ol class="le" data-list="${key}">${items}</ol>${fixed || arr.length >= max ? "" : `<button type="button" class="btn-text le-add" data-list-add="${key}">+ ${addLabel}</button>`}`;
  }
  function bindLists(root) {
    $$("[data-le]", root).forEach((b) => b.addEventListener("click", () => {
      const key = b.closest("[data-list]").dataset.list, arr = getPath(key), i = +b.dataset.i;
      if (b.dataset.le === "del") { if (arr.length <= 1) return toast("Keep at least one"); arr.splice(i, 1); }
      if (b.dataset.le === "up") [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
      if (b.dataset.le === "down") [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
      setDirty(); renderPanel(true);
    }));
    $$("[data-list-add]", root).forEach((b) => b.addEventListener("click", () => {
      getPath(b.dataset.listAdd).push(""); setDirty(); renderPanel(true);
      const tas = $$(`[data-list="${b.dataset.listAdd}"] textarea`); tas[tas.length - 1]?.focus();
    }));
  }

  /* --------- panels --------- */
  const PANELS = {
    basics: () => `
      <div class="ed-cols">
        <div>
          ${field("Their name", input("name", cur.name, 'maxlength="60"'), "their link stays the same even if you change this.")}
          ${field("Your name", input("from", cur.from, 'maxlength="60"'))}
          ${field("Your WhatsApp number", input("phone", cur.phone, 'maxlength="20" inputmode="tel" placeholder="91 98765 43210"'), "with country code. their answers come back to you here.")}
        </div>
        <div>
          ${field("Personal note <i>shown near the top, leave empty to hide it</i>", area("note", cur.note, 7, 'maxlength="3000"'))}
          ${field("Final message", area("finalMessage", cur.finalMessage, 3, 'maxlength="600"'), "use {name} and {from} anywhere, they're filled in automatically.")}
        </div>
      </div>`,

    sections: () => `
      <p class="ed-help">Turn sections on or off and change their order. The envelope opening always comes first.</p>
      <ol class="sec-list">${cur.sections.map((s, i) => `
        <li class="${s.on ? "" : "off"}">
          <label class="sw"><input type="checkbox" data-k="sections.${i}.on" ${s.on ? "checked" : ""}><span></span></label>
          <span class="sec-name">${esc(label[s.id] || s.id)}</span>
          <span class="le-tools">
            <button type="button" data-mv="up" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
            <button type="button" data-mv="down" data-i="${i}" ${i === cur.sections.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
          </span>
        </li>`).join("")}</ol>`,

    words: () => `
      <h3 class="ed-h">Compliments <span>shown one at a time</span></h3>
      ${listEditor("compliments", { max: 40, maxLen: 400, addLabel: "add a compliment" })}
      <div class="ed-cols">
        <div>${field("Mystery gift box message", area("gift", cur.gift, 4, 'maxlength="1000"'))}</div>
        <div>${field("“Don't click this” button message", area("secretButton", cur.secretButton, 4, 'maxlength="500"'))}</div>
      </div>`,

    bouquet: () => `
      <h3 class="ed-h">Flower notes <span>tap a flower in the bouquet to read its note</span></h3>
      ${listEditor("bouquet.messages", { fixed: true, labels: ["Rose 1", "Rose 2", "Rose 3", "Tulip 1", "Tulip 2", "Daisy 1", "Daisy 2", "Daisy 3", "Baby's breath"], maxLen: 300 })}
      ${field("The letter inside the bouquet <i>revealed after unwrapping</i>", area("bouquet.letter", cur.bouquet.letter, 9, 'maxlength="4000"'))}`,

    garden: () => `
      <h3 class="ed-h">Night garden <span>12 glowing flowers, one message each</span></h3>
      ${listEditor("garden", { fixed: true, labels: ["Rose", "Moonflower", "Tulip", "Lavender", "Daisy", "Rose", "Moonflower", "Lavender", "Tulip", "Daisy", "Rose", "Moonflower"], maxLen: 300 })}
      <h3 class="ed-h">Constellation <span>9 stars, one compliment each</span></h3>
      ${listEditor("stars", { fixed: true, labels: Array.from({ length: 9 }, (_, i) => `Star ${i + 1}`), maxLen: 200, rows: 1 })}`,

    letters: () => cur.letters.map((l, i) => `
      <div class="letter-ed">
        <span class="le-seal">${["♡", "✦", "❀", "☾", "✧"][i]}</span>
        <div>
          ${field("Envelope label", `<input data-k="letters.${i}.title" value="${esc(l.title)}" maxlength="80">`)}
          ${field("Letter", `<textarea data-k="letters.${i}.text" rows="6" maxlength="3000">${esc(l.text)}</textarea>`)}
        </div>
      </div>`).join(""),

    scrapbook: () => `
      <p class="ed-help">Upload photos and write captions. Without a photo, an illustration is shown instead. Up to 12 pages. Photos are resized before upload.</p>
      <div class="sb-ed">${cur.scrapbook.map((s, i) => `
        <div class="sb-item">
          <div class="sb-thumb">${s.photo ? `<img src="${esc(s.photo)}" alt="">` : `<span class="sb-noimg">${esc(s.art)} illustration</span>`}</div>
          <div class="sb-fields">
            ${field("Caption", `<input data-k="scrapbook.${i}.caption" value="${esc(s.caption)}" maxlength="120">`)}
            ${field("Little note", `<input data-k="scrapbook.${i}.note" value="${esc(s.note)}" maxlength="120">`)}
            <label class="a-field"><span class="a-label">Illustration (when there's no photo)</span>
              <select data-k="scrapbook.${i}.art">${["sun", "moon", "tea", "sea", "flower", "stars"].map((a) => `<option ${a === s.art ? "selected" : ""}>${a}</option>`).join("")}</select></label>
            <div class="sb-tools">
              <label class="btn-text sb-upload">${s.photo ? "replace photo" : "upload photo"}<input type="file" accept="image/*" data-up="${i}" hidden></label>
              ${s.photo ? `<button type="button" class="btn-text" data-unphoto="${i}">remove photo</button>` : ""}
              <button type="button" class="btn-text danger" data-sbdel="${i}">delete page</button>
            </div>
          </div>
        </div>`).join("")}
      </div>
      ${cur.scrapbook.length < 12 ? `<button type="button" class="btn-text le-add" id="sbAdd">+ add a page</button>` : ""}`,

    questions: () => {
      const on = cur.questions.filter((q) => q.on).length;
      const cats = [...new Set(cur.questions.map((q) => q.cat))];
      return `
      <p class="ed-help">${on} of ${cur.questions.length} questions are switched on. Multiple choice questions can show a little reaction under each answer.
        <button class="btn-text" type="button" id="qAllOn">switch all on</button> · <button class="btn-text" type="button" id="qAllOff">switch all off</button></p>
      <ol class="qe">${cur.questions.map((q, i) => `
        <li class="${q.on ? "" : "off"}">
          <div class="qe-row">
            <label class="sw"><input type="checkbox" data-k="questions.${i}.on" ${q.on ? "checked" : ""}><span></span></label>
            <span class="le-num">${String(i + 1).padStart(2, "0")}</span>
            <input class="qe-q" data-k="questions.${i}.q" value="${esc(q.q)}" maxlength="300">
            <span class="le-tools">
              <button type="button" data-qmv="up" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
              <button type="button" data-qmv="down" data-i="${i}" ${i === cur.questions.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
              <button type="button" data-qdel="${i}" aria-label="Delete question">×</button>
            </span>
          </div>
          <div class="qe-sub">
            <input class="qe-cat" data-k="questions.${i}.cat" value="${esc(q.cat)}" maxlength="40" list="catList" aria-label="Category">
            <select data-qtype="${i}" aria-label="Answer type"><option value="text" ${q.type === "text" ? "selected" : ""}>written answer</option><option value="choice" ${q.type === "choice" ? "selected" : ""}>multiple choice</option></select>
          </div>
          ${q.type === "choice" ? `<div class="qe-opts">${q.options.map((o, k) => `
            <div class="qe-opt"><span>${"abcdef"[k]}</span>
              <input data-k="questions.${i}.options.${k}.t" value="${esc(o.t)}" maxlength="140" placeholder="answer">
              <input data-k="questions.${i}.options.${k}.r" value="${esc(o.r)}" maxlength="160" placeholder="little reaction (optional)">
              <button type="button" data-odel="${i}.${k}" aria-label="Remove option">×</button></div>`).join("")}
            ${q.options.length < 6 ? `<button type="button" class="btn-text" data-oadd="${i}">+ add option</button>` : ""}</div>` : ""}
        </li>`).join("")}</ol>
      <datalist id="catList">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
      <button type="button" class="btn-text le-add" id="qAdd">+ add a question</button>`;
    },

    extras: () => `
      <div class="ed-cols">
        <div><h3 class="ed-h">Wheel · funny dares</h3>${listEditor("wheel.dares", { max: 30, maxLen: 300, addLabel: "add a dare" })}</div>
        <div><h3 class="ed-h">Wheel · secret messages</h3>${listEditor("wheel.secrets", { max: 30, maxLen: 300, addLabel: "add a secret" })}</div>
      </div>
      <div class="ed-cols">
        <div><h3 class="ed-h">Wheel · random surprises</h3>${listEditor("wheel.surprises", { max: 30, maxLen: 300, addLabel: "add a surprise" })}</div>
        <div><h3 class="ed-h">Make a wish · replies <span>one is picked at random</span></h3>${listEditor("wishReplies", { max: 30, maxLen: 300, addLabel: "add a reply" })}</div>
      </div>
      <h3 class="ed-h">Friendship meter results <span>low score → high score</span></h3>
      ${cur.meter.map((m, i) => `<div class="ed-cols tight">
        <div>${field(`Result ${i + 1} title`, `<input data-k="meter.${i}.title" value="${esc(m.title)}" maxlength="60">`)}</div>
        <div>${field("Description", `<input data-k="meter.${i}.text" value="${esc(m.text)}" maxlength="300">`)}</div></div>`).join("")}
      <p class="ed-help">Compliments on the wheel come from your compliments list, questions from your question bank.</p>`,

    answers: () => {
      const r = cur.responses || {};
      const qn = r.questionnaire;
      const ans = qn?.answers || {};
      const answered = cur.questions.filter((q) => (ans[q.id] || "").trim());
      const P = { overthinker: "Professional Overthinker", drama: "Certified Drama Queen", main: "Main Character Energy", softie: "Secret Softie", plot: "Walking Plot Twist", chaos: "Chaos Coordinator", sunshine: "The Human Sunshine", menace: "Emotionally Intelligent Menace" };
      const dt = (s) => s ? new Date(s).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";
      return `
      <div class="ans-stats">
        <div><span class="a-label">First opened</span><b>${dt(r.openedAt)}</b></div>
        <div><span class="a-label">Last visit</span><b>${dt(r.lastSeen)}</b></div>
        <div><span class="a-label">Questions answered</span><b>${answered.length} / ${cur.questions.filter((q) => q.on).length}</b></div>
        <div><span class="a-label">Finished</span><b>${qn?.submittedAt ? dt(qn.submittedAt) : "not yet"}</b></div>
        <div><span class="a-label">Personality</span><b>${r.personality ? esc(P[r.personality.result]) : "—"}</b></div>
        <div><span class="a-label">Friendship meter</span><b>${r.meter ? `${r.meter.score}% · ${esc(r.meter.title)}` : "—"}</b></div>
      </div>
      <p class="ed-help">Diary pages (${r.diaryCount || 0}) and wishes (${r.wishCount || 0}) are private to ${esc(cur.name)}, so they aren't shown here.</p>
      <div class="a-buttons">
        <a class="btn-ink small" href="/api/experiences/${cur.id}/export?format=csv">Export CSV</a>
        <a class="btn-text" href="/api/experiences/${cur.id}/export?format=json">export JSON</a>
        <button class="btn-text" type="button" id="ansRefresh">refresh</button>
        <button class="btn-text danger" type="button" id="ansClear">clear answers</button>
      </div>
      ${answered.length ? `<ol class="ans-list">${answered.map((q) => `<li><span class="a-label">${esc(q.cat)}</span><p class="ans-q">${esc(q.q)}</p><p class="ans-a">${esc(ans[q.id])}</p></li>`).join("")}</ol>`
        : `<p class="a-empty">No answers yet. <span class="hand">they'll show up here as soon as ${esc(cur.name)} starts typing.</span></p>`}`;
    },
  };

  function renderPanel(keepScroll) {
    const y = scrollY;
    const panel = $("#panel");
    panel.innerHTML = PANELS[tab]();
    bindInputs(panel); bindLists(panel);
    wire[tab] && wire[tab](panel);
    if (keepScroll) scrollTo(0, y);
    else if (G && !matchMedia("(prefers-reduced-motion: reduce)").matches) G.fromTo(panel, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .35, ease: "power2.out" });
  }

  const wire = {
    sections(p) {
      $$("[data-mv]", p).forEach((b) => b.onclick = () => {
        const i = +b.dataset.i, j = b.dataset.mv === "up" ? i - 1 : i + 1, a = cur.sections;
        [a[i], a[j]] = [a[j], a[i]]; setDirty(); renderPanel(true);
      });
      $$("input[type=checkbox]", p).forEach((c) => c.addEventListener("change", () => c.closest("li").classList.toggle("off", !c.checked)));
    },
    questions(p) {
      const Q = cur.questions;
      $$("[data-qmv]", p).forEach((b) => b.onclick = () => { const i = +b.dataset.i, j = b.dataset.qmv === "up" ? i - 1 : i + 1; [Q[i], Q[j]] = [Q[j], Q[i]]; setDirty(); renderPanel(true); });
      $$("[data-qdel]", p).forEach((b) => b.onclick = () => { const i = +b.dataset.qdel; if (!confirm(`Delete “${Q[i].q.slice(0, 60)}”?`)) return; Q.splice(i, 1); setDirty(); renderPanel(true); });
      $$("[data-qtype]", p).forEach((s) => s.onchange = () => {
        const q = Q[+s.dataset.qtype]; q.type = s.value;
        if (q.type === "choice" && q.options.length < 2) q.options = [{ t: "", r: "" }, { t: "", r: "" }];
        setDirty(); renderPanel(true);
      });
      $$("[data-oadd]", p).forEach((b) => b.onclick = () => { Q[+b.dataset.oadd].options.push({ t: "", r: "" }); setDirty(); renderPanel(true); });
      $$("[data-odel]", p).forEach((b) => b.onclick = () => { const [i, k] = b.dataset.odel.split(".").map(Number); Q[i].options.splice(k, 1); setDirty(); renderPanel(true); });
      $$("input[type=checkbox]", p).forEach((c) => c.addEventListener("change", () => c.closest("li").classList.toggle("off", !c.checked)));
      $("#qAllOn", p).onclick = () => { Q.forEach((q) => (q.on = true)); setDirty(); renderPanel(true); };
      $("#qAllOff", p).onclick = () => { Q.forEach((q) => (q.on = false)); setDirty(); renderPanel(true); };
      $("#qAdd", p).onclick = () => {
        Q.push({ id: "", cat: Q[Q.length - 1]?.cat || "My questions", q: "New question?", type: "text", options: [], on: true });
        setDirty(); renderPanel(true);
        const last = $$(".qe-q", p).pop(); last.focus(); last.select();
      };
    },
    scrapbook(p) {
      $$("[data-up]", p).forEach((inp) => inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        const i = +inp.dataset.up;
        try {
          toast("Uploading…");
          const blob = await resize(f);
          const { url } = await api("POST", `/api/experiences/${cur.id}/photos`, undefined, blob);
          cur.scrapbook[i].photo = url; setDirty(); renderPanel(true);
          toast("Photo added. Save to keep it.");
        } catch (ex) { toast(ex.message); }
      });
      $$("[data-unphoto]", p).forEach((b) => b.onclick = () => { cur.scrapbook[+b.dataset.unphoto].photo = ""; setDirty(); renderPanel(true); });
      $$("[data-sbdel]", p).forEach((b) => b.onclick = () => { cur.scrapbook.splice(+b.dataset.sbdel, 1); setDirty(); renderPanel(true); });
      const add = $("#sbAdd", p);
      if (add) add.onclick = () => { cur.scrapbook.push({ photo: "", caption: "", note: "", art: ["sun", "moon", "tea", "sea", "flower", "stars"][cur.scrapbook.length % 6] }); setDirty(); renderPanel(true); };
    },
    answers(p) {
      $("#ansRefresh", p).onclick = async () => {
        if (dirty && !confirm("Refreshing will discard unsaved edits. Continue?")) return;
        cur = await api("GET", `/api/experiences/${cur.id}`); setDirty(false); renderPanel(true); loadList();
      };
      $("#ansClear", p).onclick = async () => {
        if (!confirm(`Clear all of ${cur.name}'s answers and quiz results? This can't be undone.`)) return;
        const fresh = await api("DELETE", `/api/experiences/${cur.id}/responses`);
        cur.responses = fresh.responses; renderPanel(true); loadList(); toast("Answers cleared");
      };
    },
  };

  // downscale photos in the browser before upload (max 1600px, JPEG)
  function resize(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) return reject(new Error("That isn't an image."));
      if (file.type === "image/gif") return file.size < 8e6 ? resolve(file) : reject(new Error("That GIF is too large (8 MB max)."));
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo."))), "image/jpeg", .86);
      };
      img.onerror = () => reject(new Error("Couldn't read that photo."));
      img.src = URL.createObjectURL(file);
    });
  }

  boot().catch((e) => toast(e.message));
})();
