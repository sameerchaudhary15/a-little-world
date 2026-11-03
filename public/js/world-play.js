/* Interactive sections: question bank, personality quiz, gift, wheel, stars, meter, diary, wish, secret button */
(function () {
  const { $, $$, G, MOTION, REDUCE, esc, pad, R, pickOne } = LW;
  const S = LW.sections;
  const store = LW.store;

  /* =============================== QUESTION BANK (50+ questions, autosaved) */
  S.questions = {
    skip: (d) => !d.questions.length,
    render: (d, num) => `
      ${LW.head(num, "Let's see how well", "you know yourself", "no wrong answers. some judged ones.", true)}
      <div class="q-sheet" data-reveal>
        <span class="tape sage" aria-hidden="true"></span>
        <div class="q-start">
          <p class="q-start-big">${d.questions.length} questions.</p>
          <p class="q-start-sub">Funny ones, teasing ones, a few deep ones. Answer as many as you like. Everything saves as you go, so you can leave and come back.</p>
          <div class="q-actions"><button class="btn-ink small q-begin">Begin</button><button class="btn-text q-restart" hidden>start from the first one</button></div>
        </div>
        <div class="q-run" hidden>
          <div class="q-meta"><span class="q-cat"></span><span class="q-count"></span></div>
          <div class="q-track"><span class="q-fill"></span></div>
          <div class="q-body"><h3 class="q-text"></h3><div class="q-input-wrap"></div></div>
          <div class="q-actions">
            <button class="btn-text q-back">back</button>
            <span class="q-saved hand" aria-live="polite"></span>
            <span class="q-spacer"></span>
            <button class="btn-text q-skip">skip</button>
            <button class="btn-ink small q-next">Next</button>
          </div>
        </div>
        <div class="q-done" hidden>
          <div class="q-done-art" aria-hidden="true"></div>
          <span class="hand q-done-note">well, well, well.</span>
          <h3 class="q-done-title">That's a whole personality, <em>${LW.fe("{name}")}</em>.</h3>
          <p class="q-done-sub"></p>
          <div class="q-done-actions">
            <a class="btn-ink small q-send" target="_blank" rel="noopener">Send my answers</a>
            <button class="btn-text q-copy">copy them</button>
            <button class="btn-text q-review">change an answer</button>
          </div>
          <ol class="q-summary"></ol>
        </div>
      </div>`,
    init(el, d) {
      const Q = d.questions;
      const local = store.get("qa", null);
      const server = d.progress.questionnaire;
      let st = { answers: {}, index: 0, submittedAt: null, updatedAt: "" };
      [server, local].forEach((src) => { if (src && (src.updatedAt || "") >= (st.updatedAt || "")) st = { ...st, ...src, answers: { ...(src.answers || {}) } }; });
      if (server?.submittedAt) st.submittedAt = server.submittedAt;
      let qi = Math.min(st.index || 0, Q.length - 1);

      const views = { start: $(".q-start", el), run: $(".q-run", el), done: $(".q-done", el) };
      const show = (v) => Object.entries(views).forEach(([k, n]) => (n.hidden = k !== v));
      const answered = () => Q.filter((q) => (st.answers[q.id] || "").trim()).length;

      // autosave: local instantly, server debounced
      let saveT = null;
      const savedEl = $(".q-saved", el);
      const persist = (submit = false) => {
        st.index = qi; st.updatedAt = new Date().toISOString();
        store.set("qa", st);
        clearTimeout(saveT);
        const send = async () => {
          const r = await LW.post("answers", { answers: st.answers, index: qi, submit });
          if (r && !r.failed) { savedEl.textContent = "saved"; if (r.submittedAt) st.submittedAt = r.submittedAt; store.set("qa", st); }
          else if (r === null && !LW.legacy) savedEl.textContent = "saved on this phone";
          setTimeout(() => (savedEl.textContent = ""), 1600);
        };
        if (submit) return send();
        saveT = setTimeout(send, 700);
      };

      const begin = $(".q-begin", el), restart = $(".q-restart", el);
      if (answered() && !st.submittedAt) { begin.textContent = `Continue from question ${qi + 1}`; restart.hidden = false; }
      begin.onclick = () => { show("run"); render(); };
      restart.onclick = () => { qi = 0; show("run"); render(); };

      function render(animate = true) {
        const q = Q[qi];
        $(".q-cat", el).textContent = q.cat;
        $(".q-count", el).textContent = `${pad(qi + 1)} of ${pad(Q.length)}`;
        $(".q-text", el).textContent = LW.fill(q.q);
        $(".q-back", el).style.visibility = qi === 0 ? "hidden" : "visible";
        $(".q-next", el).textContent = qi === Q.length - 1 ? "Finish" : "Next";
        const fill = $(".q-fill", el), pct = `${((qi + 1) / Q.length) * 100}%`;
        MOTION ? G.to(fill, { width: pct, duration: .7, ease: "power3.out" }) : (fill.style.width = pct);

        const box = $(".q-input-wrap", el);
        if (q.type === "choice") {
          const opts = q.options.map((o) => ({ t: LW.fill(o.t), r: LW.fill(o.r) }));
          const chosen = opts.findIndex((o) => o.t === st.answers[q.id]);
          box.innerHTML = `<ol class="q-opts">${opts.map((o, i) =>
            `<li><button class="q-opt${i === chosen ? " sel" : ""}" data-i="${i}"><span class="q-letter">${"abcdef"[i]}</span><span>${esc(o.t)}</span></button></li>`).join("")}</ol>
            <p class="q-react hand">${chosen >= 0 ? esc(opts[chosen].r) : ""}</p>`;
          $$(".q-opt", box).forEach((b) => b.addEventListener("click", () => {
            const o = opts[+b.dataset.i];
            st.answers[q.id] = o.t; persist();
            $$(".q-opt", box).forEach((x) => x.classList.toggle("sel", x === b));
            const react = $(".q-react", box);
            react.textContent = o.r;
            if (MOTION) G.fromTo(react, { opacity: 0, y: 6, rotation: -2 }, { opacity: 1, y: 0, rotation: 0, duration: .5, ease: "back.out(2)" });
          }));
        } else {
          box.innerHTML = `<textarea class="q-input" rows="3" maxlength="1500" placeholder="write anything…" aria-label="Your answer"></textarea>`;
          const ta = $("textarea", box);
          ta.value = st.answers[q.id] || "";
          ta.addEventListener("input", () => { st.answers[q.id] = ta.value; persist(); });
          if (animate && matchMedia("(hover: hover)").matches) setTimeout(() => ta.focus({ preventScroll: true }), 350);
        }
        if (animate && MOTION) G.fromTo($(".q-body", el), { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: .5, ease: "power2.out" });
      }

      const go = (dir) => {
        const next = qi + dir;
        if (next >= Q.length) return finish();
        if (next < 0) return;
        const swap = () => { qi = next; persist(); render(); };
        MOTION ? G.to($(".q-body", el), { opacity: 0, x: -18 * dir, duration: .22, ease: "power2.in", onComplete: swap }) : swap();
      };
      $(".q-next", el).onclick = () => go(1);
      $(".q-skip", el).onclick = () => go(1);
      $(".q-back", el).onclick = () => go(-1);

      const answerText = () => `${d.name}'s answers ♡\n\n` + Q.map((q, i) => `${i + 1}. ${LW.fill(q.q)}\n→ ${(st.answers[q.id] || "").trim() || "(skipped, mysteriously)"}`).join("\n\n");

      async function finish(fromLoad) {
        show("done");
        if (!fromLoad) await persist(true);
        const n = answered();
        $(".q-done-sub", el).textContent = `${n} of ${Q.length} answered.` + (d.from ? ` ${d.from} can already read them, but you can also send them yourself.` : " Your answers are saved.");
        $(".q-summary", el).innerHTML = Q.map((q) => `<li><p class="sq">${esc(LW.fill(q.q))}</p><p class="sa">${esc((st.answers[q.id] || "").trim() || "(skipped, mysteriously)")}</p></li>`).join("");
        const send = $(".q-send", el);
        send.href = `https://wa.me/${d.phone || ""}?text=${encodeURIComponent(answerText())}`;
        send.textContent = d.from ? `Send them to ${d.from}` : "Send them back";
        const art = $(".q-done-art", el);
        LW.arrange(art, [["rose", 31, 10, 100, -8], ["daisy", 32, 38, 84, 6], ["tulip", 33, 62, 92, 12]]);
        if (!fromLoad && MOTION) {
          LW.prepGrow(art); LW.grow(art, .1);
          G.from($$(".q-done > :not(.q-done-art)", el), { opacity: 0, y: 14, duration: .7, stagger: .08, delay: .4, ease: "power2.out" });
          const [x, y] = LW.centerOf(art); LW.petalBurst(x, y, 24);
        }
      }
      $(".q-copy", el).onclick = async () => LW.toast((await LW.copy(answerText())) ? "Answers copied" : "Couldn't copy");
      $(".q-review", el).onclick = () => { qi = 0; show("run"); render(); };
      if (st.submittedAt) finish(true);
    },
  };

  /* =============================== PERSONALITY QUIZ */
  const TYPES = {
    overthinker: ["Professional Overthinker", "You've already imagined this result, three alternatives, and a scenario where the website is mad at you. It isn't. Your brain is a beautifully over-qualified detective. Let it take a day off sometimes."],
    drama: ["Certified Drama Queen", "Every minor event in your life deserves a background score, and honestly? It gets one. You make stories out of nothing and nobody is ever bored around you."],
    main: ["Main Character Energy", "You walk into rooms like the camera is following you, and somehow it works. The plot genuinely moves when you show up."],
    softie: ["Secret Softie", "Tough exterior, marshmallow interior. You cry at adverts and you'd fight anyone for your friends. We're all keeping your secret. Mostly."],
    plot: ["Walking Plot Twist", "Nobody can predict you, including you. Your life is unhinged in the most entertaining way, and your stories are legendary."],
    chaos: ["Chaos Coordinator", "You're the reason the group chat is alive. You make the plans, break the plans, and somehow everyone has the best night anyway."],
    sunshine: ["The Human Sunshine", "You make people feel warm without trying. Bad days get shorter when you're around. It's honestly a public service."],
    menace: ["Emotionally Intelligent Menace", "You understand exactly how everyone feels, and you will use that knowledge to roast them with surgical precision. Lovingly. Mostly lovingly."],
  };
  const PQ = [
    ["Someone texts \"we need to talk.\" You:", [["Draft fourteen scenarios before replying", "overthinker"], ["Reply \"who died\"", "drama"], ["Put on a good song and walk dramatically to your phone", "main"], ["\"omg are you okay?? I'm here\"", "softie"]]],
    ["Your ideal Friday night:", [["A tiny plan that turns into a legendary story", "plot chaos"], ["Blanket, comfort show, crying at the scene you've seen six times", "softie"], ["Running the group chat like a small government", "chaos"], ["Fixing someone's terrible week", "sunshine"]]],
    ["They're out of your favourite snack. You:", [["Tell everyone life is a cruel joke", "drama"], ["Replay it in your head for three days", "overthinker"], ["Turn it into the funniest story of the week", "plot"], ["Shrug, and cheer up the cashier", "sunshine"]]],
    ["In a group, you're the one who:", [["Knows exactly who's upset and why", "menace"], ["Makes the plan, changes the plan, makes a new plan", "chaos"], ["Walks in late and everyone turns around", "main"], ["Makes sure everyone has eaten", "softie sunshine"]]],
    ["Your texting style:", [["Seven messages in a row, then a voice note", "drama chaos"], ["Typing… stopped… typing…", "overthinker"], ["One devastatingly accurate observation", "menace"], ["A random dog photo with no context", "plot"]]],
    ["Someone compliments you. You:", [["Deflect it, then think about it for a week", "softie overthinker"], ["\"I know\" (sweetly)", "main"], ["Compliment them back twice as hard", "sunshine"], ["Ask what they want", "menace"]]],
    ["Your life soundtrack is mostly:", [["Sad songs, happily", "softie"], ["Movie trailer music", "main drama"], ["Whatever's on. Genre is a construct", "plot"], ["Songs you dance to in the kitchen", "sunshine"]]],
    ["Your secret superpower:", [["Predicting every possible outcome (and dreading most)", "overthinker"], ["Winning arguments kindly but devastatingly", "menace"], ["Turning boring days into adventures", "plot chaos"], ["Making other people feel like the main character", "sunshine main"]]],
  ];

  S.personality = {
    render: (d, num) => `
      ${LW.head(num, "So, what kind of", "person are you?", "a very scientific quiz. very.")}
      <div class="pq" data-reveal>
        <div class="pq-run">
          <div class="pq-dots">${PQ.map(() => "<i></i>").join("")}</div>
          <h3 class="pq-q"></h3>
          <div class="pq-opts"></div>
        </div>
        <div class="pq-result" hidden>
          <span class="hand pq-kicker">the results are in. you are…</span>
          <h3 class="pq-title"></h3>
          <p class="pq-desc"></p>
          <div class="pq-bars"></div>
          <div class="pq-actions">
            <button class="btn-ink small pq-share">Save my result card</button>
            <button class="btn-text pq-again">take it again</button>
          </div>
        </div>
      </div>`,
    init(el, d) {
      let i = 0, picks = [];
      const run = $(".pq-run", el), res = $(".pq-result", el);
      const draw = () => {
        const [q, opts] = PQ[i];
        $$(".pq-dots i", el).forEach((dot, k) => dot.className = k < i ? "done" : k === i ? "now" : "");
        $(".pq-q", el).textContent = q;
        $(".pq-opts", el).innerHTML = opts.map(([t], k) => `<button class="pq-opt" data-k="${k}"><span class="pq-l">${"abcd"[k]}</span>${esc(t)}</button>`).join("");
        if (MOTION) G.from($$(".pq-q, .pq-opt", el), { opacity: 0, y: 10, duration: .45, stagger: .05, ease: "power2.out" });
        $$(".pq-opt", el).forEach((b) => b.onclick = () => {
          b.classList.add("sel");
          picks[i] = PQ[i][1][+b.dataset.k][1];
          setTimeout(() => { i++; i < PQ.length ? draw() : result(true); }, MOTION ? 320 : 0);
        });
      };
      const score = () => {
        const s = Object.fromEntries(Object.keys(TYPES).map((k) => [k, 0]));
        picks.forEach((p) => p.split(" ").forEach((k, idx) => (s[k] += idx === 0 ? 2 : 1)));
        return s;
      };
      function result(fresh, saved) {
        const s = saved?.scores || score();
        const key = saved?.result || Object.entries(s).sort((a, b) => b[1] - a[1] || Math.random() - .5)[0][0];
        const [title, desc] = TYPES[key];
        run.hidden = true; res.hidden = false;
        $(".pq-title", el).textContent = title;
        $(".pq-desc", el).textContent = desc;
        const total = Object.values(s).reduce((a, b) => a + b, 0) || 1;
        const top = Object.entries(s).sort((a, b) => b[1] - a[1]).slice(0, 3);
        $(".pq-bars", el).innerHTML = top.map(([k, v]) => `<div class="pq-bar"><span>${TYPES[k][0]}</span><b><i style="--w:${Math.round((v / total) * 100)}%"></i></b><em>${Math.round((v / total) * 100)}%</em></div>`).join("");
        if (fresh) {
          LW.post("personality", { result: key, scores: s });
          store.set("pq", { result: key, scores: s });
          if (MOTION) {
            const t = $(".pq-title", el);
            // letters animate individually, but words never break in the middle
            t.innerHTML = title.split(" ").map((w) => `<span class="word">${w.split("").map((c) => `<span class="ch">${esc(c)}</span>`).join("")}</span>`).join(" ");
            G.timeline()
              .from(".pq-kicker", { opacity: 0, y: 10, duration: .5 })
              .from($$(".ch", t), { opacity: 0, y: 30, rotation: () => R(-20, 20), duration: .6, stagger: .03, ease: "back.out(2)" })
              .from($$(".pq-desc, .pq-bars, .pq-actions", el), { opacity: 0, y: 12, duration: .6, stagger: .1 }, "-=.2")
              .from($$(".pq-bar i", el), { width: 0, duration: 1, stagger: .1, ease: "power3.out" }, "-=.5")
              .add(() => { const [x, y] = LW.centerOf(t); LW.petalBurst(x, y, 20); }, .5);
          }
        }
        $(".pq-share", el).onclick = () => shareCard(title, desc, d.name);
      }
      $(".pq-again", el).onclick = () => { i = 0; picks = []; res.hidden = true; run.hidden = false; draw(); };
      const saved = d.progress.personality || store.get("pq", null);
      if (saved && TYPES[saved.result]) result(false, saved); else draw();
    },
  };

  // render a shareable PNG result card on a canvas
  async function shareCard(title, desc, name) {
    try { await document.fonts.ready; } catch {}
    const c = document.createElement("canvas");
    const W = 1080, H = 1350;
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.fillStyle = "#FAF5EC"; x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(84,43,58,.25)"; x.lineWidth = 2; x.strokeRect(50, 50, W - 100, H - 100);
    x.strokeRect(64, 64, W - 128, H - 128);
    const img = new Image();
    const svg = Flora.flower("rose", { seed: 11 }).replace("<svg ", '<svg width="240" height="400" ');
    await new Promise((r) => { img.onload = r; img.onerror = r; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
    try { x.drawImage(img, W - 330, H - 560, 240, 400); } catch {}
    x.textAlign = "left";
    x.fillStyle = "#D99AA5"; x.font = "52px Caveat, cursive"; x.fillText(`${name} is officially a…`, 120, 230);
    x.fillStyle = "#542B3A"; x.font = "500 110px 'Cormorant Garamond', Georgia, serif";
    wrap(x, title, 120, 380, W - 240, 112);
    x.fillStyle = "#332B2B"; x.font = "38px 'DM Sans', sans-serif";
    wrap(x, desc, 120, title.length > 20 ? 680 : 580, W - 460, 56);
    x.fillStyle = "#C4848F"; x.font = "36px Caveat, cursive"; x.textAlign = "right";
    x.fillText("made by Sameer in his free time ♡", W - 110, H - 110);
    c.toBlob(async (blob) => {
      const file = new File([blob], "my-personality.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title }); return; } catch { /* fall back to download */ }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "my-personality.png"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      LW.toast("Result card saved");
    }, "image/png");
  }
  function wrap(ctx, text, x, y, maxW, lh) {
    const words = text.split(" "); let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; } else line = t;
    }
    ctx.fillText(line, x, y);
  }

  /* =============================== MYSTERY GIFT */
  S.gift = {
    render: (d, num) => `
      ${LW.head(num, "There's something", "in this box", "go on. it's yours.", true)}
      <div class="gift" data-reveal>
        <button class="gift-box" aria-label="Open the gift">
          <svg viewBox="0 0 240 240" aria-hidden="true">
            <ellipse cx="120" cy="226" rx="80" ry="7" fill="#542B3A" opacity=".12"/>
            <g class="gift-base"><rect x="44" y="110" width="152" height="112" fill="#D99AA5" stroke="#542B3A" stroke-opacity=".35"/><rect x="110" y="110" width="20" height="112" fill="#542B3A"/><path d="M44 110 h152" stroke="#542B3A" stroke-opacity=".25"/></g>
            <g class="gift-lid"><rect x="36" y="84" width="168" height="30" fill="#E3AEB7" stroke="#542B3A" stroke-opacity=".35"/><rect x="110" y="84" width="20" height="30" fill="#542B3A"/>
              <g class="gift-bow"><path d="M120 84 C 90 50 66 76 98 86 Z" fill="#542B3A"/><path d="M120 84 C 150 50 174 76 142 86 Z" fill="#6B3849"/><circle cx="120" cy="83" r="7" fill="#45222f"/></g></g>
          </svg>
          <span class="hand gift-hint">tap to open</span>
        </button>
        <div class="gift-card" hidden><span class="hand">surprise!</span><p>${LW.fe(d.gift)}</p></div>
      </div>`,
    init(el) {
      const box = $(".gift-box", el), card = $(".gift-card", el);
      let opened = false;
      box.onclick = () => {
        if (opened) return; opened = true;
        $(".gift-hint", el).textContent = "";
        if (!MOTION) { $(".gift-lid", el).style.display = "none"; card.hidden = false; return; }
        G.timeline()
          .to(box, { rotation: 3, duration: .08, yoyo: true, repeat: 5, transformOrigin: "50% 100%" })
          .to($(".gift-bow", el), { scale: 0, rotation: 90, opacity: 0, duration: .45, ease: "back.in(2)", transformOrigin: "50% 50%" })
          .to($(".gift-lid", el), { y: -160, x: 60, rotation: 35, opacity: 0, duration: .9, ease: "power3.out", transformOrigin: "50% 50%" })
          .add(() => { const [x, y] = LW.centerOf($(".gift-base", el)); LW.petalBurst(x, y - 40, 22); LW.sparkle(x, y - 40, 14, "#F2C6A0"); }, "-=.7")
          .add(() => (card.hidden = false))
          .fromTo(card, { opacity: 0, y: 60, scale: .8 }, { opacity: 1, y: 0, scale: 1, duration: .9, ease: "back.out(1.5)" }, "-=.4");
      };
    },
  };

  /* =============================== SPIN THE WHEEL */
  const SEG = [
    ["compliment", "Compliment", "#D99AA5"], ["question", "Question", "#A8B49A"], ["dare", "Funny dare", "#F3D4C5"],
    ["secret", "Secret message", "#542B3A"], ["surprise", "Random surprise", "#E3C3A6"],
  ];
  function wheelSVG() {
    const n = SEG.length, r = 140, cx = 150, cy = 150;
    const pt = (a, rr = r) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    return SEG.map(([, label, color], i) => {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
      const mid = (a0 + a1) / 2, [tx, ty] = pt(mid, r * .6);
      // radial labels, flipped on the left half so none read upside down
      let deg = (mid * 180) / Math.PI;
      const norm = ((deg % 360) + 360) % 360;
      deg = norm > 90 && norm < 270 ? deg + 180 - 90 : deg - 90;
      const dark = color === "#542B3A";
      return `<path d="M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z" fill="${color}" stroke="#FAF5EC" stroke-width="2"/>
        <text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" transform="rotate(${(deg + 90).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})" text-anchor="middle" dominant-baseline="middle" fill="${dark ? "#FAF5EC" : "#332B2B"}" font-family="Cormorant Garamond, serif" font-style="italic" font-size="17">${label}</text>`;
    }).join("") + `<circle cx="150" cy="150" r="22" fill="#FAF5EC" stroke="#542B3A" stroke-opacity=".3"/><circle cx="150" cy="150" r="6" fill="#542B3A"/>`;
  }
  S.wheel = {
    render: (d, num) => `
      ${LW.head(num, "Spin it.", "No take-backs.", "whatever it lands on, you have to do it")}
      <div class="wheel-grid">
        <div class="wheel" data-reveal>
          <svg class="wheel-pointer" viewBox="0 0 30 30" aria-hidden="true"><path d="M15 28 L4 4 h22z" fill="#542B3A"/></svg>
          <svg class="wheel-svg" viewBox="0 0 300 300" aria-hidden="true"><g class="wheel-rot">${wheelSVG()}</g></svg>
        </div>
        <div class="wheel-side" data-reveal>
          <button class="btn-ink wheel-spin">Spin the wheel</button>
          <div class="wheel-result" aria-live="polite"><span class="hand wheel-cat">it's waiting for you</span><p class="wheel-text"></p></div>
        </div>
      </div>`,
    init(el, d) {
      const rot = $(".wheel-rot", el);
      let angle = 0, spinning = false;
      const pools = {
        compliment: d.compliments, question: d.questions.map((q) => q.q), dare: d.wheel.dares, secret: d.wheel.secrets, surprise: d.wheel.surprises,
      };
      $(".wheel-spin", el).onclick = () => {
        if (spinning) return; spinning = true;
        const idx = Math.floor(Math.random() * SEG.length);
        const segDeg = 360 / SEG.length;
        // the pointer is at the top: bring segment idx's centre to 0°
        const target = 360 - (idx * segDeg + segDeg / 2) + R(-segDeg * .35, segDeg * .35);
        angle = angle - (angle % 360) + 360 * 5 + target;
        const done = () => {
          spinning = false;
          const [key, label] = SEG[idx];
          $(".wheel-cat", el).textContent = label;
          const t = $(".wheel-text", el);
          t.textContent = LW.fill(pickOne(pools[key]));
          if (MOTION) G.fromTo([$(".wheel-cat", el), t], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .6, stagger: .1, ease: "power2.out" });
          const [x, y] = LW.centerOf($(".wheel-pointer", el)); LW.petalBurst(x, y, 12);
        };
        if (MOTION) G.to(rot, { rotation: angle, svgOrigin: "150 150", duration: 4.2, ease: "power4.out", onComplete: done });
        else { rot.setAttribute("transform", `rotate(${angle} 150 150)`); done(); }
      };
    },
  };

  /* =============================== STAR CONSTELLATION */
  const STARS = [[200, 250], [140, 200], [95, 145], [100, 85], [150, 60], [200, 100], [250, 60], [300, 85], [305, 145]];
  S.stars = {
    tone: "dark",
    render: (d, num) => `
      <div class="ng-sky" aria-hidden="true"><div class="ng-stars">${Array.from({ length: 50 }, () => `<i style="left:${R(0, 100).toFixed(1)}%;top:${R(0, 100).toFixed(1)}%;--s:${R(1, 2.2).toFixed(1)}px;--d:${R(2, 6).toFixed(1)}s;--o:${R(.3, .9).toFixed(2)}"></i>`).join("")}</div></div>
      <div class="ng-inner">
        ${LW.head(num, "Every star up here", "knows something about you", "tap them, in any order")}
        <div class="cst" data-reveal>
          <svg class="cst-svg" viewBox="40 20 320 260">
            <path class="cst-lines" d="" fill="none" stroke="#F6EBD9" stroke-opacity=".5" stroke-width="1" stroke-dasharray="3 4"/>
            ${STARS.map(([x, y], i) => `<g class="cst-star" data-i="${i}" transform="translate(${x} ${y})" tabindex="0" role="button" aria-label="Star ${i + 1}">
              <circle r="18" fill="transparent"/><circle class="cst-glow" r="10" fill="#FFE9B0" opacity=".15"/>
              <path class="cst-shape" d="M0 -7 L1.8 -1.8 7 0 1.8 1.8 0 7 -1.8 1.8 -7 0 -1.8 -1.8Z" fill="#F6EBD9"/></g>`).join("")}
          </svg>
          <p class="cst-text" aria-live="polite">Nine stars. Nine things that are true about you.</p>
          <p class="ng-count"><span class="cst-n">0</span> / ${STARS.length} found</p>
        </div>
      </div>`,
    init(el, d) {
      const order = store.get("cst", []);
      const lines = $(".cst-lines", el), text = $(".cst-text", el);
      const paint = () => {
        lines.setAttribute("d", order.map((i, k) => `${k ? "L" : "M"}${STARS[i][0]} ${STARS[i][1]}`).join(" "));
        $$(".cst-star", el).forEach((s) => s.classList.toggle("on", order.includes(+s.dataset.i)));
        $(".cst-n", el).textContent = order.length;
      };
      paint();
      const tap = (s) => {
        const i = +s.dataset.i;
        if (!order.includes(i)) order.push(i);
        store.set("cst", order); paint();
        const [x, y] = LW.centerOf(s); LW.sparkle(x, y, 12);
        if (MOTION) G.fromTo($(".cst-shape", s), { scale: 2.2, transformOrigin: "50% 50%" }, { scale: 1.3, duration: .8, ease: "elastic.out(1,.4)" });
        const msg = order.length === STARS.length ? `${LW.fill(d.stars[i])} And that's all nine. You made a constellation. It's named after you, obviously.` : LW.fill(d.stars[i]);
        if (MOTION) G.to(text, { opacity: 0, duration: .2, onComplete: () => { text.textContent = msg; G.to(text, { opacity: 1, duration: .5 }); } });
        else text.textContent = msg;
      };
      $$(".cst-star", el).forEach((s) => {
        s.addEventListener("click", () => tap(s));
        s.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(s); } });
      });
    },
  };

  /* =============================== FRIENDSHIP METER */
  S.meter = {
    render: (d, num) => `
      ${LW.head(num, "The official", "friendship meter", "calibrated by absolutely no one")}
      <div class="meter" data-reveal>
        <div class="meter-gauge">
          <svg viewBox="0 0 300 170" aria-hidden="true">
            <path d="M30 150 A120 120 0 0 1 270 150" fill="none" stroke="#EADBCB" stroke-width="18" stroke-linecap="round"/>
            <path class="meter-arc" d="M30 150 A120 120 0 0 1 270 150" fill="none" stroke="#D99AA5" stroke-width="18" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
            ${Array.from({ length: 11 }, (_, i) => { const a = Math.PI + (i / 10) * Math.PI; return `<line x1="${150 + 98 * Math.cos(a)}" y1="${150 + 98 * Math.sin(a)}" x2="${150 + 90 * Math.cos(a)}" y2="${150 + 90 * Math.sin(a)}" stroke="#542B3A" stroke-opacity=".35"/>`; }).join("")}
            <g class="meter-needle"><path d="M150 150 L150 48" stroke="#542B3A" stroke-width="2.5" stroke-linecap="round"/><circle cx="150" cy="150" r="9" fill="#542B3A"/></g>
          </svg>
          <p class="meter-score">—</p>
        </div>
        <div class="meter-controls">
          ${[["How often we roast each other", "roast"], ["Hours lost to phone calls", "calls"], ["Inside jokes per conversation", "jokes"]].map(([l, k]) =>
            `<label class="meter-row"><span>${l}</span><input type="range" min="0" max="10" value="6" data-k="${k}"></label>`).join("")}
          <button class="btn-ink small meter-go">Measure it</button>
          <div class="meter-result" aria-live="polite"><h4></h4><p></p></div>
        </div>
      </div>`,
    init(el, d) {
      const needle = $(".meter-needle", el), arc = $(".meter-arc", el);
      const show = (score, animate) => {
        const tier = score < 110 ? 0 : score < 125 ? 1 : score < 140 ? 2 : 3;
        const m = d.meter[tier];
        $(".meter-result h4", el).textContent = m.title;
        $(".meter-result p", el).textContent = LW.fill(m.text);
        const ang = Math.min(score, 150) / 150 * 180 - 90;
        const sc = $(".meter-score", el);
        if (!animate || !MOTION) {
          needle.setAttribute("transform", `rotate(${ang} 150 150)`); arc.style.strokeDashoffset = 100 - Math.min(score, 150) / 1.5;
          sc.textContent = `${score}%`; return;
        }
        const obj = { v: 0 };
        G.timeline()
          .to(needle, { rotation: 80, svgOrigin: "150 150", duration: .5, ease: "power2.out" })
          .to(needle, { rotation: -60, svgOrigin: "150 150", duration: .4, ease: "power2.inOut" })
          .to(needle, { rotation: 88, svgOrigin: "150 150", duration: .35 })
          .to(needle, { rotation: ang, svgOrigin: "150 150", duration: 1.2, ease: "elastic.out(1, .35)" })
          .to(arc, { strokeDashoffset: 100 - Math.min(score, 150) / 1.5, duration: 1.4, ease: "power2.out" }, 0)
          .to(obj, { v: score, duration: 2.2, ease: "power2.out", onUpdate: () => (sc.textContent = `${Math.round(obj.v)}%`) }, 0)
          .from($$(".meter-result > *", el), { opacity: 0, y: 10, stagger: .1, duration: .5 }, "-=.6")
          .add(() => { if (tier === 3) { const [x, y] = LW.centerOf(sc); LW.petalBurst(x, y, 24); LW.toast("the meter broke. that's a good sign."); } });
      };
      $(".meter-go", el).onclick = () => {
        const v = Object.fromEntries($$("input[type=range]", el).map((i) => [i.dataset.k, +i.value]));
        const score = Math.round(92 + v.roast * 2.2 + v.calls * 1.8 + v.jokes * 2.6 + R(0, 6));
        show(score, true);
        LW.post("meter", { score, title: d.meter[score < 110 ? 0 : score < 125 ? 1 : score < 140 ? 2 : 3].title });
      };
      if (d.progress.meter) show(d.progress.meter.score, false);
    },
  };

  /* =============================== SECRET DIARY */
  S.diary = {
    render: (d, num) => `
      ${LW.head(num, "A diary page,", "just for you", "write whatever you want. it stays here.", true)}
      <div class="diary" data-reveal>
        <div class="diary-page">
          <span class="tape" aria-hidden="true"></span>
          <p class="diary-date hand"></p>
          <textarea class="diary-input" rows="6" maxlength="2000" placeholder="Dear diary…" aria-label="Your diary entry"></textarea>
          <div class="q-actions"><span class="hand diary-hint">only you'll read this here. well, you and anyone you show this link to.</span><span class="q-spacer"></span><button class="btn-ink small diary-save">Keep this</button></div>
        </div>
        <ol class="diary-list"></ol>
      </div>`,
    init(el, d) {
      $(".diary-date", el).textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
      let entries = d.progress.diary?.length ? d.progress.diary : store.get("diary", []);
      const draft = $(".diary-input", el);
      draft.value = store.get("diary-draft", "");
      draft.addEventListener("input", () => store.set("diary-draft", draft.value));
      const list = () => {
        $(".diary-list", el).innerHTML = entries.slice().reverse().map((e) => `<li><span class="hand">${new Date(e.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span><p>${esc(e.text)}</p></li>`).join("");
      };
      list();
      $(".diary-save", el).onclick = async () => {
        const text = draft.value.trim();
        if (!text) return LW.toast("write something first");
        const r = await LW.post("diary", { text });
        if (r && !r.failed) entries = r.entries;
        else { entries = [...entries, { text, at: new Date().toISOString() }]; store.set("diary", entries); }
        draft.value = ""; store.set("diary-draft", "");
        list();
        if (MOTION) G.from($(".diary-list li", el), { opacity: 0, y: -10, duration: .5 });
        LW.toast("kept, safely");
      };
    },
  };

  /* =============================== MAKE A WISH */
  S.wish = {
    tone: "dark",
    render: (d, num) => `
      <div class="ng-sky" aria-hidden="true"><div class="ng-stars">${Array.from({ length: 45 }, () => `<i style="left:${R(0, 100).toFixed(1)}%;top:${R(0, 100).toFixed(1)}%;--s:${R(1, 2.2).toFixed(1)}px;--d:${R(2, 6).toFixed(1)}s;--o:${R(.3, .9).toFixed(2)}"></i>`).join("")}</div></div>
      <div class="ng-inner wish-inner">
        <div class="wish-moon" data-parallax=".06" aria-hidden="true"></div>
        ${LW.head(num, "Make a wish.", "The moon is listening.", "")}
        <form class="wish-form" data-reveal>
          <input class="wish-input" maxlength="500" placeholder="I wish…" aria-label="Your wish" autocomplete="off">
          <button class="btn-moon" type="submit">Send it to the moon</button>
        </form>
        <p class="wish-reply" aria-live="polite"></p>
        <span class="shooting" aria-hidden="true"></span>
      </div>`,
    init(el, d) {
      const form = $(".wish-form", el), input = $(".wish-input", el), reply = $(".wish-reply", el);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) { input.focus(); return; }
        LW.post("wish", { text });
        const ghost = document.createElement("span");
        ghost.className = "wish-ghost"; ghost.textContent = text;
        const r0 = input.getBoundingClientRect(), moon = $(".wish-moon", el).getBoundingClientRect();
        input.value = "";
        const answer = LW.fill(pickOne(d.wishReplies));
        if (!MOTION) { reply.textContent = answer; return; }
        document.body.append(ghost);
        G.set(ghost, { left: r0.left + 12, top: r0.top + r0.height / 2 - 12 });
        G.timeline({ onComplete: () => ghost.remove() })
          .to(ghost, { left: moon.left + moon.width / 2 - 40, top: moon.top + moon.height / 2, scale: .2, opacity: 0, duration: 2, ease: "power2.in" })
          .add(() => { LW.sparkle(moon.left + moon.width / 2, moon.top + moon.height / 2, 18); $(".wish-moon", el).classList.add("heard"); setTimeout(() => $(".wish-moon", el).classList.remove("heard"), 1600); })
          .fromTo($(".shooting", el), { opacity: 1, x: 0, y: 0 }, { x: -380, y: 180, opacity: 0, duration: 1.1, ease: "power1.in" })
          .add(() => (reply.textContent = answer), "-=.6")
          .fromTo(reply, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .8 }, "<");
      });
    },
  };

  /* =============================== THE SECRET BUTTON */
  LW.placeSecret = (d) => {
    const host = $(".sb-board") || $("#s-finale .finale-text") || $("#s-hero");
    if (!host) return;
    const b = document.createElement("button");
    b.className = "secret-btn";
    b.textContent = "don't click this";
    host.append(b);
    let n = 0;
    b.onclick = () => {
      n++;
      const msg = n === 1 ? LW.fill(d.secretButton) : n === 2 ? "Again? Wow. Okay. You're still adorable." : "This is a cry for help. From the button.";
      LW.openOverlay(`<div class="secret-card"><span class="hand">you clicked it.</span><p>${esc(msg)}</p></div>`);
      b.textContent = n === 1 ? "told you" : "seriously";
    };
  };
})();
