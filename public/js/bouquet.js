/* Draws a customised bouquet as SVG: flowers, wrapping and ribbon are all generated from the creator's choices. */
(function () {
  const C = window.LW_CATALOG;
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const dark = (c, t) => mix(c, "#2B1018", t), light = (c, t) => mix(c, "#FFFFFF", t);
  const INK = 'stroke="#2B1A1A" stroke-opacity=".35" stroke-width=".7" stroke-linejoin="round"';

  const petal = (len, wid) => `M0 0C${-wid} ${-len * .3} ${-wid * .85} ${-len * .85} 0 ${-len}C${wid * .85} ${-len * .85} ${wid} ${-len * .3} 0 0Z`;
  const ring = (n, len, wid, fill, off = 0) => {
    let s = "";
    for (let i = 0; i < n; i++) s += `<path d="${petal(len, wid)}" transform="rotate(${(off + i * 360 / n).toFixed(1)})" fill="${fill}" ${INK}/>`;
    return s;
  };

  const HEADS = {
    rose: (c) => ring(6, 32, 20, light(c, .12)) + ring(5, 25, 16, c, 30) + ring(5, 18, 12, dark(c, .18), 12) + ring(3, 10, 7, dark(c, .42), 50) +
      `<path d="M-3 0C-3-4 4-4 4 0C4 4-5 5-5 0" fill="none" stroke="${light(c, .55)}" stroke-opacity=".7" stroke-width=".8"/>`,
    tulip: (c) => `<g transform="translate(0 14)"><path d="M-17 0C-22-20-14-38-6-34L0-43L6-34C14-38 22-20 17 0C10 9-10 9-17 0Z" fill="${c}" ${INK}/><path d="M-8 5C-12-11-6-30 0-40C6-30 12-11 8 5C3 8-3 8-8 5Z" fill="${light(c, .28)}" ${INK}/><path d="M0-33V3" stroke="${dark(c, .3)}" stroke-opacity=".5" stroke-width=".7"/></g>`,
    sunflower: (c) => ring(20, 33, 6.5, c) + ring(14, 26, 5.5, dark(c, .1), 9) + `<circle r="14" fill="#54341F" ${INK}/><circle r="9" fill="#3D2415"/>` +
      Array.from({ length: 22 }, (_, i) => `<circle cx="${(Math.cos(i * 2.4) * (2 + i * .52)).toFixed(1)}" cy="${(Math.sin(i * 2.4) * (2 + i * .52)).toFixed(1)}" r=".9" fill="#D9A441"/>`).join(""),
    daisy: (c) => ring(16, 30, 5, c) + ring(10, 21, 4.4, light(c, .4), 11) + `<circle r="8" fill="#E8B23E" ${INK}/><circle r="4" fill="#D08F24"/>`,
    lily: (c) => ring(3, 36, 13, c, 60) + ring(3, 36, 13, light(c, .25), 0) +
      Array.from({ length: 6 }, (_, i) => `<g transform="rotate(${i * 60})"><path d="M0-4V-18" stroke="#8C9A58" stroke-width=".9"/><ellipse cy="-20" rx="1.6" ry="3" fill="#A9562B"/></g>`).join("") +
      `<circle r="3.6" fill="${mix(c, "#B6C97F", .7)}"/>`,
    lavender: (c) => {
      let s = '<path d="M0 12V-46" stroke="#6F7F56" stroke-width="1.2"/>';
      for (let i = 0; i < 9; i++) {
        const y = 4 - i * 5.4, w = 4.6 - i * .26;
        s += `<ellipse cx="-3.2" cy="${y}" rx="${(w * .72).toFixed(1)}" ry="${(w * 1.2).toFixed(1)}" transform="rotate(-25 -3.2 ${y})" fill="${c}" ${INK}/><ellipse cx="3.2" cy="${y - 2}" rx="${(w * .72).toFixed(1)}" ry="${(w * 1.2).toFixed(1)}" transform="rotate(25 3.2 ${y - 2})" fill="${i % 2 ? light(c, .22) : c}" ${INK}/>`;
      }
      return s;
    },
  };
  const DRAW = { redrose: "rose", pinkrose: "rose", tulip: "tulip", sunflower: "sunflower", daisy: "daisy", lily: "lily", lavender: "lavender" };
  const MIXED = [["redrose", "#A3243B"], ["sunflower", "#F2B632"], ["daisy", "#FFFDF6"], ["pinkrose", "#E58CA0"], ["lily", "#FBF6EC"], ["lavender", "#8F79C6"], ["tulip", "#F2A541"]];

  // back-to-front; the first ones are the most central, so small bouquets still look composed
  const SPOTS = [[200, 175, 1.2], [140, 205, 1.1], [262, 205, 1.1], [200, 108, 1.05], [92, 158, .98], [308, 158, .98], [150, 128, .95], [252, 124, .95], [68, 230, .9], [334, 230, .9], [112, 262, .9], [290, 262, .9]];

  const leaf = (x, y, a, l, w) => `<g transform="translate(${x} ${y}) rotate(${a})"><g class="bq-leaf"><path d="${petal(l, w)}" fill="#8FA27C" ${INK}/><path d="M0-2V${-l * .85}" stroke="#66785A" stroke-width=".6"/></g></g>`;

  function ribbonSVG(style, color) {
    if (style === "velvet") return `<g class="bq-ribbon"><path class="bq-tail" d="M186 438C176 478 168 504 150 534L168 528L176 544C190 510 198 478 200 446Z" fill="${dark(color, .1)}"/><path class="bq-tail t2" d="M214 438C224 478 232 504 250 534L232 528L224 544C210 510 202 478 200 446Z" fill="${light(color, .1)}"/><rect x="146" y="412" width="108" height="34" rx="5" fill="${color}"/><rect x="146" y="418" width="108" height="3" fill="${light(color, .25)}" opacity=".5"/></g>`;
    if (style === "twine") return `<g class="bq-ribbon" fill="none" stroke="${color}" stroke-linecap="round"><path d="M150 418Q200 430 250 418M148 426Q200 438 252 426M150 434Q200 446 250 434" stroke-width="2.6"/><path d="M200 436C182 418 166 432 182 442C192 446 198 440 200 436C218 418 234 432 218 442C208 446 202 440 200 436" stroke-width="2.2"/><path class="bq-tail" d="M198 440C192 470 184 490 172 512" stroke-width="2.2"/><path class="bq-tail t2" d="M202 440C208 470 218 488 230 506" stroke-width="2.2"/></g>`;
    if (style === "lace") {
      const dots = Array.from({ length: 11 }, (_, i) => `<circle cx="${150 + i * 10}" cy="447" r="4.2" fill="${color}"/><circle cx="${150 + i * 10}" cy="414" r="4.2" fill="${color}"/><circle cx="${150 + i * 10}" cy="430" r="2" fill="${dark(color, .2)}" opacity=".5"/>`).join("");
      return `<g class="bq-ribbon"><path class="bq-tail" d="M190 448C182 482 172 508 158 530" stroke="${color}" stroke-width="9" fill="none"/><path class="bq-tail t2" d="M210 448C218 482 228 508 242 530" stroke="${color}" stroke-width="9" fill="none"/>${dots}<rect x="146" y="414" width="108" height="33" fill="${color}" opacity=".88"/>${Array.from({ length: 11 }, (_, i) => `<circle cx="${150 + i * 10}" cy="430" r="2.2" fill="${dark(color, .25)}" opacity=".45"/>`).join("")}</g>`;
    }
    const thin = style === "gold";
    const fill = style === "gingham" ? "url(#bqGing)" : color, d = dark(color, .22);
    return `<g class="bq-ribbon"><path class="bq-tail" d="M197 448C192 482 178 508 164 534" fill="none" stroke="${d}" stroke-width="${thin ? 2.5 : 6}" stroke-linecap="round"/><path class="bq-tail t2" d="M203 448C210 480 226 506 242 528" fill="none" stroke="${color}" stroke-width="${thin ? 2.5 : 6}" stroke-linecap="round"/><path d="M200 440C${thin ? "170 416 150 448 176 458C188 462 196 450" : "156 402 128 450 168 468C184 474 196 456"} 200 440Z" fill="${fill}" stroke="${d}" stroke-width=".8"/><path d="M200 440C${thin ? "230 416 250 448 224 458C212 462 204 450" : "244 402 272 450 232 468C216 474 204 456"} 200 440Z" fill="${fill}" stroke="${d}" stroke-width=".8"/><ellipse cx="200" cy="443" rx="${thin ? 4.5 : 8.5}" ry="${thin ? 4 : 7.5}" fill="${d}"/></g>`;
  }

  // the flower types used, in order: useful so that the hidden notes can name them
  function flowerList(cfg) {
    const n = Math.max(3, Math.min(12, cfg.count || 7));
    return Array.from({ length: n }, (_, i) => {
      if (cfg.kind === "mixed") { const [kind, color] = MIXED[i % MIXED.length]; return { kind, color }; }
      return { kind: cfg.kind, color: cfg.color || C.BOUQUET.kinds[cfg.kind]?.colors[0] || "#E58CA0" };
    });
  }

  let uid = 0;
  function svg(cfg, opts = {}) {
    const n = ++uid; // pattern ids must be unique when several bouquets share a page
    const wrap = C.BOUQUET.wraps[cfg.wrap] || C.BOUQUET.wraps.kraft;
    const ribbon = C.BOUQUET.ribbons[cfg.ribbon] || C.BOUQUET.ribbons.satin;
    const flowers = flowerList(cfg);
    const stems = flowers.map((_, i) => { const [x, y] = SPOTS[i]; return `<path class="bq-stem" pathLength="1" style="--i:${i}" d="M${x} ${y}Q${(x + 200) / 2} ${(y + 450) / 2} 200 452" fill="none" stroke="#6F7F56" stroke-width="1.8"/>`; }).join("");
    const heads = flowers.map((f, i) => {
      const [x, y, s] = SPOTS[i];
      const inner = HEADS[DRAW[f.kind]](f.color);
      return `<g class="bq-f" data-i="${i}" ${opts.interactive ? `tabindex="0" role="button" aria-label="Open the note in flower ${i + 1}"` : ""} transform="translate(${x} ${y}) scale(${s})"><circle r="30" fill="transparent"/><g class="bq-sway" style="--i:${i}"><g class="bq-bloom" style="--i:${i}">${inner}</g></g></g>`;
    }).reverse().join("");
    const tint = wrap.a, shade = wrap.b, line = dark(wrap.a, .35);
    return `<svg class="bq-svg" viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${opts.label || "A bouquet of flowers"}">
      <defs><pattern id="bqGing${n}" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#F4F5EC"/><rect width="4.5" height="9" fill="${ribbon.color}" opacity=".55"/><rect width="9" height="4.5" fill="${ribbon.color}" opacity=".55"/></pattern>
      <pattern id="bqFold${n}" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><path d="M0 0V11" stroke="${line}" stroke-opacity=".1" stroke-width="3"/></pattern></defs>
      <g class="bq-all">
        <g class="bq-paper-back"><path d="M200 480L22 178Q60 124 118 138Q150 66 200 84Q250 66 282 138Q340 124 378 178Z" fill="${tint}" stroke="${line}" stroke-opacity=".35"/><path d="M200 480L118 138M200 480L282 138M200 480V84" stroke="${line}" stroke-opacity=".13"/></g>
        <g>${stems}</g>
        <g>${leaf(100, 300, -62, 52, 15)}${leaf(306, 300, 62, 52, 15)}${leaf(146, 158, -24, 44, 12)}${leaf(262, 150, 26, 44, 12)}${leaf(58, 200, -80, 46, 13)}${leaf(344, 196, 78, 46, 13)}</g>
        <g class="bq-heads">${heads}</g>
        <g class="bq-paper-l"><path d="M200 548L40 305Q84 330 120 308Q158 340 200 324Z" fill="${tint}" stroke="${line}" stroke-opacity=".4"/><path d="M200 548L40 305Q84 330 120 308Q158 340 200 324Z" fill="url(#bqFold${n})"/></g>
        <g class="bq-paper-r"><path d="M200 548L360 305Q316 330 280 308Q242 340 200 324Z" fill="${shade}" stroke="${line}" stroke-opacity=".4"/><path d="M200 548L360 305Q316 330 280 308Q242 340 200 324Z" fill="url(#bqFold${n})"/></g>
        ${ribbonSVG(cfg.ribbon, ribbon.color).replace(/#bqGing/g, `#bqGing${n}`)}
      </g>
    </svg>`;
  }

  window.Bouquet = { svg, flowerList, head: (kind, color) => HEADS[DRAW[kind] || "rose"](color || "#E58CA0") };
})();
