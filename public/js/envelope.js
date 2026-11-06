/* The recipient's experience. One chapter at a time, with a beginning, a middle and an end.
   Also renders previews (studio, admin) and the public demos, where nothing is saved. */
(function () {
  const C = window.LW_CATALOG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const R = (a, b) => a + Math.random() * (b - a);
  const D = document.body.dataset;
  const root = $("#root");
  const params = new URLSearchParams(location.search);
  let env = null, liveMode = false;
  const t = (s) => C.fill(s, env);
  const te = (s) => esc(t(s));
  const paras = (s) => te(s).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  const fromName = () => esc(env.fromName || "the person who made this");

  /* -------------------------------------------- saving (only ever for a real, live link) */
  const ridKey = () => `lw:rid:${D.slug}`;
  let rid = "";
  function getRid() {
    if (rid) return rid;
    try { rid = localStorage.getItem(ridKey()) || ""; } catch {}
    if (!/^[a-z0-9]{32}$/.test(rid)) {
      const a = new Uint8Array(16); crypto.getRandomValues(a);
      rid = [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
      try { localStorage.setItem(ridKey(), rid); } catch {}
    }
    return rid;
  }
  async function send(action, body = {}) {
    if (!liveMode) return { ok: true, submittedAt: new Date().toISOString() };
    const r = await fetch(`/api/e/${D.slug}/${action}`, { method: "POST", headers: { "Content-Type": "application/json", "X-LW": "1" }, body: JSON.stringify({ rid: getRid(), ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "That didn't save.");
    return j;
  }
  let progress = null;
  const consentKey = () => `lw:consent:${D.slug}`;
  const hasConsent = () => { try { return localStorage.getItem(consentKey()) === "1"; } catch { return false; } };
  const setConsent = () => { try { localStorage.setItem(consentKey(), "1"); } catch {} };

  /* -------------------------------------------- ambient background */
  const PALETTE = {
    partner: ["#F2B3BE", "#D97B8D", "#F8DDB8", "#B8455E"], bestie: ["#FF5C8A", "#2F6BFF", "#FFC800", "#00B37E", "#14110F"],
    friend: ["#A9C79A", "#F7C8B5", "#F4E3A1", "#B9D7E8"], mom: ["#F4B9A7", "#F7D4C4", "#E8A0A0", "#FFF0D9"], dad: ["#E9E2CF", "#A9BCD6", "#C9D6BE", "#FFFFFF"],
  };
  const Ambient = (function () {
    const cv = $("#ambient"), ctx = cv.getContext("2d");
    let W = 0, H = 0, parts = [], extra = [], kind = "petals", colors = PALETTE.friend, running = false, last = 0;
    const size = () => { const dpr = Math.min(devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const make = (k, anywhere = true) => {
      const c = colors[Math.floor(Math.random() * colors.length)];
      const p = { x: R(0, W), y: anywhere ? R(0, H) : -20, c, a: R(0, 6.28), s: R(.6, 1.4), r: R(0, 6.28), vr: R(-.02, .02), k };
      if (k === "fireflies") { p.vx = R(-.12, .12); p.vy = R(-.12, .12); p.size = R(1.2, 2.4); p.c = "#FFE7A8"; }
      else if (k === "stars") { p.vx = 0; p.vy = 0; p.size = R(.5, 1.6); }
      else if (k === "pollen") { p.vx = R(-.08, .08); p.vy = R(-.2, -.05); p.size = R(1.2, 3); }
      else if (k === "confetti") { p.vx = R(-.2, .2); p.vy = R(.25, .7); p.size = R(4, 8); p.shape = Math.floor(R(0, 3)); }
      else { p.vx = R(-.25, .25); p.vy = R(.25, .6); p.size = R(5, 10); }
      return p;
    };
    function petal(p) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, .55 + Math.sin(p.a) * .3);
      ctx.fillStyle = p.c; ctx.globalAlpha = p.alpha ?? .68;
      ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.bezierCurveTo(p.size, -p.size * .6, p.size * .7, p.size * .8, 0, p.size); ctx.bezierCurveTo(-p.size * .7, p.size * .8, -p.size, -p.size * .6, 0, -p.size); ctx.fill(); ctx.restore();
    }
    function confetto(p) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = ctx.strokeStyle = p.c; ctx.globalAlpha = .82; ctx.lineWidth = 2;
      if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.size / 2.4, 0, 6.28); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(-p.size / 2, 0); ctx.quadraticCurveTo(0, -p.size, p.size / 2, 0); ctx.stroke(); }
      ctx.restore();
    }
    function glow(p, tw) {
      const r = p.size * 5;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, p.c); g.addColorStop(1, "transparent");
      ctx.globalAlpha = tw * .8; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
    }
    function drawOne(p, dt) {
      p.a += .02 * dt; p.r += p.vr * dt;
      if (p.k === "fireflies") {
        p.x += (p.vx + Math.sin(p.a * .6) * .18) * dt; p.y += (p.vy + Math.cos(p.a * .5) * .15) * dt;
        glow(p, .35 + Math.abs(Math.sin(p.a * .8)) * .65);
      } else if (p.k === "stars") {
        ctx.fillStyle = p.c; ctx.globalAlpha = .25 + Math.abs(Math.sin(p.a * p.s * .5)) * .7;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
      } else if (p.k === "pollen") {
        p.x += (p.vx + Math.sin(p.a) * .1) * dt; p.y += p.vy * dt;
        ctx.fillStyle = p.c; ctx.globalAlpha = .55; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
      } else {
        p.x += (p.vx + Math.sin(p.a) * .3) * dt; p.y += p.vy * dt;
        p.k === "confetti" ? confetto(p) : petal(p);
      }
    }
    function frame(ts) {
      if (!running) return;
      const dt = Math.min((ts - last) / 16.7 || 1, 3); last = ts;
      ctx.clearRect(0, 0, W, H);
      parts.forEach((p, i) => {
        drawOne(p, dt);
        if (p.y > H + 24 || p.y < -30 || p.x < -30 || p.x > W + 30) parts[i] = make(p.k, p.k === "fireflies" || p.k === "stars" || p.k === "pollen");
      });
      extra = extra.filter((p) => { p.vy += .012 * dt; p.vx *= .992; p.life -= dt; p.alpha = Math.max(0, Math.min(1, p.life / 40)); drawOne(p, dt); return p.life > 0; });
      requestAnimationFrame(frame);
    }
    return {
      start(k, theme) {
        kind = k; colors = PALETTE[theme] || PALETTE.friend; size();
        const small = W < 700;
        const count = { fireflies: small ? 16 : 28, stars: small ? 46 : 90, pollen: small ? 20 : 34, confetti: small ? 16 : 26, petals: small ? 12 : 20 }[k] || 14;
        parts = Array.from({ length: count }, () => make(k));
        addEventListener("resize", size);
        if (REDUCE) { // a still scene instead of movement
          parts.forEach((p) => { if (p.k === "fireflies") glow(p, .7); else drawOne(p, 0); });
          return;
        }
        document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(frame); } });
        running = true; requestAnimationFrame(frame);
      },
      burst(x, y, n = 18) {
        if (REDUCE) return;
        for (let i = 0; i < n; i++) {
          const a = R(0, 6.28), v = R(1, 4.4);
          extra.push({ ...make(kind === "confetti" ? "confetti" : "petals"), x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.4, life: R(50, 100), alpha: 1 });
        }
      },
      rain(n = 60) {
        if (REDUCE) return;
        for (let i = 0; i < n; i++) extra.push({ ...make(kind === "confetti" ? "confetti" : "petals"), x: R(0, W), y: R(-H * .7, -10), vx: R(-.5, .5), vy: R(1.4, 3), life: R(150, 260), alpha: 1 });
      },
    };
  })();

  /* -------------------------------------------- overlay */
  let lastFocus = null;
  function openOverlay(html, cls = "") {
    lastFocus = document.activeElement;
    const ov = document.createElement("div");
    ov.className = `ov ${cls}`; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    ov.innerHTML = `<div class="ov-card"><button class="ov-x" type="button" aria-label="Close">×</button>${html}</div>`;
    document.body.append(ov);
    requestAnimationFrame(() => ov.classList.add("on"));
    const close = () => { ov.classList.remove("on"); setTimeout(() => ov.remove(), 280); lastFocus?.focus?.({ preventScroll: true }); document.removeEventListener("keydown", onKey); ov._onClose?.(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest(".ov-x")) close(); });
    $(".ov-x", ov).focus({ preventScroll: true });
    ov.close = close;
    return ov;
  }
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  /* -------------------------------------------- chapters */
  const head = (eyebrow, title) => `<header class="ch-head">${eyebrow ? `<p class="ch-eye">${eyebrow}</p>` : ""}<h2>${te(title)}</h2></header>`;
  const photoById = (id) => env.gallery.photos.find((p) => p.id === id);

  const CH = {};

  CH.opening = {
    render: () => `<div class="ch-in open-in">
      <p class="ch-eye">${te(env.opening.kicker)}</p>
      <h1 class="open-greet">${te(env.opening.greeting)}</h1>
      <div class="open-msg">${paras(env.opening.message)}</div>
      ${env.fromName ? `<p class="open-sign">${esc(env.fromName)}</p>` : ""}
    </div>`,
  };

  CH.compliments = {
    render: () => `<div class="ch-in">
      ${head("", env.titles.compliments)}
      <button class="deck" type="button" aria-label="Show the next one"><span class="deck-under"></span><span class="deck-under u2"></span><span class="deck-card" aria-live="polite"></span></button>
      <p class="deck-count"></p></div>`,
    init(el) {
      const list = env.compliments, card = $(".deck-card", el), count = $(".deck-count", el);
      let i = 0;
      const show = (n) => { card.textContent = t(list[n]); count.textContent = n === list.length - 1 ? `${list.length} of ${list.length}. That's all of them, for now.` : `${n + 1} of ${list.length} · tap for the next`; };
      show(0);
      const step = (dir = 1) => {
        const next = (i + dir + list.length) % list.length;
        i = next;
        if (REDUCE) return show(i);
        card.classList.add("out");
        setTimeout(() => { show(i); card.classList.remove("out"); card.classList.add("in"); setTimeout(() => card.classList.remove("in"), 450); }, 280);
      };
      const deck = $(".deck", el);
      deck.addEventListener("click", (e) => { step(); Ambient.burst(e.clientX || centerOf(deck)[0], e.clientY || centerOf(deck)[1], 6); });
      swipe(deck, step);
    },
  };

  function swipe(target, step) {
    let x = null;
    target.addEventListener("touchstart", (e) => (x = e.touches[0].clientX), { passive: true });
    target.addEventListener("touchend", (e) => {
      if (x === null) return;
      const dx = e.changedTouches[0].clientX - x; x = null;
      if (Math.abs(dx) > 50) { e.preventDefault(); step(dx < 0 ? 1 : -1); }
    });
  }

  /* gallery */
  const img = (p, cls = "") => `<img class="${cls}" src="${esc(p.url)}" alt="${esc(p.caption || "A photograph")}" loading="lazy" decoding="async">`;
  function lightbox(start, autoplay) {
    const photos = env.gallery.photos;
    let i = start, timer = null;
    const ov = openOverlay(`<figure class="lb"><div class="lb-frame"></div><figcaption class="lb-cap"></figcaption>
      <div class="lb-nav"><button type="button" class="lb-p" aria-label="Previous photograph">←</button><button type="button" class="lb-play">${autoplay ? "Pause" : "Play slideshow"}</button><button type="button" class="lb-n" aria-label="Next photograph">→</button></div></figure>`, "ov-photo");
    const show = () => {
      const p = photos[i];
      $(".lb-frame", ov).innerHTML = `<img class="${autoplay || timer ? "kb" : ""}" src="${esc(p.url)}" alt="${esc(p.caption || "A photograph")}">`;
      $(".lb-cap", ov).textContent = t(p.caption);
    };
    const go = (d) => { i = (i + d + photos.length) % photos.length; show(); };
    const stop = () => { clearInterval(timer); timer = null; $(".lb-play", ov).textContent = "Play slideshow"; };
    const play = () => { timer = setInterval(() => go(1), 3800); $(".lb-play", ov).textContent = "Pause"; show(); };
    $(".lb-p", ov).onclick = () => { stop(); go(-1); };
    $(".lb-n", ov).onclick = () => { stop(); go(1); };
    $(".lb-play", ov).onclick = () => (timer ? stop() : play());
    swipe($(".lb-frame", ov), (d) => { stop(); go(d); });
    ov._onClose = stop;
    show();
    if (autoplay && !REDUCE) play();
  }
  const GALLERY = {
    polaroid: (ps) => `<div class="g g-polaroid">${ps.map((p, i) => `<button type="button" class="gp" data-i="${i}" style="--r:${[-4, 3, -2, 4, -3, 2][i % 6]}deg">${img(p)}<span>${te(p.caption)}</span></button>`).join("")}</div>`,
    filmstrip: (ps) => `<div class="g g-film" tabindex="0" aria-label="Film strip of photographs, scroll sideways">${ps.map((p, i) => `<button type="button" class="gp" data-i="${i}">${img(p)}<span>${te(p.caption)}</span></button>`).join("")}</div><p class="g-hint">Slide along the film</p>`,
    wall: (ps) => `<div class="g g-wall">${ps.map((p, i) => `<button type="button" class="gp" data-i="${i}" style="--r:${[-1.5, 1, -.5, 1.5][i % 4]}deg">${img(p)}<span>${te(p.caption)}</span></button>`).join("")}</div>`,
    scrapbook: (ps) => `<div class="g g-scrap">${ps.map((p, i) => `<button type="button" class="gp v${i % 4}" data-i="${i}" style="--r:${[-5, 3, -2, 6][i % 4]}deg"><i class="tape" aria-hidden="true"></i>${img(p)}<span>${te(p.caption)}</span></button>`).join("")}</div>`,
    fullscreen: () => `<div class="g g-full"><div class="gf-frame"></div><p class="gf-cap"></p><div class="gf-nav"><button type="button" class="gf-p" aria-label="Previous photograph">←</button><span class="gf-n"></span><button type="button" class="gf-x" aria-label="Next photograph">→</button></div></div>`,
  };
  CH.gallery = {
    skip: () => !env.gallery.photos.length,
    render: () => {
      const layout = GALLERY[env.gallery.layout] ? env.gallery.layout : "polaroid";
      return `<div class="ch-in ch-wide">${head("", env.titles.gallery)}${GALLERY[layout](env.gallery.photos)}
        ${env.gallery.slideshow && layout !== "fullscreen" ? `<button type="button" class="link-btn g-show">Play as a slideshow</button>` : ""}</div>`;
    },
    init(el) {
      const ps = env.gallery.photos;
      if (env.gallery.layout === "fullscreen") {
        let i = 0, timer = null;
        const show = () => {
          $(".gf-frame", el).innerHTML = `<img class="kb" src="${esc(ps[i].url)}" alt="${esc(ps[i].caption || "A photograph")}">`;
          $(".gf-cap", el).textContent = t(ps[i].caption);
          $(".gf-n", el).textContent = `${i + 1} of ${ps.length}`;
        };
        const go = (d) => { i = (i + d + ps.length) % ps.length; show(); };
        const stop = () => { clearInterval(timer); timer = null; };
        $(".gf-p", el).onclick = () => { stop(); go(-1); };
        $(".gf-x", el).onclick = () => { stop(); go(1); };
        swipe($(".gf-frame", el), (d) => { stop(); go(d); });
        show();
        if (env.gallery.slideshow && !REDUCE) { timer = setInterval(() => go(1), 4200); el._leave = stop; }
        return;
      }
      $$(".gp", el).forEach((b) => b.addEventListener("click", () => lightbox(+b.dataset.i)));
      const s = $(".g-show", el);
      if (s) s.onclick = () => lightbox(0, true);
    },
  };
  CH.interlude = {
    render: (ch) => `<figure class="inter"><img src="${esc(ch.photo.url)}" alt="${esc(ch.photo.caption || "A photograph")}" class="kb"><figcaption>${te(ch.photo.caption)}</figcaption></figure>`,
  };

  CH.letters = {
    skip: () => !env.letters.length,
    render: () => `<div class="ch-in">${head("", env.titles.letters)}<div class="ltrs">${env.letters.map((l, i) => `
      <button type="button" class="ltr" data-i="${i}" style="--r:${[-2, 1.5, -1, 2][i % 4]}deg"><span class="ltr-env" aria-hidden="true"><i class="ltr-flap"></i></span><span class="ltr-t">${te(l.title)}</span></button>`).join("")}</div></div>`,
    init(el) {
      $$(".ltr", el).forEach((b) => b.addEventListener("click", () => {
        const l = env.letters[+b.dataset.i], ph = photoById(l.photoId);
        b.classList.add("opened");
        openOverlay(`<article class="paper"><h3>${te(l.title)}</h3>${ph ? `<figure class="paper-photo"><img src="${esc(ph.url)}" alt="${esc(ph.caption || "A photograph")}"></figure>` : ""}<div class="paper-body">${paras(l.text)}</div>${env.fromName ? `<p class="paper-sign">${esc(env.fromName)}</p>` : ""}</article>`, "ov-paper");
      }));
    },
  };

  CH.bouquet = {
    render: () => {
      const closed = env.bouquet.anim === "unwrap";
      return `<div class="ch-in bq-in">${head("", env.titles.bouquet)}
        <div class="bq-stage bq-closed" id="bqStage">${Bouquet.svg(env.bouquet, { interactive: true, label: "A bouquet made for you" })}</div>
        ${closed ? `<button type="button" class="btn-main bq-untie">Untie the ribbon</button>` : ""}
        <div class="bq-note" aria-live="polite"><p class="bq-note-t">${env.bouquet.messages.length ? "There's a note hidden in some of these flowers. Tap one." : ""}</p></div>
        ${env.bouquet.note ? `<p class="bq-card">${te(env.bouquet.note)}</p>` : ""}</div>`;
    },
    enter(el) {
      const st = $(".bq-stage", el);
      if (el._done) return;
      el._done = true;
      const bloom = () => setTimeout(() => st.classList.remove("bq-closed"), 120);
      if (env.bouquet.anim === "unwrap") {
        $(".bq-untie", el).onclick = (e) => { e.target.remove(); st.classList.add("bq-unwrapped"); bloom(); Ambient.burst(...centerOf(st), 22); };
      } else {
        bloom();
        if (env.bouquet.anim === "rain") setTimeout(() => Ambient.rain(70), 700);
        else setTimeout(() => Ambient.burst(...centerOf(st), 14), 1200);
      }
      const notes = env.bouquet.messages, txt = $(".bq-note-t", el);
      const read = (f) => {
        const i = +f.dataset.i;
        f.classList.remove("is-pop"); void f.getBoundingClientRect(); f.classList.add("is-pop", "is-read");
        Ambient.burst(...centerOf(f), 8);
        if (notes.length) { txt.textContent = t(notes[i % notes.length]); txt.classList.remove("flip"); void txt.offsetWidth; txt.classList.add("flip"); }
      };
      $$(".bq-f", el).forEach((f) => {
        f.addEventListener("click", () => read(f));
        f.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); read(f); } });
      });
    },
  };

  CH.secrets = {
    skip: () => !env.secrets.length,
    render: () => `<div class="ch-in">${head("", env.titles.secrets)}<div class="secs">${env.secrets.map((s, i) => `
      <button type="button" class="sec" data-i="${i}"><span class="sec-seal" aria-hidden="true"></span><span class="sec-l">${te(s.label || "a secret")}</span><span class="sec-t">${te(s.text)}</span></button>`).join("")}</div></div>`,
    init(el) { $$(".sec", el).forEach((b) => b.addEventListener("click", () => { if (!b.classList.contains("on")) Ambient.burst(...centerOf(b), 10); b.classList.add("on"); })); },
  };

  /* questions */
  CH.questions = {
    skip: () => !env.questions.length,
    hidesNav: true,
    render: () => `<div class="ch-in qn" aria-live="polite"></div>`,
    enter(el, go) {
      const box = $(".qn", el), qs = env.questions;
      const answers = { ...(progress?.answers || {}) };
      let i = Math.min(progress?.index || 0, qs.length - 1), timer = null, consented = hasConsent() || !!progress?.answers;
      const save = (extra = {}) => send("answers", { consent: true, answers, index: i, ...extra });
      const queue = () => { clearTimeout(timer); timer = setTimeout(async () => { const s = $(".qn-saved", box); try { await save(); if (s) s.textContent = "Saved"; } catch { if (s) s.textContent = "Couldn't save just now"; } }, 800); };
      const showNav = (on) => document.body.classList.toggle("nav-hide", !on);
      const intro = () => {
        showNav(true);
        box.innerHTML = `${head("", env.titles.questions)}
          <div class="qn-consent"><p><strong>Before you start:</strong> ${fromName()} will be able to read everything you write here. It's saved as you go, and the site owner can also see it to keep this platform safe. Skip anything you like, and you can erase your answers at the end.</p></div>
          <button type="button" class="btn-main qn-go">I'm happy to share</button>`;
        $(".qn-go", box).onclick = () => { setConsent(); consented = true; question(); };
      };
      const question = () => {
        showNav(false);
        const q = qs[i];
        const pct = ((i) / qs.length) * 100;
        box.innerHTML = `<div class="qn-prog"><span style="width:${pct}%"></span></div><p class="qn-n">${i + 1} of ${qs.length}</p>
          <label class="qn-q" for="qnA">${te(q.q)}</label>
          ${q.type === "choice" ? `<div class="qn-opts" role="radiogroup">${q.options.map((o) => `<button type="button" role="radio" class="qn-opt${answers[q.id] === o ? " on" : ""}" aria-checked="${answers[q.id] === o}" data-v="${esc(o)}">${te(o)}</button>`).join("")}</div>`
            : `<textarea id="qnA" class="qn-a" rows="4" maxlength="2000" placeholder="Write as much or as little as you like">${esc(answers[q.id] || "")}</textarea>`}
          <p class="qn-saved" role="status"></p>
          <div class="qn-ctrl"><button type="button" class="btn-sub qn-prev"${i === 0 ? " disabled" : ""}>Back</button><button type="button" class="link-btn qn-skip">Skip</button><button type="button" class="btn-main qn-next">${i === qs.length - 1 ? "Finish" : "Next"}</button></div>`;
        const ta = $(".qn-a", box);
        if (ta) ta.oninput = () => { answers[q.id] = ta.value; queue(); };
        $$(".qn-opt", box).forEach((o) => (o.onclick = () => {
          answers[q.id] = o.dataset.v; $$(".qn-opt", box).forEach((x) => { const on = x === o; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); }); queue();
        }));
        const move = async (d) => {
          clearTimeout(timer);
          const atEnd = d > 0 && i === qs.length - 1;
          const nextBtn = $(".qn-next", box);
          if (atEnd) {
            nextBtn.disabled = true;
            try { await save({ submit: true }); done(); } catch (e) { $(".qn-saved", box).textContent = e.message; nextBtn.disabled = false; }
            return;
          }
          i += d; save().catch(() => {}); question(); el.scrollTop = 0; $("#stage").scrollTop = 0;
        };
        $(".qn-prev", box).onclick = () => move(-1);
        $(".qn-next", box).onclick = () => move(1);
        $(".qn-skip", box).onclick = () => { delete answers[q.id]; move(1); };
      };
      const done = () => {
        showNav(true);
        box.innerHTML = `<div class="qn-done"><div class="qn-bloom" aria-hidden="true">${window.Flora ? Flora.flower(env.relationship === "partner" ? "rose" : env.relationship === "bestie" ? "poppy" : "daisy", { seed: 4 }) : ""}</div><h2>Thank you.</h2><p>${fromName()} will treasure this. You've nothing more to do here.</p><button type="button" class="link-btn qn-again">Change my answers</button></div>`;
        $(".qn-again", box).onclick = () => { i = 0; question(); };
        Ambient.burst(innerWidth / 2, innerHeight / 2, 26);
      };
      if (progress?.submittedAt) done(); else if (consented) { intro(); $(".qn-go", box).textContent = "Carry on"; } else intro();
      el._leave = () => { clearTimeout(timer); showNav(true); };
    },
  };

  /* quiz */
  CH.quiz = {
    skip: () => !env.quiz,
    render: () => `<div class="ch-in qz"></div>`,
    enter(el) {
      const box = $(".qz", el), quiz = env.quiz;
      if (el._done) return; el._done = true;
      const score = {}; let i = 0;
      const q = () => {
        const it = quiz.questions[i];
        box.innerHTML = `${head("", quiz.title)}<div class="qn-prog"><span style="width:${(i / quiz.questions.length) * 100}%"></span></div><p class="qz-q">${te(it.q)}</p><div class="qn-opts">${it.options.map((o) => `<button type="button" class="qn-opt" data-k="${esc(o.k)}">${te(o.t)}</button>`).join("")}</div>`;
        $$(".qn-opt", box).forEach((b) => (b.onclick = () => { score[b.dataset.k] = (score[b.dataset.k] || 0) + 1; i++; i < quiz.questions.length ? q() : result(); }));
      };
      const result = () => {
        const key = Object.entries(score).sort((a, b) => b[1] - a[1])[0][0], r = quiz.results[key];
        box.innerHTML = `<div class="qz-res"><p class="ch-eye">The result is in</p><h2>${te(r.title)}</h2><p>${te(r.text)}</p>
          <div class="qz-share"><button type="button" class="btn-main qz-send">Send this result to ${fromName()}</button><p class="fine">Only sent if you press the button. ${fromName()} and the site owner can then see it.</p></div></div>`;
        Ambient.burst(innerWidth / 2, innerHeight / 3, 24);
        $(".qz-send", box).onclick = async (e) => {
          e.target.disabled = true;
          try { await send("quiz", { consent: true, result: key }); $(".qz-share", box).innerHTML = `<p class="fine ok">Sent. Thank you.</p>`; }
          catch (err) { e.target.disabled = false; $(".fine", box).textContent = err.message; }
        };
      };
      q();
    },
  };

  /* the proposal: dramatic, but never pressing. Every answer is equally easy, and no answer is fine. */
  CH.proposal = {
    skip: () => !env.proposal,
    dark: true,
    render: () => `<div class="ch-in pr"><p class="pr-lead">${te(env.proposal.lead)}</p><div class="pr-lines"></div></div>`,
    enter(el) {
      if (el._done) return; el._done = true;
      const pr = env.proposal, lines = $(".pr-lines", el), box = $(".pr", el);
      const after = (choice) => {
        const msg = pr.after[choice];
        $(".pr-ask", box).innerHTML = `<p class="pr-after">${te(msg)}</p><button type="button" class="link-btn pr-change">Change my answer</button>`;
        if (choice === "yes") Ambient.rain(90);
        $(".pr-change", box).onclick = ask;
      };
      const ask = () => {
        let wrap = $(".pr-ask", box);
        if (!wrap) { wrap = document.createElement("div"); wrap.className = "pr-ask"; box.append(wrap); }
        const prev = progress?.proposal?.choice;
        wrap.innerHTML = `<div class="pr-bloom bq-closed" aria-hidden="true">${Bouquet.svg({ ...env.bouquet, kind: env.bouquet?.kind || "redrose", count: 5 })}</div>
          <h2 class="pr-q">${te(pr.question)}</h2>
          <div class="pr-btns">${["yes", "time", "talk"].map((k) => `<button type="button" class="btn-sub pr-b${prev === k ? " on" : ""}" data-c="${k}">${te(pr[k])}</button>`).join("")}</div>
          <p class="fine">There's no wrong answer, and you don't have to answer here at all. If you choose one, it goes to ${fromName()}. The site owner can see it too.</p><p class="fine pr-err" role="alert"></p>`;
        setTimeout(() => $(".pr-bloom", box)?.classList.remove("bq-closed"), 200);
        $(".pr-q", wrap).scrollIntoView({ block: "center", behavior: REDUCE ? "auto" : "smooth" });
        $$(".pr-b", wrap).forEach((b) => (b.onclick = async () => {
          $$(".pr-b", wrap).forEach((x) => (x.disabled = true));
          try { await send("proposal", { consent: true, choice: b.dataset.c }); progress = { ...(progress || {}), proposal: { choice: b.dataset.c } }; after(b.dataset.c); }
          catch (e) { $(".pr-err", wrap).textContent = e.message; $$(".pr-b", wrap).forEach((x) => (x.disabled = false)); }
        }));
      };
      if (REDUCE || progress?.proposal) { lines.innerHTML = pr.lines.map((l) => `<p class="on">${te(l)}</p>`).join(""); if (progress?.proposal) { ask(); after(progress.proposal.choice); } else ask(); return; }
      let n = 0, timer;
      const next = () => {
        if (n >= pr.lines.length) { clearTimeout(timer); el.removeEventListener("click", skip); return ask(); }
        const p = document.createElement("p"); p.textContent = t(pr.lines[n++]); lines.append(p);
        requestAnimationFrame(() => p.classList.add("on"));
        timer = setTimeout(next, 1900);
      };
      const skip = () => { clearTimeout(timer); next(); };
      el.addEventListener("click", skip);
      timer = setTimeout(next, 1300);
    },
  };

  CH.finale = {
    render: () => `<div class="ch-in fin"><h2>${te(env.finale.title)}</h2><div class="fin-letter">${paras(env.finale.letter)}</div>${env.finale.sign ? `<p class="fin-sign">${te(env.finale.sign)}</p>` : ""}
      <div class="fb"><label for="fbText">Anything you'd like to say back? <span class="fine">This goes to ${fromName()}. The site owner can see it too.</span></label>
      <textarea id="fbText" rows="3" maxlength="2000">${esc(progress?.feedback?.text || "")}</textarea><div class="fb-row"><button type="button" class="btn-sub fb-send">Send it</button><span class="fine fb-msg" role="status"></span></div></div>
      <div class="fin-actions"><button type="button" class="link-btn fin-again">Open it all again</button><button type="button" class="link-btn fin-erase" hidden>Erase my answers</button></div></div>`,
    enter(el) {
      if (!el._once) { el._once = true; setTimeout(() => Ambient.rain(env.relationship === "dad" ? 18 : 40), 400); }
      $(".fin-erase", el).hidden = !liveMode || !progress;
      $(".fb-send", el).onclick = async (e) => {
        const text = $("#fbText", el).value.trim(), msg = $(".fb-msg", el);
        if (!text) { msg.textContent = "Write something first."; return; }
        e.target.disabled = true;
        try { await send("feedback", { consent: true, text }); progress = { ...(progress || {}), feedback: { text } }; msg.textContent = "Sent. Thank you."; $(".fin-erase", el).hidden = !liveMode; }
        catch (err) { msg.textContent = err.message; }
        e.target.disabled = false;
      };
      $(".fin-again", el).onclick = () => location.reload();
      $(".fin-erase", el).onclick = async (e) => {
        if (!confirm("Erase everything you've answered in this envelope? This can't be undone.")) return;
        try { await send("erase"); progress = null; e.target.hidden = true; $(".fb-msg", el).textContent = "Your answers have been erased."; $("#fbText", el).value = ""; try { localStorage.removeItem(consentKey()); } catch {} }
        catch (err) { $(".fb-msg", el).textContent = err.message; }
      };
    },
  };

  /* -------------------------------------------- the journey */
  let chapters = [], at = 0, stage;
  function buildChapters() {
    const list = env.sections.filter((id) => CH[id] && !CH[id].skip?.()).map((id) => ({ id }));
    if (env.sections.includes("gallery")) {
      const inter = env.gallery.photos.filter((p) => p.interlude);
      let insertAt = 1;
      inter.forEach((photo) => { list.splice(Math.min(insertAt, Math.max(1, list.length - 1)), 0, { id: "interlude", photo }); insertAt += 2; });
    }
    return list;
  }
  function chapterTitle(c) { return { opening: "Hello", compliments: "Kind words", gallery: "Memories", interlude: "Memory", letters: "Letters", bouquet: "Flowers", secrets: "Secrets", questions: "Questions", quiz: "A little quiz", proposal: "A question", finale: "The end" }[c.id]; }

  function journey(startAt = 0) {
    chapters = buildChapters();
    root.innerHTML = `<div class="shell">
      <header class="prog"><span class="prog-label"></span><div class="prog-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div></header>
      <main class="stage" id="stage">${chapters.map((c, i) => `<section class="ch ch-${c.id}${CH[c.id].dark ? " is-dark" : ""}" data-i="${i}" hidden>${CH[c.id].render(c)}</section>`).join("")}</main>
      <nav class="ctrl" aria-label="Chapters"><button type="button" class="btn-sub ctrl-back">Back</button><button type="button" class="btn-main ctrl-next">Continue</button></nav>
    </div>`;
    stage = $("#stage");
    chapters.forEach((c, i) => { const el = $(`.ch[data-i="${i}"]`); c.el = el; try { CH[c.id].init?.(el, c); } catch (e) { console.error(e); } });
    $(".ctrl-back").onclick = () => go(at - 1);
    $(".ctrl-next").onclick = () => go(at + 1);
    addEventListener("keydown", (e) => {
      if ($(".ov") || /TEXTAREA|INPUT/.test(document.activeElement?.tagName || "")) return;
      if (e.key === "ArrowRight") go(at + 1); else if (e.key === "ArrowLeft") go(at - 1);
    });
    show(startAt, 1);
  }
  function show(i, dir) {
    const c = chapters[i], el = c.el;
    chapters.forEach((x) => { if (x !== c) { if (!x.el.hidden) x.el._leave?.(); x.el.hidden = true; x.el.classList.remove("enter-f", "enter-b"); } });
    el.hidden = false;
    el.classList.add(dir > 0 ? "enter-f" : "enter-b");
    stage.scrollTop = 0;
    document.body.dataset.chapter = c.id;
    at = i;
    const pct = chapters.length > 1 ? (i / (chapters.length - 1)) * 100 : 100;
    $(".prog-track i").style.width = `${pct}%`;
    $(".prog-track").setAttribute("aria-valuenow", Math.round(pct));
    $(".prog-label").textContent = chapterTitle(c);
    $(".ctrl-back").disabled = i === 0;
    $(".ctrl-next").hidden = i === chapters.length - 1;
    const h = $("h1, h2", el); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    try { CH[c.id].enter?.(el, go); } catch (e) { console.error(e); }
  }
  function go(i) { if (i < 0 || i >= chapters.length || i === at) return; show(i, i > at ? 1 : -1); }

  /* -------------------------------------------- welcome + envelope */
  function welcome() {
    const initial = esc((env.fromName || env.recipientName || "♡").trim()[0].toUpperCase());
    root.innerHTML = `<section class="welcome">
      <p class="w-kick">${env.fromName ? `${esc(env.fromName)} sent you something` : "Someone sent you something"}</p>
      <h1 class="w-name">For <em>${esc(env.recipientName)}</em></h1>
      <button type="button" class="envl" id="envl" aria-label="Open your envelope">
        <span class="envl-back"></span>
        <span class="envl-letter"><span class="envl-for">For</span><span class="envl-to">${esc(env.recipientName)}</span></span>
        <span class="envl-front"></span>
        <span class="envl-flap"></span>
        <span class="envl-seal">${initial}</span>
      </button>
      <p class="w-hint">Tap the seal to open</p>
    </section>`;
    const open = () => {
      const start = () => { if (liveMode) send("seen").catch(() => {}); journey(); };
      if (REDUCE) return start();
      const w = $(".welcome"); w.classList.add("opening");
      Ambient.burst(...centerOf($(".envl-seal")), 14);
      setTimeout(() => w.classList.add("leaving"), 1500);
      setTimeout(start, 2100);
    };
    $("#envl").addEventListener("click", open, { once: true });
  }

  function closed() {
    Ambient.start("pollen", "friend");
    root.innerHTML = `<section class="closed"><h1>This envelope isn't open right now.</h1><p>It may have been closed by the person who sent it, or its time may be up. Ask them for a new link.</p></section>`;
  }

  /* -------------------------------------------- sample content for the public demos */
  function demoPhotos(rel) {
    const palettes = { partner: ["#5B1A2E", "#C4556B", "#F8DDB8"], bestie: ["#FFC800", "#FF5C8A", "#2F6BFF"], friend: ["#B9D7E8", "#A9C79A", "#F7C8B5"], mom: ["#F7C9B5", "#E8A0A0", "#FFF0D9"], dad: ["#22314E", "#6F8CA8", "#E9E2CF"] }[rel];
    const caps = ["The first of many", "That one summer", "Somewhere good", "We should go back"];
    return caps.map((caption, i) => {
      const [a, b, c] = [palettes[i % 3], palettes[(i + 1) % 3], palettes[(i + 2) % 3]];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" fill="${a}"/><circle cx="${200 + i * 130}" cy="${260 + (i % 2) * 90}" r="120" fill="${c}"/><path d="M0 ${560 - i * 20} Q 220 ${420 + i * 25} 420 ${540} T 800 ${500 - i * 15} V800 H0Z" fill="${b}"/><path d="M0 680 Q 240 590 460 670 T 800 650 V800 H0Z" fill="${a}" opacity=".55"/></svg>`;
      return { id: `d${i}`, url: `data:image/svg+xml,${encodeURIComponent(svg)}`, caption, interlude: i === 1 };
    });
  }
  function demoEnvelope(rel) {
    const b = C.build(rel, C.INTENTS[rel][0].id, { recipientName: { partner: "Asha", bestie: "Riya", friend: "Maya", mom: "Mom", dad: "Dad" }[rel], fromName: "Sam", gender: "unspecified" });
    return { ...b, sections: b.sections.filter((s) => s.on).map((s) => s.id), questions: b.questions.filter((q) => q.on), gallery: { ...b.gallery, photos: demoPhotos(rel), coverId: "d0", slideshow: true } };
  }

  /* -------------------------------------------- start */
  function ribbon(text) { const r = document.createElement("p"); r.className = "preview-tag"; r.textContent = text; document.body.append(r); }
  (async () => {
    if (D.closed === "1") return closed();
    try {
      if (D.demo) { env = demoEnvelope(D.demo); ribbon("Sample"); }
      else if (D.preview) {
        const r = await fetch(D.preview); if (!r.ok) throw new Error();
        env = await r.json(); ribbon("Preview");
      } else {
        const r = await fetch(`/api/e/${D.slug}`); if (!r.ok) return closed();
        env = await r.json(); liveMode = true;
      }
    } catch { return closed(); }
    document.title = `For ${env.recipientName} ♡`;
    Ambient.start(env.ambience || "petals", env.relationship);
    if (liveMode) { try { progress = (await send("progress")).progress; } catch {} }
    const want = params.get("at");
    if (want && (D.preview || D.demo)) {
      const list = buildChapters(), idx = list.findIndex((c) => c.id === want);
      if (idx >= 0) return journey(idx);
      return journey();
    }
    welcome();
  })();
})();
