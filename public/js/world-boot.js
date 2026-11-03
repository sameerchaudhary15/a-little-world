/* Loads the experience, renders sections in the configured order, runs the opening. */
(function () {
  const { $, $$, G, MOTION } = LW;

  const decodeLegacy = (s) => {
    try { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return JSON.parse(decodeURIComponent(escape(atob(s)))); }
    catch { return null; }
  };
  const titleCase = (s) => s.split(/[-\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

  async function load() {
    const m = location.pathname.match(/\/surprise\/([^/?#]+)/);
    const slug = m ? decodeURIComponent(m[1]).toLowerCase() : "";
    LW.slug = slug;
    if (!slug) return null;
    try {
      const r = await fetch(`/api/x/${encodeURIComponent(slug)}`);
      if (r.ok) return await r.json();
    } catch { /* offline */ }
    // v1 links carried their data in ?d=… — keep them working with default content
    const legacy = new URLSearchParams(location.search).get("d");
    if (window.LW_DEFAULTS && (legacy || !slug.match(/-[a-z0-9]{6}$/))) {
      const p = (legacy && decodeLegacy(legacy)) || {};
      const base = LW_DEFAULTS.create();
      LW.legacy = true;
      return {
        ...base, name: p.n || titleCase(slug), from: p.f || "", note: p.m || "", phone: p.p || "",
        questions: base.questions, progress: { questionnaire: null, personality: null, meter: null, diary: [], wishes: [] },
      };
    }
    return null;
  }

  function render(d) {
    LW.data = d;
    document.title = `For ${d.name} ♡`;
    $$("[data-name]").forEach((el) => (el.textContent = d.name));

    const journey = $("#journey");
    const order = d.sections.filter((s) => s.on && LW.sections[s.id] && !(LW.sections[s.id].skip && LW.sections[s.id].skip(d)));
    let n = 0;
    journey.innerHTML = order.map((s) => {
      const def = LW.sections[s.id];
      const numbered = !["hero", "letter", "finale"].includes(s.id);
      const num = numbered ? `${LW.roman(n++)}.` : "";
      // v1 class names keep the original section styles (hero grid, finale layout…)
      const legacy = { hero: " hero", letter: " letter-sec", compliments: " compliments", questions: " quiz", finale: " finale" }[s.id] || "";
      return `<section class="sec sec-${s.id}${legacy}${def.tone === "dark" ? " is-dark" : ""}" id="s-${s.id}" data-tone="${def.tone || "light"}">${def.render(d, num)}</section>`;
    }).join("");
    order.forEach((s) => { const def = LW.sections[s.id]; def.init && def.init($(`#s-${s.id}`), d); });
    LW.placeSecret(d);

    // any flower illustration gives a little petal burst when tapped
    journey.addEventListener("click", (e) => {
      if (e.target.closest(".hero-art .flora, .finale-art .flora, .sb-sticker")) LW.petalBurst(e.clientX, e.clientY, 14);
    });
  }

  function setupIntro(d) {
    const bloom = $("#bloomLayer");
    const spots = [
      ["rose", 1, "left:-4%;bottom:-6%", -12], ["daisy", 2, "left:14%;bottom:-12%", 6], ["sprig", 3, "right:16%;bottom:-10%", -8],
      ["poppy", 4, "right:-5%;bottom:-5%", 14], ["blossom", 5, "left:-7%;top:-8%", 168], ["tulip", 6, "right:-4%;top:-10%", 190],
      ["heather", 7, "left:30%;top:-14%", 178], ["bud", 8, "right:30%;bottom:-14%", 3],
    ];
    bloom.innerHTML = spots.map(([t, s, pos, rot]) => `<div class="bf" style="${pos};transform:rotate(${rot}deg)">${Flora.flower(t, { seed: s * 3 })}</div>`).join("");
    LW.prepGrow(bloom);

    $("#intro").hidden = false;
    if (MOTION) {
      G.from(".intro-kicker", { opacity: 0, y: 12, duration: 1.1, ease: "power2.out", delay: .2 });
      G.from(".env-wrap", { opacity: 0, y: 30, scale: .92, duration: 1.2, ease: "power3.out", delay: .45 });
      G.from([".intro-hello", "#openBtn"], { opacity: 0, y: 14, duration: 1, stagger: .15, ease: "power2.out", delay: .9 });
    }

    const enter = () => {
      $("#intro").hidden = true;
      $("#journey").hidden = false;
      if (MOTION) G.delayedCall(1.4, () => (bloom.hidden = true)); else bloom.hidden = true;
      scrollTo(0, 0);
      LW.startPetals();
      LW.observeReveals();
      LW.startAmbient();
      LW.post("seen");
    };

    $("#openBtn").addEventListener("click", () => {
      if (!MOTION) return enter();
      $(".env-wrap").style.animation = "none";
      G.timeline()
        .to("#openBtn, .intro-hello, .intro-kicker, .env-aside", { opacity: 0, y: -8, duration: .45, stagger: .05, ease: "power2.in" })
        .to("#envSeal", { scale: 1.25, duration: .18, ease: "power1.out" }, "<.1")
        .to("#envSeal", { scale: 0, opacity: 0, rotation: 30, duration: .3, ease: "power2.in" })
        .to("#envFlap", { rotationX: 180, duration: .8, ease: "power2.inOut" })
        .set("#envFlap", { zIndex: 1 })
        .to("#envLetter", { y: () => -$("#envelope").offsetHeight * .62, duration: .9, ease: "power3.out" })
        .add(() => LW.grow(bloom), "-=.5")
        .add(LW.startPetals, "-=.3")
        .to("#envelope", { scale: 1.08, duration: .6, ease: "sine.inOut" }, "+=.5")
        .to(".env-wrap", { opacity: 0, y: -30, scale: 1.25, filter: "blur(4px)", duration: .8, ease: "power2.in" }, "+=.6")
        .to(bloom, { opacity: 0, duration: 1.4, ease: "power1.inOut" }, "+=.8")
        .add(enter, "-=1.2");
    }, { once: true });
  }

  (async () => {
    const d = await load();
    $("#loading").hidden = true;
    if (!d) { $("#missing").hidden = false; return; }
    render(d);
    setupIntro(d);
  })();
})();
