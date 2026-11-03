/* Story sections: hero, letter, compliments, bouquet, envelopes, garden, scrapbook, finale */
(function () {
  const { $, $$, G, MOTION, REDUCE, esc, pad, R } = LW;
  const S = LW.sections;
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(`lw:${LW.slug}:${k}`)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(`lw:${LW.slug}:${k}`, JSON.stringify(v)); } catch {} },
  };
  LW.store = store;

  /* =============================== HERO */
  S.hero = {
    render: () => `
      <div class="hero-text">
        <span class="hand hero-note" data-reveal>yes. all of this is for you.</span>
        <h1 class="hero-title" data-reveal><span class="hero-hi">Hello,</span><span class="hero-name">${LW.fe("{name}")}</span></h1>
        <p class="hero-sub" data-reveal>This is a small garden. Everything in it grew because you exist. Take your time walking through it.</p>
      </div>
      <div class="hero-art" data-reveal data-grow data-parallax=".05"></div>
      <button class="scroll-cue" data-reveal><span>keep walking</span>
        <svg width="14" height="40" viewBox="0 0 14 40" aria-hidden="true"><path d="M7 0v38M1 32l6 7 6-7" fill="none" stroke="currentColor" stroke-width="1"/></svg></button>`,
    init(el) {
      const art = $(".hero-art", el);
      LW.arrange(art, [["sprig", 4, 2, 78, -14], ["rose", 11, 22, 100, -4], ["daisy", 5, 46, 82, 9], ["heather", 8, 64, 70, 16]]);
      LW.prepGrow(art);
      $(".scroll-cue", el).onclick = () => el.nextElementSibling?.scrollIntoView({ behavior: "smooth" });
    },
  };

  /* =============================== LETTER (personal note) */
  S.letter = {
    skip: (d) => !d.note,
    render: (d) => `
      <div class="letter-paper" data-reveal>
        <span class="tape" aria-hidden="true"></span>
        <span class="hand letter-stamp">a note, before anything else</span>
        <p class="letter-greet">Dear ${LW.fe("{name}")},</p>
        <p class="letter-body">${LW.fe(d.note)}</p>
        <p class="letter-sign">— ${esc(d.from || "me")}</p>
      </div>`,
  };

  /* =============================== COMPLIMENTS */
  S.compliments = {
    render: (d, num) => `
      ${LW.head(num, "Things I hope you", "never forget", "tap the flower for the next one")}
      <div class="c-stage" data-reveal data-grow>
        <button class="c-flower" aria-label="Next compliment"></button>
        <div class="c-right">
          <div class="c-text-wrap"><p class="c-text"></p></div>
          <div class="c-nav">
            <button class="c-arrow c-prev" aria-label="Previous compliment"><svg width="28" height="12" viewBox="0 0 28 12"><path d="M28 6H2M7 1L1.5 6 7 11" fill="none" stroke="currentColor" stroke-width="1"/></svg></button>
            <span class="c-count"><b class="c-idx">01</b><span class="c-sep">/</span><span>${pad(d.compliments.length)}</span></span>
            <button class="c-arrow c-next" aria-label="Next compliment"><svg width="28" height="12" viewBox="0 0 28 12"><path d="M0 6h26M21 1l5.5 5L21 11" fill="none" stroke="currentColor" stroke-width="1"/></svg></button>
          </div>
          <div class="c-progress"><span class="c-bar"></span></div>
          <p class="hand c-end" hidden>that's all of them. for now.</p>
        </div>
      </div>`,
    init(el, d) {
      const C = d.compliments.map(LW.fill);
      const text = $(".c-text", el), fl = $(".c-flower", el);
      let ci = 0, busy = false;
      const apply = (i) => {
        text.textContent = C[i];
        fl.innerHTML = Flora.flower(Flora.types[i % Flora.types.length], { seed: i * 5 + 2 });
        $(".c-idx", el).textContent = pad(i + 1);
        $(".c-bar", el).style.width = `${((i + 1) / C.length) * 100}%`;
        $(".c-end", el).hidden = i !== C.length - 1;
      };
      const step = (dir) => {
        if (busy) return;
        ci = (ci + dir + C.length) % C.length;
        if (!MOTION) return apply(ci);
        busy = true;
        G.timeline({ onComplete: () => (busy = false) })
          .to(text, { opacity: 0, x: -24 * dir, filter: "blur(3px)", duration: .35, ease: "power2.in" })
          .to(fl.querySelector(".flora"), { opacity: 0, scale: .9, y: 10, duration: .35, ease: "power2.in", transformOrigin: "50% 100%" }, "<")
          .add(() => { apply(ci); LW.prepGrow(fl); LW.grow(fl, 0); })
          .fromTo(text, { opacity: 0, x: 24 * dir, filter: "blur(3px)" }, { opacity: 1, x: 0, filter: "blur(0px)", duration: .6, ease: "power3.out" });
      };
      $(".c-next", el).onclick = () => step(1);
      $(".c-prev", el).onclick = () => step(-1);
      fl.onclick = () => step(1);
      swipe($(".c-stage", el), step);
      apply(0); LW.prepGrow(fl);
    },
  };

  function swipe(target, step) {
    let tx = null;
    target.addEventListener("touchstart", (e) => (tx = e.touches[0].clientX), { passive: true });
    target.addEventListener("touchend", (e) => {
      if (tx === null) return;
      const dx = e.changedTouches[0].clientX - tx; tx = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    });
  }
  LW.swipe = swipe;

  /* =============================== THE GRAND BOUQUET */
  const BQ = [
    ["redrose", 200, 190, 1.35], ["redrose", 142, 234, 1.2], ["redrose", 262, 238, 1.2],
    ["tulip", 112, 172, 1.25], ["tulip", 292, 164, 1.25],
    ["daisy", 168, 128, 1.05], ["daisy", 240, 118, 1.05], ["daisy", 330, 244, .95],
    ["babysbreath", 78, 250, 1.35],
  ];
  const BQ_NAMES = { redrose: "rose", tulip: "tulip", daisy: "daisy", babysbreath: "sprig of baby's breath" };

  function bouquetSVG() {
    const stems = BQ.map(([, x, y]) => `<path d="M${x} ${y} Q ${(x + 200) / 2 + R(-10, 10)} ${(y + 455) / 2} 200 458" fill="none" stroke="#7E8B6F" stroke-width="1.6"/>`).join("");
    const leaves = [[90, 290, -62, 48, 14], [318, 292, 62, 48, 14], [150, 160, -22, 40, 11], [256, 150, 26, 40, 11], [200, 128, 2, 38, 10], [56, 214, -82, 42, 12], [348, 200, 78, 42, 12], [122, 112, -38, 36, 10], [282, 100, 36, 36, 10]]
      .map((l) => Flora.leaf(...l)).join("");
    const filler = [[205, 92, .9], [302, 88, .8], [52, 160, .8], [355, 150, .75]]
      .map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="bq-filler">${Flora.head("babysbreath")}</g></g>`).join("");
    const flowers = BQ.map(([t, x, y, s], i) =>
      `<g class="bq-fl" data-i="${i}" transform="translate(${x} ${y}) scale(${s})" tabindex="0" role="button" aria-label="Read the note on this ${BQ_NAMES[t]}">
         <circle r="30" fill="transparent"/><g class="bq-head">${Flora.head(t)}</g></g>`).join("");
    return `
    <svg class="bq-svg" viewBox="0 0 400 570" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="bqBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
        <pattern id="bqPaper" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0 L0 8" stroke="#542B3A" stroke-opacity=".05" stroke-width="3"/></pattern>
      </defs>
      <ellipse cx="200" cy="552" rx="96" ry="10" fill="#542B3A" opacity=".18" filter="url(#bqBlur)"/>
      <g class="bq-sway">
        <g class="bq-back">
          <path d="M200 475 L 26 150 Q 58 108 110 122 Q 150 66 200 84 Q 250 66 290 122 Q 342 108 374 150 Z" fill="#F3D4C5" stroke="#542B3A" stroke-opacity=".22" stroke-width=".8"/>
          <path d="M200 475 L 110 122 M200 475 L 290 122 M200 475 L200 84" stroke="#542B3A" stroke-opacity=".08" stroke-width="1"/>
        </g>
        <g class="bq-stems">${stems}</g>
        <g class="bq-leaves">${leaves}</g>
        <g class="bq-fillers">${filler}</g>
        <g class="bq-flowers">${flowers}</g>
        <g class="bq-front-l">
          <path d="M200 545 L 44 298 Q 84 322 118 302 Q 156 334 200 318 Z" fill="#EFE2D2" stroke="#542B3A" stroke-opacity=".25" stroke-width=".8"/>
          <path d="M200 545 L 44 298 Q 84 322 118 302 Q 156 334 200 318 Z" fill="url(#bqPaper)"/>
          <path d="M200 540 L 92 318" stroke="#542B3A" stroke-opacity=".1"/>
        </g>
        <g class="bq-front-r">
          <path d="M200 545 L 356 298 Q 316 322 282 302 Q 244 334 200 318 Z" fill="#E8D5C2" stroke="#542B3A" stroke-opacity=".25" stroke-width=".8"/>
          <path d="M200 545 L 356 298 Q 316 322 282 302 Q 244 334 200 318 Z" fill="url(#bqPaper)"/>
          <path d="M200 540 L 308 318" stroke="#542B3A" stroke-opacity=".1"/>
        </g>
        <g class="bq-ribbon">
          <path d="M197 448 C 192 480 178 504 166 528" fill="none" stroke="#542B3A" stroke-width="4" stroke-linecap="round"/>
          <path d="M203 448 C 210 478 226 500 240 522" fill="none" stroke="#6B3849" stroke-width="4" stroke-linecap="round"/>
          <path d="M200 440 C 160 404 132 448 168 464 C 184 470 196 454 200 440Z" fill="#542B3A" stroke="#3a1c27" stroke-width=".8"/>
          <path d="M200 440 C 240 404 268 448 232 464 C 216 470 204 454 200 440Z" fill="#6B3849" stroke="#3a1c27" stroke-width=".8"/>
          <path d="M175 446 C 182 450 190 450 196 444 M225 446 C 218 450 210 450 204 444" stroke="#D99AA5" stroke-opacity=".5" fill="none"/>
          <ellipse cx="200" cy="443" rx="8" ry="7" fill="#45222f"/>
        </g>
      </g>
    </svg>`;
  }

  S.bouquet = {
    render: (d, num) => `
      <div class="bq-grid">
        <div class="bq-copy">
          ${LW.head(num, "A bouquet,", "just for you", "")}
          <p class="bq-lede" data-reveal>Every flower has a note tucked inside it. Tap one to read it. When you've had a look, unwrap it.</p>
          <p class="bq-count hand" data-reveal><span class="bq-found">0</span> of ${BQ.length} notes found</p>
          <div class="bq-actions" data-reveal>
            <button class="btn-ink bq-unwrap">Unwrap your bouquet</button>
            <button class="btn-text bq-happy">send yourself a little happiness</button>
          </div>
          <div class="bq-letter" hidden>
            <span class="tape" aria-hidden="true"></span>
            <p class="bq-letter-body">${LW.fe(d.bouquet.letter)}</p>
          </div>
        </div>
        <div class="bq-stage" data-reveal>${bouquetSVG()}</div>
      </div>`,
    init(el, d) {
      const msgs = d.bouquet.messages;
      const found = new Set(store.get("bq-found", []));
      const count = () => { $(".bq-found", el).textContent = found.size; $$(".bq-fl", el).forEach((f) => f.classList.toggle("read", found.has(+f.dataset.i))); };
      count();

      const heads = $$(".bq-head", el), fillers = $$(".bq-filler", el), leaves = $$(".fl-leaf", el);
      if (MOTION) {
        G.set([...heads, ...fillers], { scale: 0, transformOrigin: "50% 50%" });
        G.set(leaves, { scale: 0, transformOrigin: "50% 100%" });
        G.set($(".bq-stems", el).children, { strokeDasharray: 400, strokeDashoffset: 400 });
      }
      LW.onReveal($(".bq-stage", el), () => {
        if (!MOTION) return;
        const tl = G.timeline({ delay: .15 });
        tl.to($(".bq-stems", el).children, { strokeDashoffset: 0, duration: .8, stagger: .04, ease: "power2.out" })
          .to(leaves, { scale: 1, duration: .5, stagger: .03, ease: "back.out(2)" }, "-=.55")
          .to(G.utils.shuffle([...heads]), { scale: 1, rotation: 0, duration: .9, stagger: .11, ease: "back.out(1.6)" }, "-=.45")
          .to(fillers, { scale: 1, duration: .6, stagger: .08, ease: "back.out(2)" }, "-=.8");
      });

      const openNote = (fl, evt) => {
        const i = +fl.dataset.i;
        const [type] = BQ[i];
        const [x, y] = evt && evt.clientX ? [evt.clientX, evt.clientY] : LW.centerOf(fl);
        LW.petalBurst(x, y, 14, type === "redrose" ? ["#A3243B", "#C2404F", "#D99AA5"] : undefined);
        if (MOTION) G.fromTo($(".bq-head", fl), { scale: 1.18 }, { scale: 1, duration: .8, ease: "elastic.out(1, .4)" });
        found.add(i); store.set("bq-found", [...found]); count();
        setTimeout(() => LW.openOverlay(`
          <div class="note-card">
            <div class="note-flower">${Flora.flower(type === "redrose" ? "rose" : type === "babysbreath" ? "sprig" : type, { seed: i + 3 })}</div>
            <span class="hand note-kicker">tucked inside the ${BQ_NAMES[type]}</span>
            <p class="note-text">${LW.fe(msgs[i])}</p>
          </div>`, { onOpen: (b) => { LW.prepGrow(b); LW.grow(b, .1); } }), 260);
      };
      $$(".bq-fl", el).forEach((fl) => {
        fl.addEventListener("click", (e) => openNote(fl, e));
        fl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNote(fl); } });
      });

      const unwrapBtn = $(".bq-unwrap", el), letter = $(".bq-letter", el);
      const showUnwrapped = (animate) => {
        unwrapBtn.hidden = true;
        letter.hidden = false;
        el.classList.add("unwrapped");
        // the paper comes off; the ribbon stays, tying the stems together
        if (!animate || !MOTION) { $$(".bq-front-l, .bq-front-r, .bq-back", el).forEach((g) => (g.style.display = "none")); return; }
        G.timeline()
          .to($(".bq-ribbon", el), { rotation: 8, duration: .12, yoyo: true, repeat: 3, transformOrigin: "50% 30%" })
          .to($(".bq-front-l", el), { x: -160, y: 30, rotation: -32, opacity: 0, duration: 1.1, ease: "power3.inOut", transformOrigin: "100% 100%" })
          .to($(".bq-front-r", el), { x: 160, y: 30, rotation: 32, opacity: 0, duration: 1.1, ease: "power3.inOut", transformOrigin: "0% 100%" }, "<")
          .to($(".bq-back", el), { opacity: 0, scale: .92, duration: .9, transformOrigin: "50% 100%" }, "-=.8")
          .add(() => { const [x, y] = LW.centerOf($(".bq-svg", el)); LW.petalBurst(x, y, 22); })
          .fromTo(letter, { opacity: 0, y: 40, rotation: -4 }, { opacity: 1, y: 0, rotation: -1.2, duration: 1, ease: "power3.out" }, "-=.3");
      };
      if (store.get("bq-unwrapped", false)) showUnwrapped(false);
      unwrapBtn.onclick = () => { store.set("bq-unwrapped", true); showUnwrapped(true); };
      $(".bq-happy", el).onclick = () => { LW.flowerShower(); LW.toast("a little happiness, delivered"); };
    },
  };

  // "Send yourself a little happiness": flowers fly up from the bottom and drift down
  LW.flowerShower = () => {
    const layer = $("#burstLayer");
    const types = ["redrose", "tulip", "daisy", "rose", "blossom", "poppy"];
    const n = REDUCE ? 0 : innerWidth < 600 ? 18 : 30;
    if (!n) { LW.toast("consider yourself showered in flowers"); return; }
    for (let i = 0; i < n; i++) {
      const f = document.createElement("div");
      f.className = "shower";
      f.style.width = `${R(28, 54)}px`;
      f.innerHTML = `<svg viewBox="-36 -42 72 72">${Flora.head(types[i % types.length])}</svg>`;
      layer.append(f);
      const x0 = innerWidth / 2 + R(-60, 60), y0 = innerHeight + 40;
      const x1 = R(0, innerWidth), y1 = R(innerHeight * .1, innerHeight * .5);
      const x2 = x1 + R(-80, 80), y2 = innerHeight + 80;
      f.animate([
        { transform: `translate(${x0}px, ${y0}px) rotate(0deg) scale(.3)`, opacity: 0 },
        { transform: `translate(${x1}px, ${y1}px) rotate(${R(-90, 90)}deg) scale(1)`, opacity: 1, offset: .35 },
        { transform: `translate(${x2}px, ${y2}px) rotate(${R(-300, 300)}deg) scale(.9)`, opacity: .9 },
      ], { duration: R(2600, 4200), delay: i * 45, easing: "cubic-bezier(.25,.6,.35,1)", fill: "both" }).onfinish = () => f.remove();
    }
  };

  /* =============================== OPEN-WHEN ENVELOPES */
  const tilt = [-4, 3, -2, 5, -3];
  S.envelopes = {
    render: (d, num) => `
      ${LW.head(num, "Open when…", "you need to", "one for every kind of day", true)}
      <div class="oe-board">
        ${d.letters.map((l, i) => `
          <button class="oe" data-i="${i}" style="--r:${tilt[i]}deg" data-reveal>
            <span class="oe-env" aria-hidden="true">
              <span class="oe-back"></span><span class="oe-paper"></span><span class="oe-front"></span><span class="oe-flap"></span>
              <span class="oe-seal">${["♡", "✦", "❀", "☾", "✧"][i]}</span>
            </span>
            <span class="oe-title">${LW.fe(l.title)}</span>
          </button>`).join("")}
      </div>`,
    init(el, d) {
      const opened = new Set(store.get("oe-opened", []));
      const mark = () => $$(".oe", el).forEach((b) => b.classList.toggle("opened", opened.has(+b.dataset.i)));
      mark();
      $$(".oe", el).forEach((b) => b.addEventListener("click", () => {
        const i = +b.dataset.i, l = d.letters[i];
        const show = () => {
          opened.add(i); store.set("oe-opened", [...opened]); mark();
          LW.openOverlay(`
            <div class="oe-letter">
              <span class="hand oe-letter-kicker">${LW.fe(l.title)}</span>
              <p class="oe-letter-greet">${LW.fe("{name}")},</p>
              <p class="oe-letter-body">${LW.fe(l.text)}</p>
              <p class="oe-letter-sign">— ${esc(d.from || "me")}</p>
            </div>`, { theme: "paper" });
        };
        if (!MOTION || opened.has(i)) return show();
        G.timeline({ onComplete: show })
          .to($(".oe-seal", b), { scale: 0, rotation: 40, opacity: 0, duration: .3, ease: "back.in(2)" })
          .to($(".oe-flap", b), { rotationX: 180, duration: .5, ease: "power2.inOut" })
          .set($(".oe-flap", b), { zIndex: 1 })
          .to($(".oe-paper", b), { y: -34, duration: .45, ease: "power2.out" });
      }));
    },
  };

  /* =============================== NIGHT GARDEN */
  const GARDEN = [
    ["redrose", "#FF7A93"], ["moonflower", "#E9E4FF"], ["tulip", "#FFB0C4"], ["lavender", "#B9A2FF"],
    ["daisy", "#FFF3D1"], ["rose", "#FF9BB0"], ["moonflower", "#DCEBFF"], ["lavender", "#C9B3FF"],
    ["tulip", "#FFC3A8"], ["daisy", "#FFFFFF"], ["redrose", "#FF8AA0"], ["moonflower", "#F7E9FF"],
  ];
  function gardenFlower(type, glow, i) {
    const h = [150, 120, 165, 135, 110, 155, 128, 170, 118, 145, 160, 125][i];
    const top = 200 - h;
    const lean = [-6, 4, -3, 7, -5, 2, -7, 5, -2, 6, -4, 3][i];
    return `<svg viewBox="0 0 80 200" class="gf-svg" aria-hidden="true">
      <defs><radialGradient id="gg${i}"><stop offset="0" stop-color="${glow}" stop-opacity=".85"/><stop offset=".45" stop-color="${glow}" stop-opacity=".28"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>
      <circle class="gf-halo" cx="${40 + lean}" cy="${top + 4}" r="34" fill="url(#gg${i})"/>
      <path d="M40 200 Q ${40 - lean} ${top + h * .5} ${40 + lean} ${top + 6}" fill="none" stroke="#6F8A7A" stroke-opacity=".8" stroke-width="1.4"/>
      ${Flora.leaf(40 - lean * .3, top + h * .62, -45, 22, 7).replace(/#A8B49A/g, "#4F6B5E")}
      ${Flora.leaf(40 - lean * .1, top + h * .42, 42, 18, 6).replace(/#A8B49A/g, "#4F6B5E")}
      <g transform="translate(${40 + lean} ${top + 6}) scale(.85)"><g class="gf-head">${Flora.head(type, type === "moonflower" || type === "lavender" ? glow : undefined)}</g></g>
    </svg>`;
  }
  S.garden = {
    tone: "dark",
    render: (d, num) => {
      const stars = Array.from({ length: 70 }, () =>
        `<i style="left:${R(0, 100).toFixed(1)}%;top:${R(0, 70).toFixed(1)}%;--s:${R(1, 2.6).toFixed(1)}px;--d:${R(2, 6).toFixed(1)}s;--o:${R(.3, 1).toFixed(2)}"></i>`).join("");
      const flies = Array.from({ length: 14 }, (_, i) =>
        `<b style="left:${R(4, 96).toFixed(1)}%;top:${R(25, 90).toFixed(1)}%;--dx:${R(-60, 60).toFixed(0)}px;--dy:${R(-60, 30).toFixed(0)}px;--t:${R(6, 12).toFixed(1)}s;--dl:-${R(0, 10).toFixed(1)}s"></b>`).join("");
      return `
      <div class="ng-sky" aria-hidden="true"><div class="ng-stars">${stars}</div><div class="ng-moon" data-parallax=".08"></div><div class="ng-mist"></div></div>
      <div class="ng-flies" aria-hidden="true">${flies}</div>
      <div class="ng-inner">
        ${LW.head(num, "A garden that only", "wakes up for you", "tap a flower to wake it")}
        <div class="ng-msg" aria-live="polite"><p class="ng-msg-text">Twelve flowers are asleep here. Each one is holding something it wants to tell you.</p></div>
        <p class="ng-count"><span class="ng-awake">0</span> / ${GARDEN.length} awake</p>
        <div class="ng-bed">
          ${GARDEN.map(([t, g], i) => `<button class="gf" data-i="${i}" style="--glow:${g}" aria-label="Wake flower ${i + 1}">${gardenFlower(t, g, i)}</button>`).join("")}
        </div>
      </div>`;
    },
    init(el, d) {
      const msgs = d.garden;
      const awake = new Set(store.get("ng-awake", []));
      const textEl = $(".ng-msg-text", el);
      const paint = () => {
        $(".ng-awake", el).textContent = awake.size;
        $$(".gf", el).forEach((b) => b.classList.toggle("lit", awake.has(+b.dataset.i)));
      };
      paint();
      const say = (t) => {
        if (!MOTION) { textEl.textContent = t; return; }
        G.to(textEl, { opacity: 0, y: -8, duration: .25, onComplete: () => { textEl.textContent = t; G.fromTo(textEl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .6, ease: "power2.out" }); } });
      };
      $$(".gf", el).forEach((b) => b.addEventListener("click", () => {
        const i = +b.dataset.i;
        const first = !awake.has(i);
        awake.add(i); store.set("ng-awake", [...awake]); paint();
        const head = $(".gf-head", b);
        const [x, y] = LW.centerOf(head);
        LW.sparkle(x, y, 16, b.style.getPropertyValue("--glow"));
        if (MOTION) G.fromTo(head, { scale: .5, rotation: -25, transformOrigin: "50% 50%" }, { scale: 1, rotation: 0, duration: 1.2, ease: "elastic.out(1, .5)" });
        $$(".gf.speaking", el).forEach((x) => x.classList.remove("speaking"));
        b.classList.add("speaking");
        say(LW.fill(msgs[i]));
        if (first && awake.size === GARDEN.length) setTimeout(() => say(`The whole garden is awake now, ${LW.data.name}. It only took you.`), 3800);
      }));
    },
  };

  /* =============================== SCRAPBOOK */
  const ART = {
    sun: `<rect width="300" height="300" fill="#F7E3D3"/><circle cx="205" cy="105" r="42" fill="#F2B98F"/><circle cx="205" cy="105" r="58" fill="none" stroke="#F2B98F" stroke-opacity=".5" stroke-dasharray="3 7"/><path d="M0 210 Q 80 160 160 200 T 300 185 V300 H0Z" fill="#A8B49A"/><path d="M0 240 Q 110 205 200 240 T 300 235 V300 H0Z" fill="#8E9C7F"/><path d="M60 120 q 10 -8 20 0 q 10 -8 20 0" fill="none" stroke="#542B3A" stroke-width="1.5"/>`,
    moon: `<rect width="300" height="300" fill="#2A2440"/><circle cx="200" cy="90" r="30" fill="#F6EBD9"/><circle cx="214" cy="82" r="28" fill="#2A2440"/>${[[50, 60], [90, 120], [140, 40], [260, 150], [30, 150], [240, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#F6EBD9"/>`).join("")}<path d="M0 220 Q 75 205 150 220 T 300 220 V300 H0Z" fill="#3B3358"/><path d="M0 245 Q 75 232 150 245 T 300 245" fill="none" stroke="#F6EBD9" stroke-opacity=".3"/><path d="M120 222 h60" stroke="#F6EBD9" stroke-opacity=".5" stroke-width="2"/>`,
    tea: `<rect width="300" height="300" fill="#F3E4D6"/><rect y="200" width="300" height="100" fill="#D9B9A3"/><g fill="#FAF5EC" stroke="#542B3A" stroke-width="1.5"><path d="M70 150 h70 v40 a35 35 0 0 1 -70 0z"/><path d="M140 160 a14 14 0 0 1 0 26"/><path d="M165 150 h70 v40 a35 35 0 0 1 -70 0z"/><path d="M235 160 a14 14 0 0 1 0 26"/></g><path d="M95 130 q 6 -10 0 -20 q -6 -10 0 -20 M200 130 q 6 -10 0 -20 q -6 -10 0 -20" fill="none" stroke="#D99AA5" stroke-width="1.5"/><path d="M140 108 c -4 -8 -16 -4 -10 6 l 10 10 l 10 -10 c 6 -10 -6 -14 -10 -6z" fill="#D99AA5"/>`,
    sea: `<rect width="300" height="300" fill="#EADFD3"/><circle cx="80" cy="90" r="26" fill="#F3D4C5"/><path d="M0 180 H300 V300 H0Z" fill="#A8B9B8"/><path d="M0 200 q 25 -10 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 M0 230 q 25 -10 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0" fill="none" stroke="#FAF5EC" stroke-width="1.5"/><path d="M180 175 h60 l-10 12 h-40z" fill="#542B3A"/><path d="M210 175 V120 l25 45z" fill="#FAF5EC" stroke="#542B3A"/>`,
    flower: `<rect width="300" height="300" fill="#F6E7DD"/><rect y="215" width="300" height="85" fill="#E2CBB9"/><path d="M125 215 q -10 -40 10 -60 h30 q 20 20 10 60z" fill="#A8B49A" stroke="#542B3A" stroke-width="1.2"/><g transform="translate(130 120) scale(1.1)">${""}</g>`,
    stars: `<rect width="300" height="300" fill="#FAF5EC"/><rect x="18" y="18" width="264" height="264" fill="none" stroke="#D99AA5" stroke-dasharray="6 6"/><path d="M150 120 l8 16 18 3 -13 12 3 18 -16 -9 -16 9 3 -18 -13 -12 18 -3z" fill="none" stroke="#D99AA5" stroke-width="1.5"/>`,
  };
  const artSVG = (kind) => {
    let inner = ART[kind] || ART.stars;
    if (kind === "flower") inner += `<g transform="translate(150 140) scale(1.3)">${Flora.head("rose")}</g><g transform="translate(118 160) scale(.9)">${Flora.head("daisy")}</g><g transform="translate(184 158) scale(.9)">${Flora.head("tulip")}</g>`;
    return `<svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${inner}</svg>`;
  };
  const doodles = {
    star: `<svg viewBox="0 0 30 30"><path d="M15 2 l3.5 8 8.5 1 -6.5 5.5 2 8.5 -7.5 -4.5 -7.5 4.5 2 -8.5 -6.5 -5.5 8.5 -1z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
    heart: `<svg viewBox="0 0 30 30"><path d="M15 26 C 4 18 2 12 6 7 c 3 -4 8 -2 9 2 c 1 -4 6 -6 9 -2 c 4 5 2 11 -9 19z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`,
    arrow: `<svg viewBox="0 0 80 40"><path d="M2 30 C 20 4 50 4 72 22 M64 14 l9 9 -12 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    swirl: `<svg viewBox="0 0 60 30"><path d="M2 20 c 8 -16 18 -16 16 -4 c -2 10 10 10 14 -2 c 4 -12 14 -10 16 0 c 2 8 8 8 10 2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  };
  S.scrapbook = {
    skip: (d) => !d.scrapbook.length,
    render: (d, num) => `
      ${LW.head(num, "Our little", "scrapbook", "evidence, mostly")}
      <div class="sb-board">
        <span class="sb-doodle d1" aria-hidden="true">${doodles.star}</span>
        <span class="sb-doodle d2" aria-hidden="true">${doodles.swirl}</span>
        <span class="sb-doodle d3" aria-hidden="true">${doodles.heart}</span>
        <span class="sb-sticker s1" aria-hidden="true"><svg viewBox="-34 -40 68 68">${Flora.head("blossom")}</svg></span>
        <span class="sb-sticker s2" aria-hidden="true"><svg viewBox="-34 -40 68 68">${Flora.head("daisy")}</svg></span>
        <span class="sb-sticker s3" aria-hidden="true"><svg viewBox="-34 -40 68 68">${Flora.head("poppy")}</svg></span>
        ${d.scrapbook.map((s, i) => `
          <figure class="pol" data-i="${i}" style="--r:${[-3, 2.5, -1.5, 3.5, -2.5, 1.5][i % 6]}deg" data-reveal tabindex="0">
            <span class="washi w${i % 3}" aria-hidden="true"></span>
            <div class="pol-photo">${s.photo ? `<img src="${esc(s.photo)}" alt="${esc(s.caption)}" loading="lazy">` : artSVG(s.art)}</div>
            <figcaption><span class="pol-cap">${LW.fe(s.caption)}</span>${s.note ? `<span class="pol-note">${LW.fe(s.note)}</span>` : ""}</figcaption>
            ${i === 1 ? `<span class="sb-doodle d4" aria-hidden="true">${doodles.arrow}</span>` : ""}
          </figure>`).join("")}
      </div>`,
    init(el, d) {
      $$(".pol", el).forEach((p) => {
        const open = () => {
          const s = d.scrapbook[+p.dataset.i];
          LW.openOverlay(`<figure class="pol big"><span class="washi w1"></span><div class="pol-photo">${s.photo ? `<img src="${esc(s.photo)}" alt="${esc(s.caption)}">` : artSVG(s.art)}</div>
            <figcaption><span class="pol-cap">${LW.fe(s.caption)}</span>${s.note ? `<span class="pol-note">${LW.fe(s.note)}</span>` : ""}</figcaption></figure>`, { theme: "bare" });
        };
        p.addEventListener("click", open);
        p.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
      });
    },
  };

  /* =============================== FINALE */
  S.finale = {
    render: (d) => `
      <div class="finale-art" data-reveal data-grow data-parallax=".04"></div>
      <div class="finale-text">
        <p class="finale-big" data-reveal>Anyway.</p>
        <p class="finale-line" data-reveal>${LW.fe(d.finalMessage)}</p>
        <span class="hand finale-note" data-reveal>that was the whole point of this page.</span>
        <p class="finale-from" data-reveal>${d.from ? `— made by ${esc(d.from)}, with far too much care` : "— made with far too much care"}</p>
        <div class="finale-actions" data-reveal>
          <button class="btn-text f-replay">open the envelope again</button>
          <button class="btn-text f-top">back to the top</button>
        </div>
      </div>`,
    init(el) {
      const art = $(".finale-art", el);
      LW.arrange(art, [["tulip", 21, 0, 86, -10], ["poppy", 9, 26, 100, 2], ["sprig", 13, 50, 74, 14]]);
      LW.prepGrow(art);
      $(".f-replay", el).onclick = () => location.reload();
      $(".f-top", el).onclick = () => scrollTo({ top: 0, behavior: "smooth" });
    },
  };
})();
