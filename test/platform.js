/* End-to-end tests of the envelope platform: creators, recipients, admin, and the walls between them.
   Starts the server on a spare port with a throwaway data folder (or MONGODB_URI, if set).
   Run:  node test/platform.js */
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const C = require("../public/js/catalog.js");

const PORT = 4000 + Math.floor(Math.random() * 900);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lw-platform-"));
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0, ipN = 1;

function ok(cond, name, extra) {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra !== undefined ? "  → " + JSON.stringify(extra).slice(0, 400) : "")); }
}
function client() {
  const c = { cookies: {}, ip: `10.0.0.${ipN++}` };
  c.req = async (method, url, { body, raw, type, csrf = true } = {}) => {
    const headers = { "X-Forwarded-For": c.ip };
    if (csrf) headers["X-LW"] = "1";
    const cookie = Object.entries(c.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) headers.Cookie = cookie;
    let payload;
    if (raw) { payload = raw; headers["Content-Type"] = type; }
    else if (body !== undefined) { payload = JSON.stringify(body); headers["Content-Type"] = "application/json"; }
    const r = await fetch(BASE + url, { method, headers, body: payload, redirect: "manual" });
    (r.headers.getSetCookie?.() || []).forEach((sc) => { const [kv] = sc.split(";"); const i = kv.indexOf("="); const v = kv.slice(i + 1); if (v) c.cookies[kv.slice(0, i)] = v; else delete c.cookies[kv.slice(0, i)]; });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, headers: r.headers };
  };
  return c;
}
const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000000200015e2c2ae00000000049454e44ae426082", "hex");
const RID = "a".repeat(32), RID2 = "b".repeat(32);

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "start-local.js")], { env: { ...process.env, PORT, DATA_DIR: DATA, ADMIN_SETUP_KEY: "test-setup-key" }, stdio: ["ignore", "pipe", "pipe"] });
  srv.stderr.on("data", (d) => process.stderr.write(d));
  await new Promise((res) => srv.stdout.on("data", (d) => String(d).includes("running") && res()));
  const anon = client(), asha = client(), ben = client(), admin = client(), recipient = client();

  try {
    console.log("\nContent engine");
    let n = 0;
    for (const rel of C.relationshipIds) for (const intent of C.INTENTS[rel]) {
      const b = C.build(rel, intent.id, { recipientName: "A", fromName: "B" }); n++;
      if (!b.opening.message || !b.finale.letter || !b.questions.length || !b.compliments.length) ok(false, `content for ${rel}/${intent.id}`);
    }
    ok(n === 27, `every relationship + intent builds a complete experience (${n})`);
    const p1 = C.build("partner", "propose"), p2 = C.build("partner", "love"), m1 = C.build("mom", "thanks");
    ok(p1.questions.some((q) => q.q === C.BANKS.proposal[0]) && !p2.questions.some((q) => q.q === C.BANKS.proposal[0]), "proposal intent uses proposal questions; love intent doesn't");
    ok(m1.questions.every((q) => q.type === "choice" || C.BANKS.mom.includes(q.q)), "mom gets mom's questions only");
    ok(p1.sections.some((s) => s.id === "proposal" && s.on) && !p2.sections.some((s) => s.id === "proposal"), "only the propose intent has a proposal section");
    ok(C.fill("{They} loves {their} {name}", { gender: "female", recipientName: "Anu" }) === "She loves her Anu" && C.fill("{They}", { gender: "male" }) === "He" && C.fill("{them}", { gender: "unspecified" }) === "them", "pronouns follow the chosen wording");
    const f = C.build("bestie", "chaos", { gender: "female" }), mm = C.build("bestie", "chaos", { gender: "male" });
    ok(JSON.stringify({ ...f, gender: 0 }) === JSON.stringify({ ...mm, gender: 0 }), "gender changes pronouns only, never the content");
    ok(C.BANKS.bestie.length === 15 && C.BANKS.romantic.length === 10 && C.BANKS.proposal.length === 8 && C.BANKS.friend.length === 8 && C.BANKS.mom.length === 10 && C.BANKS.dad.length === 10, "question banks are complete");

    console.log("\nPublic pages and watermark");
    let r = await anon.req("GET", "/");
    ok(r.status === 200 && r.text.includes("The site is developed by Sameer ♡"), "landing page, with watermark");
    r = await anon.req("GET", "/create");
    ok(r.status === 200 && r.text.includes("The site is developed by Sameer ♡"), "/create with watermark");
    r = await anon.req("GET", "/admin");
    ok(r.status === 200 && !r.text.includes("Sameer") && r.text.includes("adminLogin") && !r.text.includes("panel.js"), "/admin shows only a login: no watermark, no dashboard code");
    r = await anon.req("GET", "/studio");
    ok(r.status === 302 && r.headers.get("location").startsWith("/create"), "/studio sends visitors to /create");
    r = await anon.req("GET", "/studio/experiences");
    ok(r.status === 302, "/studio/experiences needs an account");
    for (const a of ["/js/catalog.js", "/js/bouquet.js", "/js/envelope.js", "/js/studio.js", "/js/studio-editor.js", "/js/panel.js", "/js/site.js", "/js/auth.js", "/js/ui.js", "/css/site.css", "/css/studio.css", "/css/envelope.css", "/css/panel.css", "/css/bouquet.css", "/img/og-partner.png", "/img/og-bestie.png", "/img/og-friend.png", "/img/og-mom.png", "/img/og-dad.png"]) {
      r = await anon.req("GET", a); if (r.status !== 200) ok(false, `asset ${a}`, r.status);
    }
    ok(true, "all new assets are served");

    console.log("\nCreator accounts");
    r = await asha.req("POST", "/api/account/register", { body: { name: "", email: "a@b.co", password: "long enough pw" } });
    ok(r.status === 400, "name required");
    r = await asha.req("POST", "/api/account/register", { body: { name: "Asha", email: "nonsense", password: "long enough pw" } });
    ok(r.status === 400, "bad email refused");
    r = await asha.req("POST", "/api/account/register", { body: { name: "Asha", email: "asha@example.com", password: "short" } });
    ok(r.status === 400, "short password refused");
    r = await asha.req("POST", "/api/account/register", { body: { name: "Asha", email: "Asha@Example.com", password: "asha password 1" }, csrf: false });
    ok(r.status === 403, "register without the custom header is refused (CSRF)");
    r = await asha.req("POST", "/api/account/register", { body: { name: "Asha", email: "Asha@Example.com", password: "asha password 1" } });
    ok(r.status === 201 && r.json.user.email === "asha@example.com" && !r.json.user.hash && !r.json.user.salt, "register works; password data never returned", r.json);
    ok(asha.cookies.lw_user, "session cookie set");
    r = await ben.req("POST", "/api/account/register", { body: { name: "Copy", email: "asha@example.com", password: "another password" } });
    ok(r.status === 409, "duplicate email refused");
    r = await ben.req("POST", "/api/account/register", { body: { name: "Ben", email: "ben@example.com", password: "ben password 12" } });
    ok(r.status === 201, "second creator registered");
    const outsider = client();
    r = await outsider.req("POST", "/api/account/login", { body: { email: "ben@example.com", password: "wrong wrong" } });
    ok(r.status === 401, "wrong password refused");
    r = await outsider.req("POST", "/api/account/login", { body: { email: "ben@example.com", password: "ben password 12" } });
    ok(r.status === 200 && outsider.cookies.lw_user, "login works");
    await outsider.req("POST", "/api/account/logout", { body: {} });
    r = await outsider.req("GET", "/api/studio/envelopes");
    ok(r.status === 401, "logout ends the session");

    console.log("\nCreating envelopes");
    r = await asha.req("POST", "/api/studio/envelopes", { body: { relationship: "nonsense", intent: "propose", recipientName: "Raj" } });
    ok(r.status === 400, "unknown relationship refused");
    r = await asha.req("POST", "/api/studio/envelopes", { body: { relationship: "mom", intent: "propose", recipientName: "Raj" } });
    ok(r.status === 400, "an intent from another relationship is refused");
    r = await asha.req("POST", "/api/studio/envelopes", { body: { relationship: "partner", intent: "propose", recipientName: "  ", gender: "male" } });
    ok(r.status === 400, "recipient name required");
    r = await asha.req("POST", "/api/studio/envelopes", { body: { relationship: "partner", intent: "propose", recipientName: "Raj", gender: "male", proposalMode: "gentle" } });
    ok(r.status === 201 && r.json.status === "draft", "draft created", r.json);
    const env = r.json;
    ok(/^[a-z2-7]{20}$/.test(env.slug) && !env.slug.includes("raj"), "link is random and doesn't contain the name");
    ok(env.fromName === "Asha" && env.gender === "male" && env.proposalMode === "gentle", "defaults come from the wizard");
    ok(env.proposal.question.includes("keep choosing you"), "gentle proposal wording used instead of direct");
    ok(env.ownerId && JSON.stringify(env).indexOf("hash") === -1, "no credentials in the response");

    r = await anon.req("GET", `/api/e/${env.slug}`);
    ok(r.status === 404, "a draft isn't visible to the public");
    r = await anon.req("GET", `/envelope/${env.slug}`);
    ok(r.status === 404 && !r.text.includes("Raj"), "a draft's page doesn't leak the name");

    console.log("\nEditing and validation");
    const edit = JSON.parse(JSON.stringify(env));
    edit.opening.message = "x".repeat(9000);
    edit.compliments = ["good", 7, "", "<img src=x onerror=alert(1)>"];
    edit.sections = [{ id: "letters", on: true }, { id: "hack", on: true }, { id: "letters", on: false }, { id: "opening", on: true }];
    edit.bouquet = { kind: "evil", color: "red;background:url(x)", wrap: "kraft", ribbon: "gold", count: 999, anim: "rain", note: "n", messages: ["a", "b"] };
    edit.ownerId = "stolen"; edit.status = "published"; edit.slug = "hijack"; edit.visits = 9999; edit.adminDisabled = true;
    edit.questions = [...env.questions.slice(0, 2), { id: "../x", q: "Mine?", type: "choice", options: ["only one"] }, { q: "" }];
    edit.gallery.layout = "wall";
    r = await asha.req("PUT", `/api/studio/envelopes/${env.id}`, { body: edit });
    const up = r.json;
    ok(r.status === 200, "update accepted", r.json);
    ok(up.opening.message.length === 2000, "overlong text is cut");
    ok(up.compliments.length === 2, "non-text and blanks removed");
    ok(up.sections[0].id === "letters" && up.sections[0].on && up.sections[1].id === "opening" && !up.sections.some((s) => s.id === "hack") && up.sections.some((s) => s.id === "finale"), "sections: order kept, unknown dropped, missing re-added");
    ok(up.bouquet.kind === env.bouquet.kind && up.bouquet.color === env.bouquet.color && up.bouquet.count === 12 && up.bouquet.ribbon === "gold", "bouquet values validated");
    ok(up.ownerId === env.ownerId && up.status === "draft" && up.slug === env.slug && !up.visits && !up.adminDisabled, "protected fields can't be set from an edit");
    ok(up.questions.length === 3 && up.questions[2].type === "text" && up.questions[2].id !== "../x", "questions validated");
    ok(up.gallery.layout === "wall", "photo layout saved");
    edit.sections = env.sections; edit.questions = env.questions; edit.compliments = env.compliments; edit.opening = env.opening; edit.bouquet = env.bouquet;
    r = await asha.req("PUT", `/api/studio/envelopes/${env.id}`, { body: edit });
    ok(r.json.questions.length === env.questions.length, "restored");

    console.log("\nPhotos");
    r = await asha.req("POST", `/api/studio/envelopes/${env.id}/photos`, { raw: Buffer.from("<?php echo 1; ?>"), type: "image/png" });
    ok(r.status === 415, "non-image refused by file signature");
    r = await anon.req("POST", `/api/studio/envelopes/${env.id}/photos`, { raw: png, type: "image/png" });
    ok(r.status === 401, "upload needs an account");
    r = await ben.req("POST", `/api/studio/envelopes/${env.id}/photos`, { raw: png, type: "image/png" });
    ok(r.status === 404, "can't upload to another creator's envelope");
    r = await asha.req("POST", `/api/studio/envelopes/${env.id}/photos`, { raw: png, type: "image/png" });
    ok(r.status === 201 && r.json.coverId === r.json.photo.id, "photo stored; first becomes the cover", r.json);
    const ph1 = r.json.photo;
    r = await asha.req("POST", `/api/studio/envelopes/${env.id}/photos`, { raw: png, type: "image/png" });
    const ph2 = r.json.photo;
    r = await asha.req("GET", ph1.url);
    ok(r.status === 200 && r.headers.get("content-type") === "image/png", "owner can see a draft's photo");
    r = await anon.req("GET", ph1.url);
    ok(r.status === 404, "the public can't see a draft's photo");
    r = await ben.req("GET", ph1.url);
    ok(r.status === 404, "another creator can't see a draft's photo");
    r = await anon.req("GET", "/media/../db.json");
    ok(r.status === 404, "path traversal blocked");
    let cur = (await asha.req("GET", `/api/studio/envelopes/${env.id}`)).json;
    cur.gallery.photos = [{ ...cur.gallery.photos[1], caption: "second first", interlude: true }, { ...cur.gallery.photos[0], caption: "the sea" }, { id: "fake", file: "../../x.png", caption: "bad" }];
    cur.gallery.coverId = ph2.id;
    cur.letters[0].photoId = ph1.id;
    cur.letters[1].photoId = "doesnotexist";
    r = await asha.req("PUT", `/api/studio/envelopes/${env.id}`, { body: cur });
    ok(r.json.gallery.photos.length === 2 && r.json.gallery.photos[0].id === ph2.id && r.json.gallery.photos[0].caption === "second first" && r.json.gallery.photos[0].interlude === true, "reorder, captions and interludes saved; unknown photo ignored");
    ok(r.json.gallery.photos.every((p) => !p.file.includes("..")), "photo file names can't be changed");
    ok(r.json.gallery.coverId === ph2.id && r.json.letters[0].photoId === ph1.id && r.json.letters[1].photoId === "", "cover and letter photos must belong to this envelope");
    const stale = { ...r.json, gallery: { ...r.json.gallery, photos: [r.json.gallery.photos[0]] } };
    r = await asha.req("PUT", `/api/studio/envelopes/${env.id}`, { body: stale });
    ok(r.json.gallery.photos.length === 2, "a stale autosave can't lose a photo");

    console.log("\nPublishing and the recipient's link");
    r = await ben.req("POST", `/api/studio/envelopes/${env.id}/publish`, { body: {} });
    ok(r.status === 404, "can't publish someone else's envelope");
    r = await asha.req("POST", `/api/studio/envelopes/${env.id}/publish`, { body: {} });
    ok(r.status === 200 && r.json.linkStatus === "published", "published");
    r = await anon.req("GET", `/envelope/${env.slug}`);
    ok(r.status === 200 && r.text.includes('property="og:title" content="Raj, Asha made this for you"') && r.text.includes("og:image") && r.text.includes("/img/og-partner.png"), "link preview has their name and an image", r.text.slice(0, 900));
    ok(r.text.includes("The site is developed by Sameer ♡") && r.text.includes('data-theme="partner"'), "recipient page: watermark and theme");
    ok(!r.text.includes("/studio") && !r.text.includes("/admin") && !r.text.includes(env.id), "recipient page has no studio or admin links, nor the private id");
    r = await recipient.req("GET", `/api/e/${env.slug}`);
    const pub = r.json;
    ok(r.status === 200 && pub.recipientName === "Raj", "recipient loads it without logging in");
    ok(!("ownerId" in pub) && !("id" in pub) && !("visits" in pub) && !JSON.stringify(pub).includes("asha@example.com"), "public view hides owner, id, email and stats");
    r = await recipient.req("GET", pub.gallery.photos[0].url);
    ok(r.status === 200, "published photos load for the recipient");
    r = await recipient.req("POST", `/api/e/${env.slug}/seen`, { body: {} });
    r = await recipient.req("POST", `/api/e/${env.slug}/seen`, { body: {} });
    ok(r.status === 200, "visit counted");
    r = await recipient.req("PUT", `/api/e/${env.slug}`, { body: { recipientName: "pwned" } });
    ok(r.status === 405, "recipient can't edit it");
    r = await recipient.req("GET", `/api/studio/envelopes/${env.id}`);
    ok(r.status === 401, "recipient can't reach the studio API");
    r = await recipient.req("GET", `/api/control/overview`);
    ok(r.status === 401, "recipient can't reach the admin API");

    console.log("\nAnswers and consent");
    const q0 = pub.questions[0], choice = pub.questions.find((q) => q.type === "choice");
    r = await recipient.req("POST", `/api/e/${env.slug}/answers`, { body: { rid: RID, answers: { [q0.id]: "without consent" } } });
    ok(r.status === 403, "nothing is saved before they've agreed to share");
    r = await recipient.req("POST", `/api/e/${env.slug}/progress`, { body: { rid: RID } });
    ok(r.json.progress === null, "confirmed: nothing stored");
    r = await recipient.req("POST", `/api/e/${env.slug}/answers`, { body: { rid: "../../etc", consent: true, answers: {} } });
    ok(r.status === 400, "bad recipient id refused");
    r = await recipient.req("POST", `/api/e/${env.slug}/answers`, { body: { rid: RID, consent: true, answers: { [q0.id]: "my honest answer", nope: "x", [choice.id]: "not an option" }, index: 1 } });
    ok(r.status === 200, "autosave accepted");
    r = await recipient.req("POST", `/api/e/${env.slug}/progress`, { body: { rid: RID } });
    ok(r.json.progress.answers[q0.id] === "my honest answer" && !("nope" in r.json.progress.answers) && !(choice.id in r.json.progress.answers) && r.json.progress.index === 1, "progress resumes; unknown questions and invalid choices dropped");
    const other = client();
    r = await other.req("POST", `/api/e/${env.slug}/progress`, { body: { rid: RID2 } });
    ok(r.json.progress === null, "someone else opening the same link can't see these answers");
    r = await recipient.req("POST", `/api/e/${env.slug}/answers`, { body: { rid: RID, consent: true, answers: { [choice.id]: choice.options[1] }, index: 3, submit: true } });
    ok(r.json.submittedAt, "questionnaire completed");
    r = await recipient.req("POST", `/api/e/${env.slug}/quiz`, { body: { rid: RID, consent: true, result: "hack" } });
    ok(r.status === 400, "unknown quiz result refused, or quiz off");
    r = await recipient.req("POST", `/api/e/${env.slug}/proposal`, { body: { rid: RID, consent: true, choice: "forced" } });
    ok(r.status === 400, "unknown proposal choice refused");
    r = await recipient.req("POST", `/api/e/${env.slug}/proposal`, { body: { rid: RID, consent: true, choice: "time" } });
    ok(r.status === 200, "'I need a little time' is a valid reply");
    r = await recipient.req("POST", `/api/e/${env.slug}/feedback`, { body: { rid: RID, consent: true, text: "this made me cry" } });
    ok(r.status === 200, "feedback saved");

    console.log("\nThe creator sees responses; nobody else does");
    r = await asha.req("GET", `/api/studio/envelopes/${env.id}/responses`);
    const view = r.json[0];
    ok(r.status === 200 && view.complete && view.answers.some((a) => a.answer === "my honest answer" && a.question === q0.q), "creator reads question + answer", r.json);
    ok(view.proposal.choice === "time" && view.proposal.label === "Let me think about it" && view.feedback.text === "this made me cry", "proposal reply and feedback included");
    r = await asha.req("GET", "/api/studio/responses");
    ok(r.json.length === 1 && r.json[0].recipientName === "Raj", "'Their little responses' list");
    r = await asha.req("GET", "/api/studio/envelopes");
    ok(r.json[0].visits === 2 && r.json[0].responses === 1 && r.json[0].completed === 1 && r.json[0].photos === 2, "dashboard counters correct", r.json[0]);
    r = await asha.req("GET", `/api/studio/envelopes/${env.id}/export?format=csv`);
    ok(r.headers.get("content-type").startsWith("text/csv") && r.text.includes("my honest answer") && r.text.includes("this made me cry"), "CSV export");
    r = await asha.req("GET", `/api/studio/envelopes/${env.id}/export?format=json`);
    ok(JSON.parse(r.text).responses.length === 1, "JSON export");

    console.log("\nData isolation between creators");
    for (const [method, url, opts] of [["GET", `/api/studio/envelopes/${env.id}`], ["PUT", `/api/studio/envelopes/${env.id}`, { body: {} }], ["DELETE", `/api/studio/envelopes/${env.id}`], ["GET", `/api/studio/envelopes/${env.id}/responses`], ["GET", `/api/studio/envelopes/${env.id}/export`], ["GET", `/api/studio/envelopes/${env.id}/preview`], ["POST", `/api/studio/envelopes/${env.id}/link`, { body: { disabled: true } }], ["POST", `/api/studio/envelopes/${env.id}/restyle`, { body: { relationship: "mom", intent: "thanks" } }], ["DELETE", `/api/studio/envelopes/${env.id}/photos/${ph1.id}`]]) {
      r = await ben.req(method, url, opts);
      if (r.status !== 404) ok(false, `${method} ${url} must be 404 for another creator`, r.status);
    }
    ok(true, "every route on another creator's envelope answers 404");
    r = await ben.req("GET", "/api/studio/envelopes");
    ok(r.json.length === 0, "Ben sees no envelopes of Asha's");
    r = await ben.req("GET", "/api/studio/responses");
    ok(r.json.length === 0, "Ben sees no responses of Asha's");
    r = await ben.req("GET", `/studio/preview/${env.id}`);
    ok(r.status === 404, "Ben can't open Asha's preview page");
    r = await ben.req("GET", "/api/control/overview");
    ok(r.status === 401, "a creator's login doesn't open the admin API");
    r = await ben.req("GET", "/admin");
    ok(r.text.includes("adminLogin"), "a creator's login doesn't open the admin page");

    console.log("\nLink controls");
    r = await asha.req("POST", `/api/studio/envelopes/${env.id}/link`, { body: { disabled: true } });
    ok(r.json.linkStatus === "disabled", "creator disables the link");
    r = await anon.req("GET", `/api/e/${env.slug}`);
    ok(r.status === 404, "disabled link stops working");
    r = await anon.req("GET", `/envelope/${env.slug}`);
    ok(r.status === 404 && !r.text.includes("Raj"), "disabled link's preview shows no name");
    r = await anon.req("GET", ph1.url);
    ok(r.status === 404, "disabled link's photos are private again");
    r = await asha.req("POST", `/api/studio/envelopes/${env.id}/link`, { body: { disabled: false, expiresAt: new Date(Date.now() - 1000).toISOString() } });
    ok(r.json.linkStatus === "expired", "expiry date in the past");
    r = await anon.req("GET", `/api/e/${env.slug}`);
    ok(r.status === 404, "expired link stops working");
    r = await asha.req("POST", `/api/studio/envelopes/${env.id}/link`, { body: { expiresAt: new Date(Date.now() + 864e5).toISOString() } });
    ok(r.json.linkStatus === "published", "expiry in the future keeps it open");
    r = await asha.req("POST", `/api/studio/envelopes/${env.id}/link`, { body: { expiresAt: "not a date" } });
    ok(r.status === 400, "bad date refused");
    r = await asha.req("POST", `/api/studio/envelopes/${env.id}/link`, { body: { expiresAt: null } });
    ok(r.json.linkStatus === "published", "expiry can be removed");

    console.log("\nAdmin");
    if (process.env.MONGODB_URI) {
      r = await anon.req("POST", "/api/auth/setup", { body: { password: "stranger password", setupKey: "wrong" } });
      ok(r.status === 403, "online, a stranger can't claim a brand-new admin panel without the setup key");
    }
    r = await admin.req("POST", "/api/auth/setup", { body: { password: "admin password 1", setupKey: "test-setup-key" } });
    ok(r.status === 200 && admin.cookies.lw_session, "admin password set");
    r = await anon.req("GET", "/api/control/users");
    ok(r.status === 401, "no admin API without the admin session");
    const fake = client(); fake.cookies.lw_session = asha.cookies.lw_user;
    r = await fake.req("GET", "/api/control/users");
    ok(r.status === 401, "a creator's token doesn't work as an admin session");
    r = await admin.req("GET", "/admin");
    ok(r.text.includes("panel.js") && !r.text.includes("Sameer"), "admin dashboard loads; no watermark");
    r = await admin.req("GET", "/api/control/overview");
    const t = r.json.totals;
    ok(t.creators === 2 && t.envelopes === 1 && t.opened === 2 && t.completed === 1 && t.answers === 2 && t.photos === 2, "overview totals", t);
    ok(r.json.relationships[0].label === "My Partner" && r.json.experiences[0].label === "I want to propose" && r.json.recentEnvelopes.length === 1 && r.json.recentCreators.length === 2, "popular categories and recent activity");
    r = await admin.req("GET", "/api/control/users?q=asha");
    ok(r.json.total === 1 && r.json.items[0].email === "asha@example.com" && !r.json.items[0].hash && r.json.items[0].envelopes === 1, "search creators; no password data");
    const ashaId = r.json.items[0].id;
    r = await admin.req("GET", `/api/control/users/${ashaId}`);
    ok(r.json.envelopesList.length === 1, "individual creator's details");
    r = await admin.req("GET", "/api/control/envelopes?relationship=partner&q=raj");
    const row = r.json.items[0];
    ok(row.creatorName === "Asha" && row.recipientName === "Raj" && row.relationshipLabel === "My Partner" && row.gender === "male" && row.url.includes(env.slug) && row.visits === 2 && row.completed === 1 && row.photos === 2 && row.status === "published", "envelope list has every required column", row);
    r = await admin.req("GET", "/api/control/envelopes?relationship=dad");
    ok(r.json.total === 0, "filter envelopes");
    r = await admin.req("GET", `/api/control/envelopes/${env.id}`);
    ok(r.json.config.opening && r.json.responses[0].answers.length === 2 && r.json.creator.email === "asha@example.com", "configuration, answers and creator info");
    r = await admin.req("GET", `/admin/preview/${env.id}`);
    ok(r.status === 200, "admin can preview");
    r = await admin.req("GET", `/api/control/responses?q=${encodeURIComponent("honest")}`);
    ok(r.json.total === 1 && r.json.items[0].creatorEmail === "asha@example.com" && r.json.items[0].recipientName === "Raj", "search responses, each tied to creator and envelope");
    r = await admin.req("GET", "/api/control/analytics");
    ok(r.json.series.length === 30 && r.json.series[29].visits >= 2 && r.json.funnel.completed === 1, "analytics");
    for (const k of ["users", "envelopes", "responses"]) {
      r = await admin.req("GET", `/api/control/export/${k}`);
      ok(r.status === 200 && r.headers.get("content-type").startsWith("text/csv"), `export ${k} to CSV`);
    }
    r = await anon.req("GET", "/api/control/export/users");
    ok(r.status === 401, "export needs admin");
    await recipient.req("POST", `/api/e/${env.slug}/feedback`, { body: { rid: RID, consent: true, text: "=HYPERLINK(\"http://evil\")" } });
    r = await asha.req("GET", `/api/studio/envelopes/${env.id}/export?format=csv`);
    ok(r.text.includes(`"'=HYPERLINK`), "spreadsheet formulas in answers are neutralised");

    r = await admin.req("PATCH", `/api/control/envelopes/${env.id}`, { body: { adminDisabled: true } });
    r = await anon.req("GET", `/api/e/${env.slug}`);
    ok(r.status === 404, "admin takes a link down");
    r = await asha.req("POST", `/api/studio/envelopes/${env.id}/publish`, { body: {} });
    ok(r.status === 403, "creator can't republish what the admin took down");
    await admin.req("PATCH", `/api/control/envelopes/${env.id}`, { body: { adminDisabled: false } });
    r = await anon.req("GET", `/api/e/${env.slug}`);
    ok(r.status === 200, "admin restores it");

    r = await admin.req("PATCH", `/api/control/users/${ashaId}`, { body: { suspended: true } });
    r = await asha.req("GET", "/api/studio/envelopes");
    ok(r.status === 401, "suspending a creator ends their access");
    r = await anon.req("GET", `/api/e/${env.slug}`);
    ok(r.status === 404, "a suspended creator's links stop working");
    const again = client();
    r = await again.req("POST", "/api/account/login", { body: { email: "asha@example.com", password: "asha password 1" } });
    ok(r.status === 403, "a suspended creator can't log back in");
    await admin.req("PATCH", `/api/control/users/${ashaId}`, { body: { suspended: false } });
    r = await asha.req("POST", "/api/account/login", { body: { email: "asha@example.com", password: "asha password 1" } });
    ok(r.status === 200, "reactivated creator can log in");

    console.log("\nPassword reset");
    r = await anon.req("POST", `/api/control/users/${ashaId}/reset-link`, { body: {} });
    ok(r.status === 401, "only admin can make a reset link");
    r = await admin.req("POST", `/api/control/users/${ashaId}/reset-link`, { body: {} });
    const token = r.json.path.split("reset=")[1];
    r = await again.req("POST", "/api/account/reset", { body: { token: "f".repeat(64), password: "new password 123" } });
    ok(r.status === 400, "made-up reset token refused");
    r = await again.req("POST", "/api/account/reset", { body: { token, password: "new password 123" } });
    ok(r.status === 200, "reset works");
    r = await again.req("POST", "/api/account/reset", { body: { token, password: "another new pass" } });
    ok(r.status === 400, "reset link works only once");
    r = await asha.req("GET", "/api/studio/envelopes");
    ok(r.status === 401, "reset logs out old sessions");
    r = await asha.req("POST", "/api/account/login", { body: { email: "asha@example.com", password: "new password 123" } });
    ok(r.status === 200, "new password works");

    console.log("\nErasing and deleting");
    await recipient.req("POST", `/api/e/${env.slug}/erase`, { body: { rid: RID } });
    r = await asha.req("GET", `/api/studio/envelopes/${env.id}/responses`);
    ok(r.json.length === 0, "recipient can erase their own replies");
    r = await asha.req("POST", "/api/studio/envelopes", { body: { relationship: "dad", intent: "thanks", recipientName: "Papa" } });
    const env2 = r.json;
    r = await admin.req("DELETE", `/api/control/envelopes/${env2.id}`);
    r = await asha.req("GET", `/api/studio/envelopes/${env2.id}`);
    ok(r.status === 404, "admin can delete an unwanted envelope");
    r = await asha.req("POST", "/api/account/delete", { body: { password: "wrong one here" } });
    ok(r.status === 401, "deleting an account needs its password");
    r = await asha.req("POST", "/api/account/delete", { body: { password: "new password 123" } });
    ok(r.status === 200, "creator deletes own account");
    r = await anon.req("GET", `/api/e/${env.slug}`);
    ok(r.status === 404, "their envelopes go too");
    r = await admin.req("GET", "/api/control/overview");
    ok(r.json.totals.creators === 1 && r.json.totals.envelopes === 0 && r.json.totals.photos === 0, "nothing left behind");
    r = await admin.req("DELETE", `/api/control/users/${(await admin.req("GET", "/api/control/users")).json.items[0].id}`);
    r = await ben.req("GET", "/api/studio/envelopes");
    ok(r.status === 401, "admin can delete an account");

    console.log("\nOriginal worlds still work");
    r = await admin.req("GET", "/admin/worlds");
    ok(r.status === 200 && r.text.includes("A Little World"), "the original studio is still there");
    r = await admin.req("POST", "/api/experiences", { body: { name: "Anjali", from: "Sameer" } });
    const world = r.json;
    ok(r.status === 201, "can still create an original world");
    r = await anon.req("GET", `/surprise/${world.slug}`);
    ok(r.status === 200 && r.text.includes("The site is developed by Sameer ♡"), "/surprise links still work, with the new watermark");
    r = await anon.req("GET", `/api/x/${world.slug}`);
    ok(r.status === 200, "original API still works");
    r = await admin.req("GET", "/api/control/envelopes?q=anjali");
    ok(r.json.total === 1 && r.json.items[0].kind === "legacy", "original worlds appear in the admin envelope list");
    await anon.req("POST", `/api/x/${world.slug}/answers`, { csrf: true, body: { answers: { q1: "legacy answer" }, submit: true } });
    r = await admin.req("GET", "/api/control/responses?q=legacy%20answer");
    ok(r.json.total === 1, "original worlds' answers appear in admin responses");
    r = await admin.req("PATCH", `/api/control/envelopes/${world.id}`, { body: { adminDisabled: true } });
    r = await anon.req("GET", `/api/x/${world.slug}`);
    ok(r.status === 404, "admin can disable an original world");
    r = await admin.req("GET", `/api/experiences/${world.id}`);
    ok(r.status === 200 && r.json.name === "Anjali", "it isn't lost");

    if (!process.env.MONGODB_URI) ok(fs.existsSync(path.join(DATA, "db.json")) && JSON.parse(fs.readFileSync(path.join(DATA, "db.json"))).config.hash, "database persisted to disk");
  } catch (e) {
    failed++; console.error(e);
  } finally {
    srv.kill();
    fs.rmSync(DATA, { recursive: true, force: true });
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(failed ? 1 : 0);
  }
})();
