/* Shared helpers for the recipient experience. Sections register into LW.sections. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const G = window.gsap || null;
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MOTION = !!G && !REDUCE;
  const pad = (n) => String(n).padStart(2, "0");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const R = (a, b) => a + Math.random() * (b - a);
  const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

  const LW = (window.LW = { $, $$, G, REDUCE, MOTION, pad, esc, R, pickOne, sections: {}, data: null, slug: "" });

  // {name} / {from} placeholders
  LW.fill = (s) => String(s ?? "").replace(/\{name\}/g, LW.data?.name || "you").replace(/\{from\}/g, LW.data?.from || "me");
  LW.fe = (s) => esc(LW.fill(s)); // fill + escape

  LW.toast = (msg) => {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(LW.toast.h); LW.toast.h = setTimeout(() => t.classList.remove("show"), 2200);
  };

  LW.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.append(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch {}
      ta.remove(); return ok;
    }
  };

  // POST to this experience's public API. Returns parsed JSON or null (offline / legacy link).
  LW.post = async (action, body) => {
    if (!LW.slug || LW.legacy) return null;
    try {
      const r = await fetch(`/api/x/${encodeURIComponent(LW.slug)}/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-LW": "1" }, body: JSON.stringify(body || {}),
      });
      const j = await r.json().catch(() => ({}));
      return r.ok ? j : Object.assign(j, { failed: true });
    } catch { return null; }
  };

  /* ---------- flower growth ---------- */
  LW.prepGrow = (c) => {
    if (!MOTION) return;
    G.set($$(".fl-stem", c), { strokeDasharray: 1, strokeDashoffset: 1 });
    G.set($$(".fl-leaf", c), { scale: 0, transformOrigin: "50% 100%" });
    G.set($$(".fl-head", c), { scale: 0, rotation: -40, transformOrigin: "50% 50%" });
  };
  LW.grow = (c, delay = 0) => {
    if (!MOTION) return;
    G.to($$(".fl-stem", c), { strokeDashoffset: 0, duration: 1.3, ease: "power2.out", stagger: .12, delay });
    G.to($$(".fl-leaf", c), { scale: 1, duration: .7, ease: "back.out(2)", stagger: .04, delay: delay + .45 });
    G.to($$(".fl-head", c), { scale: 1, rotation: 0, duration: 1.1, ease: "back.out(1.5)", stagger: .06, delay: delay + .7 });
  };
  LW.arrange = (el, items) => {
    el.innerHTML = items.map(([type, seed, left, h, rot]) =>
      Flora.flower(type, { seed }).replace('class="flora"', `class="flora" style="left:${left}%;height:${h}%;transform:rotate(${rot}deg);transform-origin:50% 100%"`)).join("");
  };

  /* ---------- overlay (letters, notes, results) ---------- */
  let lastFocus = null;
  LW.openOverlay = (html, { theme = "", onOpen } = {}) => {
    lastFocus = document.activeElement;
    const ov = $("#overlay");
    $("#overlayBody").innerHTML = html;
    ov.className = `overlay ${theme}`;
    ov.hidden = false;
    document.body.style.overflow = "hidden";
    if (MOTION) {
      G.fromTo(".overlay-backdrop", { opacity: 0 }, { opacity: 1, duration: .35 });
      G.fromTo("#overlayCard", { opacity: 0, y: 30, scale: .96, rotation: -1 }, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: .6, ease: "power3.out" });
    }
    setTimeout(() => $(".overlay-close").focus({ preventScroll: true }), 50);
    onOpen && onOpen($("#overlayBody"));
  };
  LW.closeOverlay = () => {
    const ov = $("#overlay");
    if (ov.hidden) return;
    const done = () => { ov.hidden = true; document.body.style.overflow = ""; lastFocus && lastFocus.focus({ preventScroll: true }); };
    if (MOTION) {
      G.to("#overlayCard", { opacity: 0, y: 16, duration: .25, ease: "power2.in" });
      G.to(".overlay-backdrop", { opacity: 0, duration: .3, onComplete: done });
    } else done();
  };
  document.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) LW.closeOverlay(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") LW.closeOverlay(); });

  /* ---------- petal burst at a point (feature E) ---------- */
  LW.petalBurst = (x, y, n = 16, colors = Flora.colors) => {
    if (REDUCE) return;
    const layer = $("#burstLayer");
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "bp";
      p.style.width = `${R(9, 16)}px`;
      p.innerHTML = Flora.petal(colors[i % colors.length]);
      layer.append(p);
      const a = R(0, Math.PI * 2), d = R(40, 130);
      const kf = [
        { transform: `translate(${x}px, ${y}px) rotate(0deg) scale(.4)`, opacity: 1 },
        { transform: `translate(${x + Math.cos(a) * d}px, ${y + Math.sin(a) * d - 40}px) rotate(${R(-180, 180)}deg) scale(1)`, opacity: 1, offset: .35 },
        { transform: `translate(${x + Math.cos(a) * d * 1.4 + R(-30, 30)}px, ${y + R(160, 300)}px) rotate(${R(-360, 360)}deg) scale(.9)`, opacity: 0 },
      ];
      p.animate(kf, { duration: R(1600, 2600), easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" }).onfinish = () => p.remove();
    }
  };
  // sparkle particles (garden, stars)
  LW.sparkle = (x, y, n = 14, color = "#FFE9B0") => {
    if (REDUCE) return;
    const layer = $("#burstLayer");
    for (let i = 0; i < n; i++) {
      const s = document.createElement("div");
      s.className = "spark";
      s.style.background = color;
      s.style.boxShadow = `0 0 8px 2px ${color}`;
      layer.append(s);
      const a = R(0, Math.PI * 2), d = R(20, 90);
      s.animate([
        { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
        { transform: `translate(${x + Math.cos(a) * d}px, ${y + Math.sin(a) * d - R(10, 50)}px) scale(0)`, opacity: 0 },
      ], { duration: R(800, 1500), easing: "cubic-bezier(.1,.7,.3,1)", fill: "forwards" }).onfinish = () => s.remove();
    }
  };
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  LW.centerOf = centerOf;

  /* ---------- falling petals ---------- */
  let petalsOn = false;
  LW.startPetals = () => {
    if (petalsOn || !MOTION) return;
    petalsOn = true;
    const layer = $("#petalLayer");
    const n = innerWidth < 600 ? 8 : 13;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "pt";
      p.innerHTML = `<div>${Flora.petal(Flora.colors[i % Flora.colors.length])}</div>`;
      p.style.width = `${R(10, 17)}px`;
      layer.append(p);
      const fall = () => {
        G.set(p, { x: R(0, innerWidth), y: -40, rotation: R(0, 360), opacity: R(.45, .8) });
        G.to(p, { y: innerHeight + 60, x: `+=${R(-120, 120)}`, rotation: `+=${R(-200, 200)}`, duration: R(11, 19), ease: "none", onComplete: fall });
      };
      G.delayedCall(R(0, 10), fall);
      G.to(p.firstChild, { x: R(14, 30), rotationY: 160, duration: R(2, 3.6), yoyo: true, repeat: -1, ease: "sine.inOut" });
    }
  };

  /* ---------- reveals, parallax, watermark tone ---------- */
  const growHooks = new WeakMap();
  LW.onReveal = (el, fn) => growHooks.set(el, fn);
  LW.observeReveals = () => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        if (en.target.hasAttribute("data-grow")) LW.grow(en.target, .2);
        const hook = growHooks.get(en.target); hook && hook();
        io.unobserve(en.target);
      });
    }, { threshold: .15, rootMargin: "0px 0px -6% 0px" });
    $$("[data-reveal]").forEach((el) => io.observe(el));
  };

  LW.startAmbient = () => {
    const par = $$("[data-parallax]");
    const wm = $("#watermark");
    const tones = $$("[data-tone]");
    let ticking = false;
    const update = () => {
      ticking = false;
      if (!REDUCE) par.forEach((el) => {
        const r = el.getBoundingClientRect();
        const k = parseFloat(el.dataset.parallax) || .1;
        el.style.translate = `0 ${((r.top + r.height / 2 - innerHeight / 2) * -k).toFixed(1)}px`;
      });
      // watermark colour follows whatever section sits behind the bottom-right corner
      const y = innerHeight - 14;
      const under = tones.find((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
      wm.classList.toggle("on-dark", !!under && under.dataset.tone === "dark");
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    update();
  };

  // shared section header markup
  LW.head = (num, title, em, aside, right) =>
    `<header class="sec-head${right ? " right" : ""}" data-reveal><span class="sec-num">${num}</span><h2>${title}<br><em>${em}</em></h2>${aside ? `<span class="hand sec-aside">${aside}</span>` : ""}</header>`;

  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"];
  LW.roman = (i) => ROMAN[i] || String(i + 1);
})();
