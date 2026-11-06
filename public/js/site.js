/* Landing page: hero illustration and the five "rooms". */
(function () {
  const C = window.LW_CATALOG;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const art = document.getElementById("heroArt");
  if (art) {
    const stems = [["rose", 6, 8, 104, -16], ["daisy", 3, 24, 118, -6], ["tulip", 9, 40, 128, 3], ["poppy", 5, 56, 112, 11], ["sprig", 12, 70, 108, 20]];
    art.innerHTML = `<div class="ha-flowers">${stems.map(([f, seed, left, h, rot], i) => `<div class="ha-f" style="left:${left}%;height:${h}%;--r:${rot}deg;--i:${i}">${Flora.flower(f, { seed })}</div>`).join("")}</div>
      <div class="ha-env"><span class="ha-back"></span><span class="ha-paper">For you</span><span class="ha-front"></span><span class="ha-seal">♡</span></div>`;
  }

  const ROOMS = { partner: "Candlelit", bestie: "Unhinged", friend: "Fresh air", mom: "Unhurried", dad: "Understated" };
  const list = document.getElementById("roomList");
  if (list) {
    list.innerHTML = C.relationshipIds.map((id) => {
      const r = C.RELATIONSHIPS[id];
      return `<article class="room room-${id}">
        <div class="room-art" aria-hidden="true">${Bouquet.svg(C.build(id, C.INTENTS[id][0].id).bouquet)}</div>
        <div class="room-copy">
          <p class="room-word">${ROOMS[id]}</p>
          <h3>${esc(r.label.replace("My ", "For my "))}</h3>
          <p class="room-line">${esc(r.line)}</p>
          <ul>${C.INTENTS[id].slice(0, 3).map((x) => `<li>${esc(x.label)}</li>`).join("")}</ul>
          <a class="room-link" href="/demo/${id}">Open a sample envelope</a>
        </div>
      </article>`;
    }).join("");
  }
})();
