/* The envelope editor: every section, with autosave and a live phone preview beside it. */
(function () {
  const { $, $$, esc, api, toast, confirmDo } = UI;
  const C = window.LW_CATALOG;

  const TABS = [
    ["setup", "Who it's for"], ["arrange", "Order of things"], ["opening", "Opening message"], ["compliments", "Compliments"], ["gallery", "Photo memories"],
    ["questions", "Questions"], ["letters", "Personal letters"], ["bouquet", "Virtual bouquet"], ["secrets", "Secret messages"], ["quiz", "A little quiz"], ["proposal", "The big question"], ["finale", "Final letter"],
  ];
  const TOKEN_HINT = `<p class="hint">Write <code>{name}</code> for their name and <code>{from}</code> for yours, and they'll fill in by themselves. <code>{they}</code>, <code>{them}</code> and <code>{their}</code> follow the wording you chose for them.</p>`;
  const MAX_SIDE = 1800, MAX_RAW = 25 * 1024 * 1024;

  const StudioEditor = {};
  StudioEditor.mount = async function (app, id) {
    let env = await api("GET", `/api/studio/envelopes/${id}`);
    let tab = "setup", saveTimer = null, previewTimer = null, saving = false, dirty = false, uploading = 0;

    app.className = "studio-main editor-page";
    app.innerHTML = `
      <div class="ed-bar">
        <a class="linkish" href="/studio/experiences">← My envelopes</a>
        <div class="ed-title"><strong id="edName"></strong><span id="edState" class="chip"></span></div>
        <span id="edSave" class="ed-save" role="status" aria-live="polite">All saved</span>
        <button type="button" class="btn small quiet ed-only-m" id="edToggle">Preview</button>
        <button type="button" class="btn small primary" id="edPublish"></button>
      </div>
      <div class="ed-grid">
        <nav class="ed-nav" id="edNav" aria-label="Sections"></nav>
        <section class="ed-form" id="edForm" aria-live="off"></section>
        <aside class="ed-preview" id="edPreview" aria-label="Live preview">
          <div class="phone"><iframe id="pv" title="Live preview of the envelope" src="/studio/preview/${esc(id)}?at=opening"></iframe></div>
          <p class="fine pv-note">This is what they'll see. Your edits appear within a couple of seconds.</p>
        </aside>
      </div>`;
    const form = $("#edForm"), iframe = $("#pv");

    /* ---------------- saving ---------------- */
    const setSave = (s) => { $("#edSave").textContent = s; };
    const statusLabels = { published: "Live", draft: "Draft", disabled: "Link off", expired: "Expired", removed: "Taken down", suspended: "Paused" };
    function bar() {
      $("#edName").textContent = `For ${env.recipientName || "someone"}`;
      const s = $("#edState"); s.textContent = statusLabels[env.linkStatus] || "Draft"; s.className = `chip chip-${env.linkStatus === "published" ? "ok" : env.linkStatus === "draft" ? "draft" : "off"}`;
      $("#edPublish").textContent = env.status === "published" ? "Share" : "Publish";
    }
    async function saveNow() {
      if (saving || uploading) { saveTimer = setTimeout(saveNow, 500); return; }
      saving = true; dirty = false; setSave("Saving…");
      try {
        const saved = await api("PUT", `/api/studio/envelopes/${id}`, env);
        env.linkStatus = saved.linkStatus; env.updatedAt = saved.updatedAt;
        setSave(dirty ? "Saving…" : "All saved"); bar();
        schedulePreview();
      } catch (x) { dirty = true; setSave("Couldn't save"); toast(x.message, true); }
      saving = false;
      if (dirty) { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 1000); }
    }
    function changed() {
      dirty = true; setSave("Saving…");
      clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 800);
    }
    async function flush() { clearTimeout(saveTimer); if (dirty) await saveNow(); }
    addEventListener("beforeunload", (e) => { if (dirty || uploading) { e.preventDefault(); e.returnValue = ""; } });

    const TAB_CHAPTER = { setup: "opening", arrange: "opening", opening: "opening", compliments: "compliments", gallery: "gallery", questions: "questions", letters: "letters", bouquet: "bouquet", secrets: "secrets", quiz: "quiz", proposal: "proposal", finale: "finale" };
    function schedulePreview() {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => { iframe.src = `/studio/preview/${id}?at=${TAB_CHAPTER[tab]}&t=${Date.now()}`; }, 250);
    }

    /* ---------------- field helpers ---------------- */
    const on = (sid) => env.sections.find((s) => s.id === sid)?.on;
    function sectionSwitch(sid) {
      return `<label class="switch sec-switch"><input type="checkbox" data-sec="${sid}" ${on(sid) ? "checked" : ""}><span>Include this in the envelope</span></label>`;
    }
    function wireSwitch() {
      $$("[data-sec]", form).forEach((c) => (c.onchange = () => { env.sections.find((s) => s.id === c.dataset.sec).on = c.checked; changed(); navRender(); }));
    }
    const input = (label, bind, val, attrs = "") => `<label class="fld"><span>${esc(label)}</span><input data-b="${bind}" value="${esc(val)}" ${attrs}></label>`;
    const area = (label, bind, val, rows = 4, attrs = "") => `<label class="fld"><span>${esc(label)}</span><textarea data-b="${bind}" rows="${rows}" ${attrs}>${esc(val)}</textarea></label>`;
    function setPath(path, value) {
      const parts = path.split("."); let o = env;
      for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
      o[parts[parts.length - 1]] = value;
    }
    function wireBinds() {
      $$("[data-b]", form).forEach((el) => { el.oninput = () => { setPath(el.dataset.b, el.value); changed(); if (el.dataset.b === "recipientName") bar(); }; });
    }
    const arrows = (i, n) => `<span class="mv"><button type="button" class="mv-b" data-up="${i}" aria-label="Move up"${i === 0 ? " disabled" : ""}>↑</button><button type="button" class="mv-b" data-down="${i}" aria-label="Move down"${i === n - 1 ? " disabled" : ""}>↓</button></span>`;
    const swap = (a, i, j) => { [a[i], a[j]] = [a[j], a[i]]; };

    // an editable list of strings (compliments, flower notes, lines)
    function stringList(host, list, { placeholder, addLabel, rows = 2, max = 40 }) {
      const draw = () => {
        host.innerHTML = `${list.map((s, i) => `<div class="li"><textarea rows="${rows}" data-i="${i}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)} ${i + 1}">${esc(s)}</textarea><div class="li-ctl">${arrows(i, list.length)}<button type="button" class="mv-b" data-x="${i}" aria-label="Remove">×</button></div></div>`).join("")}
          ${list.length < max ? `<button type="button" class="btn small quiet add" >${esc(addLabel)}</button>` : ""}`;
        $$("textarea", host).forEach((t) => (t.oninput = () => { list[+t.dataset.i] = t.value; changed(); }));
        $$("[data-up]", host).forEach((b) => (b.onclick = () => { swap(list, +b.dataset.up, +b.dataset.up - 1); changed(); draw(); }));
        $$("[data-down]", host).forEach((b) => (b.onclick = () => { swap(list, +b.dataset.down, +b.dataset.down + 1); changed(); draw(); }));
        $$("[data-x]", host).forEach((b) => (b.onclick = () => { list.splice(+b.dataset.x, 1); changed(); draw(); }));
        const add = $(".add", host);
        if (add) add.onclick = () => { list.push(""); draw(); $$("textarea", host).pop().focus(); };
      };
      draw();
    }

    /* ---------------- panels ---------------- */
    const P = {};
    P.setup = () => {
      const propose = env.intent === "propose";
      form.innerHTML = `<h2>Who it's for</h2>
        ${input("Their name", "recipientName", env.recipientName, 'maxlength="60" required')}
        ${input("Your name, as they know you", "fromName", env.fromName, 'maxlength="60"')}
        <fieldset class="fset"><legend>How should we refer to them?</legend><p class="hint">This only changes words like "she" or "they".</p><div class="seg">${[["female", "Female"], ["male", "Male"], ["unspecified", "Prefer not to specify"]].map(([v, l]) => `<label><input type="radio" name="g" value="${v}" ${env.gender === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></fieldset>
        <fieldset class="fset"><legend>The idea</legend>
          <p class="now"><b>${esc(C.RELATIONSHIPS[env.relationship].label)}</b> · ${esc(C.intentFor(env.relationship, env.intent)?.label || "")}</p>
          <div class="restyle">
            <label class="fld"><span>Who it's for</span><select id="rsRel">${C.relationshipIds.map((r) => `<option value="${r}" ${r === env.relationship ? "selected" : ""}>${esc(C.RELATIONSHIPS[r].label)}</option>`).join("")}</select></label>
            <label class="fld"><span>What you're making</span><select id="rsInt"></select></label>
            <button type="button" class="btn small quiet" id="rsGo">Change and rewrite</button>
          </div>
          <p class="hint">Changing this rewrites the words and questions in the new voice. Your photographs stay.</p></fieldset>
        <fieldset class="fset"><legend>Background</legend><div class="seg">${[["fireflies", "Fireflies"], ["petals", "Petals"], ["confetti", "Confetti"], ["pollen", "Pollen"], ["stars", "Stars"]].map(([v, l]) => `<label><input type="radio" name="amb" value="${v}" ${env.ambience === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></fieldset>`;
      wireBinds();
      const fillIntents = () => { const r = $("#rsRel").value; $("#rsInt").innerHTML = C.INTENTS[r].map((x) => `<option value="${esc(x.id)}" ${x.id === env.intent && r === env.relationship ? "selected" : ""}>${esc(x.label)}</option>`).join(""); };
      fillIntents(); $("#rsRel").onchange = fillIntents;
      $$("input[name=g]", form).forEach((r) => (r.onchange = () => { env.gender = r.value; changed(); }));
      $$("input[name=amb]", form).forEach((r) => (r.onchange = () => { env.ambience = r.value; changed(); }));
      $("#rsGo").onclick = async () => {
        if (!(await confirmDo("Rewrite this envelope?", "Your edited words and questions will be replaced by a fresh draft for this idea. Your photographs stay.", "Rewrite it", "btn primary"))) return;
        await flush();
        try {
          env = await api("POST", `/api/studio/envelopes/${id}/restyle`, { relationship: $("#rsRel").value, intent: $("#rsInt").value });
          location.reload();
        } catch (x) { toast(x.message, true); }
      };
    };

    P.arrange = () => {
      const draw = () => {
        form.innerHTML = `<h2>Order of things</h2><p class="lede-sm">Switch parts on and off, and drag them, or use the arrows, to choose the order they appear in.</p>
        <ol class="arr">${env.sections.map((s, i) => `<li class="arr-i${s.on ? "" : " off"}" draggable="true" data-i="${i}"><span class="grip" aria-hidden="true">⋮⋮</span><label class="switch"><input type="checkbox" data-t="${i}" ${s.on ? "checked" : ""}><span>${esc(C.SECTION_LABELS[s.id])}</span></label>${arrows(i, env.sections.length)}</li>`).join("")}</ol>`;
        $$("[data-t]", form).forEach((c) => (c.onchange = () => { env.sections[+c.dataset.t].on = c.checked; changed(); navRender(); draw(); }));
        $$("[data-up]", form).forEach((b) => (b.onclick = () => { swap(env.sections, +b.dataset.up, +b.dataset.up - 1); changed(); draw(); }));
        $$("[data-down]", form).forEach((b) => (b.onclick = () => { swap(env.sections, +b.dataset.down, +b.dataset.down + 1); changed(); draw(); }));
        dragList($$(".arr-i", form), (from, to) => { const [m] = env.sections.splice(from, 1); env.sections.splice(to, 0, m); changed(); draw(); });
      };
      draw();
    };
    function dragList(items, move) {
      let from = null;
      items.forEach((el) => {
        el.ondragstart = (e) => { from = +el.dataset.i; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", el.dataset.i); el.classList.add("dragging"); };
        el.ondragend = () => el.classList.remove("dragging");
        el.ondragover = (e) => { e.preventDefault(); el.classList.add("drop"); };
        el.ondragleave = () => el.classList.remove("drop");
        el.ondrop = (e) => { e.preventDefault(); el.classList.remove("drop"); const to = +el.dataset.i; if (from !== null && from !== to) move(from, to); };
      });
    }

    P.opening = () => {
      form.innerHTML = `<h2>Opening message</h2>${sectionSwitch("opening")}
        ${input("A small line above it", "opening.kicker", env.opening.kicker, 'maxlength="120"')}
        ${input("Greeting", "opening.greeting", env.opening.greeting, 'maxlength="120"')}
        ${area("Your opening words", "opening.message", env.opening.message, 6, 'maxlength="2000"')}${TOKEN_HINT}`;
      wireBinds(); wireSwitch();
    };

    P.compliments = () => {
      form.innerHTML = `<h2>Compliments</h2>${sectionSwitch("compliments")}${input("Heading", "titles.compliments", env.titles.compliments, 'maxlength="120"')}
        <p class="lede-sm">${esc(C.fill("{They} will tap through these one at a time. Change them to things only you would say to {them}.", env))}</p><div id="cl"></div>${TOKEN_HINT}`;
      wireBinds(); wireSwitch();
      stringList($("#cl"), env.compliments, { placeholder: "Something true and kind", addLabel: "Add a compliment", max: 40 });
    };

    /* photos */
    P.gallery = () => {
      const g = env.gallery;
      const draw = () => {
        form.innerHTML = `<h2>Add your favourite memories</h2>${sectionSwitch("gallery")}${input("Heading", "titles.gallery", env.titles.gallery, 'maxlength="120"')}
          <label class="drop-zone" id="dz"><input type="file" id="fileIn" accept="image/jpeg,image/png,image/webp,image/gif" multiple><strong>Drop your photographs here</strong><span>or tap to choose them. JPG, PNG, WebP or GIF, up to 40.</span></label>
          <div id="upList" class="up-list" aria-live="polite"></div>
          ${g.photos.length ? `<ol class="ph-list">${g.photos.map((p, i) => `<li class="ph" draggable="true" data-i="${i}">
              <img src="${esc(p.url)}" alt="${esc(p.caption || `Photograph ${i + 1}`)}" loading="lazy">
              <div class="ph-body"><input class="ph-cap" data-pc="${i}" maxlength="160" placeholder="Add a caption" value="${esc(p.caption)}" aria-label="Caption for photograph ${i + 1}">
                <div class="ph-opts"><label class="tick"><input type="radio" name="cover" data-cover="${esc(p.id)}" ${g.coverId === p.id ? "checked" : ""}><span>Cover</span></label><label class="tick"><input type="checkbox" data-inter="${i}" ${p.interlude ? "checked" : ""}><span>Also show between messages</span></label></div></div>
              <div class="li-ctl">${arrows(i, g.photos.length)}<button type="button" class="mv-b" data-xp="${esc(p.id)}" aria-label="Delete photograph ${i + 1}">×</button></div></li>`).join("")}</ol>` : `<p class="hint">No photographs yet. Without any, this part is skipped.</p>`}
          <fieldset class="fset"><legend>How should they appear?</legend><div class="layouts">${Object.entries(C.GALLERY_LAYOUTS).map(([k, l]) => `<label class="lay"><input type="radio" name="lay" value="${k}" ${g.layout === k ? "checked" : ""}><span class="lay-art lay-${k}" aria-hidden="true"><i></i><i></i><i></i></span><span>${esc(l)}</span></label>`).join("")}</div></fieldset>
          <label class="switch"><input type="checkbox" id="gShow" ${g.slideshow ? "checked" : ""}><span>Offer an animated slideshow</span></label>
          <label class="switch"><input type="checkbox" id="gPrev" ${g.previewCover ? "checked" : ""}><span>Show the cover photograph in the WhatsApp preview</span></label>
          <p class="hint">If you leave this off, the WhatsApp preview shows an illustration, so the surprise stays a surprise.</p>`;
        wireBinds(); wireSwitch();
        const fileIn = $("#fileIn"), dz = $("#dz");
        fileIn.onchange = () => { upload([...fileIn.files]); fileIn.value = ""; };
        ["dragenter", "dragover"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add("over"); }));
        ["dragleave", "drop"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
        dz.addEventListener("drop", (e) => upload([...e.dataTransfer.files]));
        $$("[data-pc]", form).forEach((t) => (t.oninput = () => { g.photos[+t.dataset.pc].caption = t.value; changed(); }));
        $$("[data-cover]", form).forEach((t) => (t.onchange = () => { g.coverId = t.dataset.cover; changed(); }));
        $$("[data-inter]", form).forEach((t) => (t.onchange = () => { g.photos[+t.dataset.inter].interlude = t.checked; changed(); }));
        $$("[data-up]", form).forEach((b) => (b.onclick = () => { swap(g.photos, +b.dataset.up, +b.dataset.up - 1); changed(); draw(); }));
        $$("[data-down]", form).forEach((b) => (b.onclick = () => { swap(g.photos, +b.dataset.down, +b.dataset.down + 1); changed(); draw(); }));
        $$("[data-xp]", form).forEach((b) => (b.onclick = async () => {
          if (!(await confirmDo("Delete this photograph?", "It will be removed from the envelope."))) return;
          await flush();
          try {
            const res = await api("DELETE", `/api/studio/envelopes/${id}/photos/${b.dataset.xp}`);
            g.photos = g.photos.filter((p) => p.id !== b.dataset.xp); g.coverId = res.coverId;
            env.letters.forEach((l) => { if (l.photoId === b.dataset.xp) l.photoId = ""; });
            draw(); schedulePreview();
          } catch (x) { toast(x.message, true); }
        }));
        dragList($$(".ph", form), (from, to) => { const [m] = g.photos.splice(from, 1); g.photos.splice(to, 0, m); changed(); draw(); });
        $$("input[name=lay]", form).forEach((r) => (r.onchange = () => { g.layout = r.value; changed(); }));
        $("#gShow").onchange = (e) => { g.slideshow = e.target.checked; changed(); };
        $("#gPrev").onchange = (e) => { g.previewCover = e.target.checked; changed(); };
      };

      async function upload(files) {
        const list = $("#upList");
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!files.length) return;
        uploading++;
        await flush().catch(() => {});
        for (const file of files) {
          const row = document.createElement("p"); row.className = "up"; row.textContent = `Adding ${file.name}…`; list?.append(row);
          try {
            if (!allowed.includes(file.type)) throw new Error("isn't a JPG, PNG, WebP or GIF");
            if (file.size > MAX_RAW) throw new Error("is larger than 25 MB");
            const blob = await prepare(file);
            const res = await api("POST", `/api/studio/envelopes/${id}/photos`, undefined, blob);
            g.photos.push({ ...res.photo }); g.coverId = res.coverId;
            row.remove();
          } catch (x) { row.classList.add("bad"); row.textContent = `${file.name} ${x.message}`; }
        }
        uploading--;
        const errs = $$(".up.bad", list).map((e) => e.outerHTML).join("");
        if (tab === "gallery") { draw(); if (errs) $("#upList").innerHTML = errs; }
        schedulePreview();
      }
      draw();
    };
    // shrinks large photos in the browser so that uploads are quick, even on mobile data
    function prepare(file) {
      if (file.type === "image/gif") { if (file.size > 3.8 * 1024 * 1024) return Promise.reject(new Error("is too large for a GIF (3.8 MB at most)")); return Promise.resolve(file); }
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file), im = new Image();
        im.onload = () => {
          URL.revokeObjectURL(url);
          const k = Math.min(1, MAX_SIDE / Math.max(im.naturalWidth, im.naturalHeight));
          const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          c.toBlob((b) => (b ? resolve(b) : reject(new Error("couldn't be read"))), "image/jpeg", .84);
        };
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("couldn't be read")); };
        im.src = url;
      });
    }

    /* questions */
    P.questions = () => {
      const qs = env.questions;
      const bank = C.bankFor(env.relationship).filter((q) => !qs.some((x) => x.q === q));
      const draw = () => {
        form.innerHTML = `<h2>Questions</h2>${sectionSwitch("questions")}${input("Heading", "titles.questions", env.titles.questions, 'maxlength="120"')}
          <p class="lede-sm">${esc(C.fill("One question at a time, and any can be skipped. Before starting, we tell {them} that you'll read {their} answers.", env))}</p>
          <div class="qlist">${qs.map((q, i) => `<div class="qi${q.on ? "" : " off"}">
            <div class="qi-top"><label class="tick"><input type="checkbox" data-qon="${i}" ${q.on ? "checked" : ""}><span>Ask</span></label><div class="li-ctl">${arrows(i, qs.length)}<button type="button" class="mv-b" data-qx="${i}" aria-label="Remove question">×</button></div></div>
            <textarea rows="2" data-qt="${i}" maxlength="300" aria-label="Question ${i + 1}">${esc(q.q)}</textarea>
            <div class="seg seg-sm"><label><input type="radio" name="qty${i}" data-qty="${i}" value="text" ${q.type === "text" ? "checked" : ""}><span>Written answer</span></label><label><input type="radio" name="qty${i}" data-qty="${i}" value="choice" ${q.type === "choice" ? "checked" : ""}><span>Multiple choice</span></label></div>
            ${q.type === "choice" ? `<div class="opts">${q.options.map((o, j) => `<div class="opt"><input data-qo="${i}:${j}" maxlength="140" value="${esc(o)}" aria-label="Choice ${j + 1}"><button type="button" class="mv-b" data-qox="${i}:${j}" aria-label="Remove choice"${q.options.length <= 2 ? " disabled" : ""}>×</button></div>`).join("")}${q.options.length < 6 ? `<button type="button" class="btn small quiet" data-qoa="${i}">Add a choice</button>` : ""}</div>` : ""}
          </div>`).join("")}</div>
          <div class="q-add"><button type="button" class="btn small quiet" id="qAdd">Write my own question</button>
            ${bank.length ? `<label class="fld fld-inline"><span>Or add from our ideas</span><select id="qBank"><option value="">Choose a question…</option>${bank.map((q) => `<option>${esc(q)}</option>`).join("")}</select></label>` : ""}</div>`;
        wireBinds(); wireSwitch();
        $$("[data-qt]", form).forEach((t) => (t.oninput = () => { qs[+t.dataset.qt].q = t.value; changed(); }));
        $$("[data-qon]", form).forEach((t) => (t.onchange = () => { qs[+t.dataset.qon].on = t.checked; changed(); t.closest(".qi").classList.toggle("off", !t.checked); }));
        $$("[data-qty]", form).forEach((t) => (t.onchange = () => { const q = qs[+t.dataset.qty]; q.type = t.value; if (q.type === "choice" && q.options.length < 2) q.options = ["", ""]; changed(); draw(); }));
        $$("[data-qo]", form).forEach((t) => (t.oninput = () => { const [i, j] = t.dataset.qo.split(":").map(Number); qs[i].options[j] = t.value; changed(); }));
        $$("[data-qox]", form).forEach((b) => (b.onclick = () => { const [i, j] = b.dataset.qox.split(":").map(Number); qs[i].options.splice(j, 1); changed(); draw(); }));
        $$("[data-qoa]", form).forEach((b) => (b.onclick = () => { qs[+b.dataset.qoa].options.push(""); draw(); }));
        $$("[data-qx]", form).forEach((b) => (b.onclick = () => { qs.splice(+b.dataset.qx, 1); changed(); draw(); }));
        $$("[data-up]", form).forEach((b) => (b.onclick = () => { swap(qs, +b.dataset.up, +b.dataset.up - 1); changed(); draw(); }));
        $$("[data-down]", form).forEach((b) => (b.onclick = () => { swap(qs, +b.dataset.down, +b.dataset.down + 1); changed(); draw(); }));
        const newId = () => "n" + Math.random().toString(36).slice(2, 12);
        $("#qAdd").onclick = () => { qs.push({ id: newId(), q: "", type: "text", options: [], on: true }); draw(); $$("[data-qt]", form).pop().focus(); };
        const sel = $("#qBank");
        if (sel) sel.onchange = () => { if (sel.value) { qs.push({ id: newId(), q: sel.value, type: "text", options: [], on: true }); changed(); P.questions(); } };
      };
      draw();
    };

    /* letters */
    P.letters = () => {
      const ls = env.letters, ps = env.gallery.photos;
      const draw = () => {
        form.innerHTML = `<h2>Personal letters</h2>${sectionSwitch("letters")}${input("Heading", "titles.letters", env.titles.letters, 'maxlength="120"')}
          <div class="llist">${ls.map((l, i) => `<div class="qi"><div class="qi-top"><strong>Letter ${i + 1}</strong><div class="li-ctl">${arrows(i, ls.length)}<button type="button" class="mv-b" data-lx="${i}" aria-label="Remove letter">×</button></div></div>
            <label class="fld"><span>On the envelope</span><input data-lt="${i}" maxlength="100" value="${esc(l.title)}"></label>
            <label class="fld"><span>The letter</span><textarea rows="6" data-lb="${i}" maxlength="4000">${esc(l.text)}</textarea></label>
            ${ps.length ? `<label class="fld"><span>Tuck a photograph inside</span><select data-lp="${i}"><option value="">No photograph</option>${ps.map((p, n) => `<option value="${esc(p.id)}" ${l.photoId === p.id ? "selected" : ""}>${esc(p.caption || `Photograph ${n + 1}`)}</option>`).join("")}</select></label>` : ""}</div>`).join("")}</div>
          ${ls.length < 8 ? `<button type="button" class="btn small quiet" id="lAdd">Add a letter</button>` : ""}${TOKEN_HINT}`;
        wireBinds(); wireSwitch();
        $$("[data-lt]", form).forEach((t) => (t.oninput = () => { ls[+t.dataset.lt].title = t.value; changed(); }));
        $$("[data-lb]", form).forEach((t) => (t.oninput = () => { ls[+t.dataset.lb].text = t.value; changed(); }));
        $$("[data-lp]", form).forEach((t) => (t.onchange = () => { ls[+t.dataset.lp].photoId = t.value; changed(); }));
        $$("[data-lx]", form).forEach((b) => (b.onclick = () => { ls.splice(+b.dataset.lx, 1); changed(); draw(); }));
        $$("[data-up]", form).forEach((b) => (b.onclick = () => { swap(ls, +b.dataset.up, +b.dataset.up - 1); changed(); draw(); }));
        $$("[data-down]", form).forEach((b) => (b.onclick = () => { swap(ls, +b.dataset.down, +b.dataset.down + 1); changed(); draw(); }));
        const add = $("#lAdd"); if (add) add.onclick = () => { ls.push({ title: "Open when…", text: "", photoId: "" }); changed(); draw(); };
      };
      draw();
    };

    /* bouquet */
    P.bouquet = () => {
      const b = env.bouquet, K = C.BOUQUET;
      const thumb = (k) => { const col = K.kinds[k].colors[0]; return k === "mixed" ? `<svg viewBox="-55 -60 110 100">${`<g transform="translate(-20 -6) scale(.62)">${Bouquet.head("redrose", "#A3243B")}</g><g transform="translate(22 -14) scale(.56)">${Bouquet.head("sunflower", "#F2B632")}</g><g transform="translate(2 18) scale(.5)">${Bouquet.head("daisy", "#FFFDF6")}</g>`}</svg>` : `<svg viewBox="-42 -50 84 84">${Bouquet.head(k, col)}</svg>`; };
      const refresh = () => { $("#bqLive").innerHTML = Bouquet.svg(b); };
      const draw = () => {
        const colors = K.kinds[b.kind].colors;
        form.innerHTML = `<h2>Virtual bouquet</h2>${sectionSwitch("bouquet")}${input("Heading", "titles.bouquet", env.titles.bouquet, 'maxlength="120"')}
          <div class="bq-edit"><div class="bq-live" id="bqLive"></div><div class="bq-controls">
            <fieldset class="fset"><legend>Flowers</legend><div class="kinds">${Object.entries(K.kinds).map(([k, v]) => `<label class="kind"><input type="radio" name="kind" value="${k}" ${b.kind === k ? "checked" : ""}><span class="kind-art">${thumb(k)}</span><span>${esc(v.label)}</span></label>`).join("")}</div></fieldset>
            ${b.kind !== "mixed" && colors.length > 1 ? `<fieldset class="fset"><legend>Colour</legend><div class="swatches">${colors.map((c) => `<label class="sw"><input type="radio" name="col" value="${c}" ${b.color === c ? "checked" : ""}><span style="background:${c}" aria-label="${c}"></span></label>`).join("")}</div></fieldset>` : ""}
            <label class="fld"><span>How many: <b id="bqN">${b.count}</b></span><input type="range" min="3" max="12" id="bqCount" value="${b.count}"></label>
            <label class="fld"><span>Wrapping</span><select id="bqWrap">${Object.entries(K.wraps).map(([k, v]) => `<option value="${k}" ${b.wrap === k ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select></label>
            <label class="fld"><span>Ribbon</span><select id="bqRib">${Object.entries(K.ribbons).map(([k, v]) => `<option value="${k}" ${b.ribbon === k ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select></label>
            <label class="fld"><span>How it arrives</span><select id="bqAnim">${Object.entries(K.anims).map(([k, v]) => `<option value="${k}" ${b.anim === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
          </div></div>
          ${area("A note on the bouquet", "bouquet.note", b.note, 2, 'maxlength="600"')}
          <h3 class="sub-h">Notes hidden inside the flowers</h3><p class="hint">${esc(C.fill("{They} will tap a flower to find one.", env))}</p><div id="msgs"></div>`;
        wireBinds(); wireSwitch(); refresh();
        $$("input[name=kind]", form).forEach((r) => (r.onchange = () => { b.kind = r.value; b.color = K.kinds[r.value].colors[0]; changed(); draw(); }));
        $$("input[name=col]", form).forEach((r) => (r.onchange = () => { b.color = r.value; changed(); refresh(); }));
        $("#bqCount").oninput = (e) => { b.count = +e.target.value; $("#bqN").textContent = b.count; changed(); refresh(); };
        $("#bqWrap").onchange = (e) => { b.wrap = e.target.value; changed(); refresh(); };
        $("#bqRib").onchange = (e) => { b.ribbon = e.target.value; changed(); refresh(); };
        $("#bqAnim").onchange = (e) => { b.anim = e.target.value; changed(); };
        stringList($("#msgs"), b.messages, { placeholder: "A hidden note", addLabel: "Add a note", max: 12 });
      };
      draw();
    };

    P.secrets = () => {
      const list = env.secrets;
      const draw = () => {
        form.innerHTML = `<h2>Secret messages</h2>${sectionSwitch("secrets")}${input("Heading", "titles.secrets", env.titles.secrets, 'maxlength="120"')}
          <p class="lede-sm">${esc(C.fill("Each one stays sealed until {they} taps it.", env).replace("they taps", "they tap"))}</p>
          <div class="llist">${list.map((s, i) => `<div class="qi"><div class="qi-top"><strong>Secret ${i + 1}</strong><div class="li-ctl">${arrows(i, list.length)}<button type="button" class="mv-b" data-sx="${i}" aria-label="Remove secret">×</button></div></div>
            <label class="fld"><span>On the seal</span><input data-sl="${i}" maxlength="60" value="${esc(s.label)}"></label><label class="fld"><span>The secret</span><textarea rows="2" data-st="${i}" maxlength="500">${esc(s.text)}</textarea></label></div>`).join("")}</div>
          ${list.length < 8 ? `<button type="button" class="btn small quiet" id="sAdd">Add a secret</button>` : ""}`;
        wireBinds(); wireSwitch();
        $$("[data-sl]", form).forEach((t) => (t.oninput = () => { list[+t.dataset.sl].label = t.value; changed(); }));
        $$("[data-st]", form).forEach((t) => (t.oninput = () => { list[+t.dataset.st].text = t.value; changed(); }));
        $$("[data-sx]", form).forEach((b) => (b.onclick = () => { list.splice(+b.dataset.sx, 1); changed(); draw(); }));
        $$("[data-up]", form).forEach((b) => (b.onclick = () => { swap(list, +b.dataset.up, +b.dataset.up - 1); changed(); draw(); }));
        $$("[data-down]", form).forEach((b) => (b.onclick = () => { swap(list, +b.dataset.down, +b.dataset.down + 1); changed(); draw(); }));
        const add = $("#sAdd"); if (add) add.onclick = () => { list.push({ label: "a secret", text: "" }); changed(); draw(); };
      };
      draw();
    };

    P.quiz = () => {
      const q = env.quiz;
      form.innerHTML = `<h2>A little quiz</h2>${sectionSwitch("quiz")}<p class="lede-sm">A short, playful quiz. They choose whether to send you the result.</p>
        ${input("Title", "quiz.title", q.title, 'maxlength="120"')}
        ${q.questions.map((it, i) => `<div class="qi"><label class="fld"><span>Question ${i + 1}</span><input data-zq="${i}" maxlength="200" value="${esc(it.q)}"></label>${it.options.map((o, j) => `<label class="fld fld-opt"><span>Answer ${j + 1}</span><input data-zo="${i}:${j}" maxlength="140" value="${esc(o.t)}"></label>`).join("")}</div>`).join("")}
        <h3 class="sub-h">Results</h3>${Object.entries(q.results).map(([k, r]) => `<div class="qi"><label class="fld"><span>Result name</span><input data-zr="${esc(k)}" maxlength="80" value="${esc(r.title)}"></label><label class="fld"><span>What it says</span><textarea rows="2" data-zt="${esc(k)}" maxlength="400">${esc(r.text)}</textarea></label></div>`).join("")}`;
      wireBinds(); wireSwitch();
      $$("[data-zq]", form).forEach((t) => (t.oninput = () => { q.questions[+t.dataset.zq].q = t.value; changed(); }));
      $$("[data-zo]", form).forEach((t) => (t.oninput = () => { const [i, j] = t.dataset.zo.split(":").map(Number); q.questions[i].options[j].t = t.value; changed(); }));
      $$("[data-zr]", form).forEach((t) => (t.oninput = () => { q.results[t.dataset.zr].title = t.value; changed(); }));
      $$("[data-zt]", form).forEach((t) => (t.oninput = () => { q.results[t.dataset.zt].text = t.value; changed(); }));
    };

    P.proposal = () => {
      const p = env.proposal;
      form.innerHTML = `<h2>The big question</h2>${sectionSwitch("proposal")}
        <fieldset class="fset"><legend>The kind of question</legend><div class="mode">
          <label><input type="radio" name="pm" value="direct" ${env.proposalMode === "direct" ? "checked" : ""}><span><b>A direct proposal</b></span></label>
          <label><input type="radio" name="pm" value="gentle" ${env.proposalMode === "gentle" ? "checked" : ""}><span><b>A gentle romantic appreciation</b></span></label></div>
          <p class="hint">Switching replaces the wording below with a fresh draft of that kind.</p></fieldset>
        ${area("What you say first", "proposal.lead", p.lead, 2, 'maxlength="300"')}
        <h3 class="sub-h">Lines that appear one by one</h3><div id="prLines"></div>
        ${input("The question", "proposal.question", p.question, 'maxlength="200"')}
        <h3 class="sub-h">Their choices</h3>
        <p class="hint">All three are always shown, equally. They can also simply close the page. It's a real question, so please leave them a real way to say "not yet".</p>
        ${input("Saying yes", "proposal.yes", p.yes, 'maxlength="40"')}${area("What you say if they choose this", "proposal.after.yes", p.after.yes, 2, 'maxlength="400"')}
        ${input("Needing time", "proposal.time", p.time, 'maxlength="40"')}${area("What you say if they choose this", "proposal.after.time", p.after.time, 2, 'maxlength="400"')}
        ${input("Wanting to talk", "proposal.talk", p.talk, 'maxlength="60"')}${area("What you say if they choose this", "proposal.after.talk", p.after.talk, 2, 'maxlength="400"')}
        ${TOKEN_HINT}`;
      wireBinds(); wireSwitch();
      stringList($("#prLines"), p.lines, { placeholder: "A line", addLabel: "Add a line", max: 6, rows: 1 });
      $$("input[name=pm]", form).forEach((r) => (r.onchange = async () => {
        if (!(await confirmDo("Replace the wording?", "This swaps what you've written here for a fresh draft of this kind.", "Replace it", "btn primary"))) { $(`input[name=pm][value=${env.proposalMode}]`, form).checked = true; return; }
        env.proposalMode = r.value; env.proposal = JSON.parse(JSON.stringify(C.PROPOSAL[r.value])); changed(); P.proposal();
      }));
    };

    P.finale = () => {
      form.innerHTML = `<h2>Final letter</h2><p class="lede-sm">The last thing they read.</p>${sectionSwitch("finale")}
        ${input("Heading", "finale.title", env.finale.title, 'maxlength="120"')}
        ${area("The letter", "finale.letter", env.finale.letter, 9, 'maxlength="4000"')}
        ${input("Signed", "finale.sign", env.finale.sign, 'maxlength="120"')}${TOKEN_HINT}`;
      wireBinds(); wireSwitch();
    };

    /* ---------------- nav ---------------- */
    function navRender() {
      const tabs = TABS.filter(([k]) => k !== "proposal" || env.intent === "propose");
      $("#edNav").innerHTML = tabs.map(([k, l]) => {
        const off = C.ALL_SECTIONS.includes(k) && !on(k);
        return `<button type="button" class="ed-tab${k === tab ? " on" : ""}${off ? " is-off" : ""}" data-tab="${k}"${k === tab ? ' aria-current="true"' : ""}>${esc(l)}${off ? '<small>off</small>' : ""}</button>`;
      }).join("");
      $$(".ed-tab").forEach((b) => (b.onclick = () => { open(b.dataset.tab); }));
    }
    function open(k) {
      tab = k; navRender();
      P[k]();
      form.scrollTop = 0;
      if (matchMedia("(max-width: 980px)").matches) $("#edNav").querySelector(".on")?.scrollIntoView({ inline: "center", block: "nearest" });
      schedulePreview();
    }

    /* ---------------- top bar actions ---------------- */
    $("#edToggle").onclick = (e) => {
      const showing = document.body.classList.toggle("show-preview");
      e.target.textContent = showing ? "Edit" : "Preview";
      if (showing) schedulePreview();
    };
    $("#edPublish").onclick = async () => {
      const btn = $("#edPublish");
      await flush();
      if (env.status !== "published") {
        if (!env.recipientName.trim()) { toast("Please tell us their name first.", true); return; }
        btn.disabled = true;
        try { const res = await api("POST", `/api/studio/envelopes/${id}/publish`, {}); env.status = res.status; env.linkStatus = res.linkStatus; bar(); }
        catch (x) { toast(x.message, true); btn.disabled = false; return; }
        btn.disabled = false;
      }
      await window.StudioShare(id);
      const fresh = await api("GET", `/api/studio/envelopes/${id}`);
      env.linkStatus = fresh.linkStatus; env.disabled = fresh.disabled; bar();
    };
    bar(); open("setup");
  };
  window.StudioEditor = StudioEditor;
})();
