/* HTML shells for every page. Rendered on the server so that link previews (WhatsApp etc.) get real titles and images. */
"use strict";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CREDIT = "The site is developed by Sameer ♡";

const SITE_FONTS = "family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600&family=Caveat:wght@500;700";
const THEME_FONTS = {
  partner: "family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Caveat:wght@500",
  bestie: "family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Gochi+Hand",
  friend: "family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..600,100;1,9..144,300..600,100&family=Nunito:wght@400;600;700&family=Caveat:wght@500",
  mom: "family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&family=Lora:ital,wght@0,400;0,500;1,400&family=Caveat:wght@500",
  dad: "family=Libre+Caslon+Display&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@400;600&family=Caveat:wght@500",
};
const THEME_COLOR = { partner: "#2A0D18", bestie: "#FFE8A8", friend: "#EAF3E4", mom: "#FBE6D8", dad: "#16233A" };

function head({ title, description, fonts = SITE_FONTS, css = [], themeColor = "#FBF3E7", og, noindex }) {
  return `<!doctype html>
<html lang="en"${og?.theme ? ` data-theme="${esc(og.theme)}"` : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ""}
${noindex ? '<meta name="robots" content="noindex">' : ""}
<meta name="theme-color" content="${esc(themeColor)}">
${og?.title ? `<meta property="og:type" content="website">
<meta property="og:site_name" content="A Little World">
<meta property="og:title" content="${esc(og.title)}">
<meta property="og:description" content="${esc(description || "")}">
${og.url ? `<meta property="og:url" content="${esc(og.url)}">` : ""}
${og.image ? `<meta property="og:image" content="${esc(og.image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(og.image)}">` : ""}
<meta name="twitter:title" content="${esc(og.title)}">` : ""}
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${fonts}&display=swap" rel="stylesheet">
${css.map((c) => `<link rel="stylesheet" href="/css/${c}">`).join("\n")}
</head>`;
}
const scripts = (...names) => names.map((n) => `<script src="/js/${n}"></script>`).join("\n");
const footer = () => `<footer class="site-foot"><a href="/" class="foot-brand">A Little World</a><a href="/privacy">Privacy</a><p class="site-credit">${CREDIT}</p></footer>`;

function landing() {
  return `${head({
    title: "A Little World · Send someone a surprise they can open", description: "Create a personalised digital envelope with your own photos, letters, flowers and questions, then send it as a link.",
    css: ["site.css", "bouquet.css"], og: { title: "A Little World · Send someone a surprise they can open" },
  })}
<body class="site landing">
<header class="top"><a class="brand" href="/">A Little World</a><nav><a href="#how">How it works</a><a href="/create" class="top-cta">Start making</a></nav></header>
<main>
  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">Personal, digital envelopes</p>
      <h1>Some things are too <em>important</em> for a text message.</h1>
      <p class="lede">Make someone a little world of your own photos, letters and flowers. Send it as a link. They open an envelope, and everything you wanted to say is inside.</p>
      <div class="hero-actions"><a class="btn primary" href="/create">Make an envelope</a><a class="btn quiet" href="#rooms">See how they look</a></div>
    </div>
    <div class="hero-art" id="heroArt" aria-hidden="true"></div>
  </section>

  <section class="rooms" id="rooms">
    <header class="sec-title"><p class="eyebrow">Five kinds of love</p><h2>It shouldn't feel the same for your mom and your best friend.</h2></header>
    <div id="roomList" class="room-list"></div>
  </section>

  <section class="how" id="how">
    <header class="sec-title"><p class="eyebrow">How it works</p><h2>Three evenings' worth of thought, in about ten minutes.</h2></header>
    <ol class="how-list">
      <li><span class="how-n">1</span><h3>Choose who it's for</h3><p>Pick the person and what you want to say. We write a first draft in the right voice.</p></li>
      <li><span class="how-n">2</span><h3>Make it yours</h3><p>Add your photographs, change any word, arrange their bouquet, and choose what to ask them.</p></li>
      <li><span class="how-n">3</span><h3>Send the link</h3><p>Share it on WhatsApp. When they reply, you'll find it in your studio, and nowhere public.</p></li>
    </ol>
  </section>

  <section class="closer"><h2>Who's on your mind right now?</h2><a class="btn primary" href="/create">Make them something</a></section>
</main>
${footer()}
${scripts("flowers.js", "catalog.js", "bouquet.js", "site.js")}
</body></html>`;
}

function create() {
  return `${head({ title: "Create your envelope · A Little World", description: "Sign up and make your first envelope.", css: ["site.css"], noindex: true })}
<body class="site auth-page">
<header class="top"><a class="brand" href="/">A Little World</a></header>
<main class="auth">
  <div class="auth-art" id="authArt" aria-hidden="true"></div>
  <div class="auth-card" id="authCard"></div>
</main>
${footer()}
${scripts("flowers.js", "ui.js", "auth.js")}
</body></html>`;
}

function studio() {
  return `${head({ title: "Your studio · A Little World", css: ["site.css", "bouquet.css", "studio.css"], noindex: true })}
<body class="site studio-app">
<header class="top studio-top"><a class="brand" href="/studio">A Little World</a>
  <nav id="studioNav"><a href="/studio" data-nav>Home</a><a href="/studio/experiences" data-nav>My envelopes</a><a href="/studio/responses" data-nav>Their little responses</a><a href="/studio/account" data-nav>Account</a></nav>
</header>
<main id="app" class="studio-main"></main>
${footer()}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
${scripts("flowers.js", "catalog.js", "bouquet.js", "ui.js", "studio-editor.js", "studio.js")}
</body></html>`;
}

function admin() {
  return `${head({ title: "Control room · A Little World", css: ["panel.css"], fonts: "family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600", noindex: true })}
<body class="panel">
<aside class="panel-side">
  <a class="panel-brand" href="/admin">A Little World<span>Control room</span></a>
  <nav id="panelNav">
    <a href="/admin" data-nav>Overview</a><a href="/admin/users" data-nav>Creators</a><a href="/admin/envelopes" data-nav>Envelopes</a><a href="/admin/responses" data-nav>Responses</a><a href="/admin/analytics" data-nav>Analytics</a><a href="/admin/worlds">Original worlds</a>
  </nav>
  <button class="panel-logout" id="logoutBtn" type="button">Log out</button>
</aside>
<main id="panel" class="panel-main"></main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
${scripts("catalog.js", "ui.js", "panel.js")}
</body></html>`;
}

function adminLogin(needsSetup) {
  return `${head({ title: "Control room · A Little World", css: ["panel.css"], fonts: "family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600", noindex: true })}
<body class="panel panel-gate">
<form class="gate" id="adminLogin" data-setup="${needsSetup ? "1" : ""}">
  <h1>${needsSetup ? "Set up your control room" : "Control room"}</h1>
  <p>${needsSetup ? "Choose the password you'll use to manage the platform." : "This area is private."}</p>
  ${needsSetup ? '<label class="fld" id="setupKeyWrap"><span>Setup key (online only)</span><input id="adminKey" type="password" autocomplete="off"></label>' : ""}
  <label class="fld"><span>Password</span><input id="adminPw" type="password" required minlength="8" autocomplete="${needsSetup ? "new-password" : "current-password"}" autofocus></label>
  <p class="form-err" id="adminErr" role="alert"></p>
  <button class="btn-p" type="submit">${needsSetup ? "Create password" : "Enter"}</button>
</form>
${scripts("ui.js", "panel-login.js")}
</body></html>`;
}

function envelope({ theme, slug = "", previewApi = "", demo = "", closed = false, title, description, image, url, noindex }) {
  return `${head({
    title, description, fonts: THEME_FONTS[theme] || THEME_FONTS.friend, css: ["bouquet.css", "envelope.css"], themeColor: THEME_COLOR[theme], noindex,
    og: { title, image, url, theme },
  })}
<body class="env" data-slug="${esc(slug)}" data-preview="${esc(previewApi)}" data-demo="${esc(demo)}" data-closed="${closed ? "1" : ""}">
<canvas id="ambient" aria-hidden="true"></canvas>
<div class="orbs" aria-hidden="true"><i></i><i></i><i></i></div>
<div id="root" class="root"></div>
<p class="credit">${CREDIT}</p>
${scripts("flowers.js", "catalog.js", "bouquet.js", "envelope.js")}
</body></html>`;
}

function privacy() {
  return `${head({ title: "Privacy · A Little World", description: "How A Little World handles what you share.", css: ["site.css"] })}
<body class="site prose-page">
<header class="top"><a class="brand" href="/">A Little World</a></header>
<main class="prose">
  <h1>Privacy</h1>
  <p class="eyebrow">What happens to the things you share</p>
  <h2>If you make an envelope</h2>
  <p>We store your name, email address and a scrambled version of your password, along with the words and photographs you add. You can delete an envelope, or your entire account, from your studio at any time. That deletes its photographs and replies too.</p>
  <p>Please only upload photographs you have the right to share. An envelope can be opened by anyone who has its link, so treat that link like something private.</p>
  <h2>If someone sent you an envelope</h2>
  <p>We count visits to the envelope, without identifying who visited. Your answers, quiz result, reply and any message you write are saved only after you've been told they'll be shared, and they are visible to the person who made the envelope and to the site owner, who can review them to keep the platform safe. You can erase your replies from the end of the envelope on the same device.</p>
  <h2>Cookies</h2>
  <p>We use one essential cookie to keep creators logged in. There are no advertising or tracking cookies. Fonts are loaded from Google Fonts.</p>
  <h2>Contact</h2>
  <p>To ask about your data, or to report an envelope, contact the owner of this site.</p>
</main>
${footer()}
</body></html>`;
}

const unavailable = () => `${head({ title: "Back soon · A Little World", css: ["site.css"], noindex: true })}
<body class="site prose-page"><main class="prose"><h1>We'll be back very soon.</h1><p>The site can't reach its database at the moment. Please try again in a little while.</p></main>${footer()}</body></html>`;

module.exports = { landing, create, studio, admin, adminLogin, envelope, privacy, unavailable, CREDIT };
