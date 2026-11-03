/* Hand-drawn style botanical SVGs, generated from simple petal geometry.
   Every flower is drawn with thin ink outlines like a vintage botanical plate. */
(function () {
  const INK = "#332B2B", SAGE = "#A8B49A", SAGE_D = "#7E8B6F", ROSE = "#D99AA5",
        ROSE_D = "#C47F8C", BURG = "#542B3A", PEACH = "#F3D4C5", IVORY = "#FAF5EC", OCHRE = "#D2A867";
  const line = `stroke="${INK}" stroke-opacity=".55" stroke-width=".8" stroke-linejoin="round"`;

  function rng(seed) {
    let s = (seed || 1) * 9301 + 49297;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  // A single petal pointing up from (0,0)
  const petal = (len, wid) =>
    `M0 0 C ${-wid} ${-len * .3} ${-wid * .85} ${-len * .85} 0 ${-len} C ${wid * .85} ${-len * .85} ${wid} ${-len * .3} 0 0Z`;

  function ring(n, len, wid, fill, offset = 0) {
    let s = "";
    for (let i = 0; i < n; i++) {
      s += `<path d="${petal(len, wid)}" transform="rotate(${(offset + i * 360 / n).toFixed(1)})" fill="${fill}" ${line}/>`;
    }
    return s;
  }
  function veins(n, len, offset = 0) {
    let s = "";
    for (let i = 0; i < n; i++) {
      s += `<path d="M0 ${-len * .2} L0 ${-len * .7}" transform="rotate(${(offset + i * 360 / n).toFixed(1)})" stroke="${INK}" stroke-opacity=".22" stroke-width=".6"/>`;
    }
    return s;
  }
  function dots(n, r, size, color) {
    let s = "";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      s += `<circle cx="${(Math.cos(a) * r).toFixed(1)}" cy="${(Math.sin(a) * r).toFixed(1)}" r="${size}" fill="${color}"/>`;
    }
    return s;
  }

  const HEADS = {
    blossom: () => ring(5, 26, 15, ROSE) + veins(5, 26) + `<circle r="5.5" fill="${OCHRE}" ${line}/>` + dots(7, 8, .9, INK),
    daisy: () => ring(18, 29, 4.6, IVORY) + ring(9, 20, 4, IVORY, 10) + `<circle r="7.5" fill="${OCHRE}" ${line}/><circle r="4" fill="none" stroke="${INK}" stroke-opacity=".3" stroke-width=".6"/>`,
    rose: () => ring(5, 28, 17, PEACH) + ring(5, 22, 14, ROSE, 36) + ring(4, 15, 10, ROSE_D, 12) + ring(3, 8, 6, BURG, 50) +
      `<path d="M-2 0 C -2 -3 3 -3 3 0 C 3 3 -4 4 -4 0" fill="none" stroke="${IVORY}" stroke-opacity=".7" stroke-width=".7"/>`,
    poppy: () => ring(4, 28, 24, ROSE, 45) + ring(4, 20, 16, PEACH, 0) +
      Array.from({ length: 14 }, (_, i) => `<path d="M0 -6 L0 -11" transform="rotate(${i * 360 / 14})" stroke="${BURG}" stroke-width=".8"/>`).join("") +
      `<circle r="6" fill="${BURG}"/>` + dots(14, 11.5, 1, BURG),
    tulip: () =>
      `<path d="M-15 0 C -19 -18 -12 -34 -5 -31 L 0 -38 L 5 -31 C 12 -34 19 -18 15 0 C 9 8 -9 8 -15 0Z" fill="${ROSE}" ${line}/>` +
      `<path d="M-7 4 C -10 -10 -5 -26 0 -36 C 5 -26 10 -10 7 4 C 3 7 -3 7 -7 4Z" fill="${PEACH}" ${line}/>` +
      `<path d="M0 -30 L0 2" stroke="${INK}" stroke-opacity=".2" stroke-width=".6"/>`,
    bud: () =>
      `<path d="M0 4 C -10 -4 -8 -20 0 -28 C 8 -20 10 -4 0 4Z" fill="${ROSE_D}" ${line}/>` +
      `<path d="M0 4 C -8 0 -12 -10 -9 -16 M0 4 C 8 0 12 -10 9 -16" fill="none" stroke="${SAGE_D}" stroke-width="1"/>` +
      `<path d="M-4 2 C -9 -4 -9 -10 -6 -14 L -2 -6Z M4 2 C 9 -4 9 -10 6 -14 L 2 -6Z" fill="${SAGE}" ${line}/>`,
  };

  // --- v2 additions: bouquet + night-garden heads ---
  const RED = "#A3243B", RED_L = "#C2404F", RED_D = "#6E1526";
  HEADS.redrose = () => ring(5, 30, 18, RED_L) + ring(5, 24, 15, RED, 36) + ring(4, 16, 11, RED_D, 12) + ring(3, 9, 6.5, "#55101E", 50) +
    `<path d="M-2 0 C -2 -3 3 -3 3 0 C 3 3 -4 4 -4 0" fill="none" stroke="#F3D4C5" stroke-opacity=".5" stroke-width=".7"/>`;
  HEADS.babysbreath = () => {
    let s = "";
    const pts = [[-16, -14], [-8, -22], [0, -26], [9, -21], [17, -12], [-12, -4], [12, -3], [-3, -15], [5, -10]];
    pts.forEach(([x, y]) => { s += `<path d="M0 6 Q ${x * .4} ${y * .3} ${x} ${y}" fill="none" stroke="${SAGE_D}" stroke-width=".6"/>`; });
    pts.forEach(([x, y]) => { s += `<g transform="translate(${x} ${y})">${dots(5, 1.8, 1.5, IVORY)}<circle r="1" fill="${OCHRE}" opacity=".6"/></g>`; });
    return s.replace(/fill="#FAF5EC"/g, `fill="${IVORY}" ${line} stroke-width=".4"`);
  };
  HEADS.moonflower = (c = "#F5F1FF") =>
    ring(5, 28, 22, c) + `<circle r="16" fill="${c}" opacity=".7"/>` + veins(5, 28, 0) + `<circle r="7" fill="#FFF7D6" ${line}/><circle r="3" fill="${OCHRE}"/>`;
  HEADS.lavender = (c = "#9C88C4") => {
    let s = `<path d="M0 6 L0 -46" stroke="${SAGE_D}" stroke-width="1"/>`;
    for (let i = 0; i < 9; i++) {
      const y = -i * 5.2, w = 4.2 - i * .25;
      s += `<ellipse cx="-3" cy="${y}" rx="${w * .7}" ry="${w * 1.2}" transform="rotate(-25 -3 ${y})" fill="${c}" ${line}/>` +
           `<ellipse cx="3" cy="${y - 2}" rx="${w * .7}" ry="${w * 1.2}" transform="rotate(25 3 ${y - 2})" fill="${c}" ${line}/>`;
    }
    return s;
  };

  function leaf(x, y, angle, len, wid) {
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})"><g class="fl-leaf">` +
      `<path d="${petal(len, wid)}" fill="${SAGE}" ${line}/><path d="M0 -2 L0 ${-len * .85}" stroke="${SAGE_D}" stroke-width=".6"/></g></g>`;
  }

  // point on quadratic bezier
  const qp = (t, a, b, c) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

  function flower(type, opts = {}) {
    const r = rng(opts.seed || 3);
    const W = 120, H = 200;
    const bend = (r() - .5) * 40;
    const hx = 60 + (r() - .5) * 18, hy = 58 + r() * 10;
    const sx = 60, sy = 198, cx = 60 + bend, cy = 130;
    let stem, leaves = "", head = "";

    if (type === "heather") {
      stem = `M60 198 Q ${60 + bend * .3} 120 ${hx} 26`;
      for (let i = 0; i < 9; i++) {
        const t = .55 + i * .05;
        const x = qp(t, 60, 60 + bend * .3, hx), y = qp(t, 198, 120, 26);
        const side = i % 2 ? 1 : -1;
        head += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g class="fl-head"><ellipse cx="${side * 4}" cy="0" rx="3" ry="5" transform="rotate(${side * 30} ${side * 4} 0)" fill="${i % 3 ? ROSE : ROSE_D}" ${line}/></g></g>`;
      }
      leaves = leaf(qp(.3, 60, 60 + bend * .3, hx), qp(.3, 198, 120, 26), -38, 26, 6) + leaf(qp(.42, 60, 60 + bend * .3, hx), qp(.42, 198, 120, 26), 34, 22, 5);
      return wrap(stem, leaves, head);
    }

    if (type === "sprig") {
      stem = `M60 198 Q ${60 + bend} 110 ${hx} 20`;
      for (let i = 0; i < 7; i++) {
        const t = .2 + i * .12;
        const x = qp(t, 60, 60 + bend, hx), y = qp(t, 198, 110, 20);
        const size = 15 - i * 1.2;
        leaves += leaf(x, y, -62 + (r() - .5) * 10, size, size * .75) + leaf(x, y, 62 + (r() - .5) * 10, size, size * .75);
      }
      leaves += leaf(hx, 20, 0, 12, 8);
      return wrap(stem, leaves, "");
    }

    stem = `M${sx} ${sy} Q ${cx} ${cy} ${hx} ${hy}`;
    const t1 = .38 + r() * .1, t2 = .6 + r() * .1;
    leaves = leaf(qp(t1, sx, cx, hx), qp(t1, sy, cy, hy), -40 - r() * 20, 30, 9) +
             leaf(qp(t2, sx, cx, hx), qp(t2, sy, cy, hy), 38 + r() * 20, 25, 7.5);
    const draw = HEADS[type] || HEADS.blossom;
    head = `<g transform="translate(${hx.toFixed(1)} ${hy.toFixed(1)}) rotate(${((r() - .5) * 24).toFixed(1)})"><g class="fl-head">${draw()}</g></g>`;
    return wrap(stem, leaves, head);

    function wrap(stem, leaves, head) {
      return `<svg class="flora" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
        `<path class="fl-stem" pathLength="1" d="${stem}" fill="none" stroke="${SAGE_D}" stroke-width="1.5" stroke-linecap="round"/>` +
        leaves + head + `</svg>`;
    }
  }

  function petalSVG(color) {
    return `<svg viewBox="-13 -27 26 29" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${petal(25, 12)}" fill="${color}" ${line} stroke-opacity=".25"/></svg>`;
  }

  // raw head markup (centered on 0,0) for hand-composed scenes like the bouquet
  function head(type, color) { return (HEADS[type] || HEADS.blossom)(color); }

  window.Flora = {
    flower,
    head,
    leaf: (x, y, a, len, wid) => leaf(x, y, a, len, wid),
    petalPath: petal,
    petal: petalSVG,
    types: ["rose", "daisy", "blossom", "tulip", "poppy", "heather", "bud", "sprig"],
    colors: [ROSE, PEACH, ROSE_D, "#EBC3BE"],
  };
})();
