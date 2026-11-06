/* The envelope platform: three separate experiences behind one server.
     Creators  /api/account/*, /api/studio/*   only ever see records they own
     Admin     /api/control/*                  requires the admin session (the studio password)
     Recipient /api/e/:slug/*                  published content + their own response only
   Everything is validated and authorised here on the server. */
"use strict";
const crypto = require("crypto");
const { promisify } = require("util");
const C = require("../public/js/catalog.js");
const pages = require("./pages.js");
const scrypt = promisify(crypto.scrypt);

const USER_MS = 30 * 24 * 3600 * 1000;
const RESET_MS = 24 * 3600 * 1000;
const MAX_PHOTOS = 40, MAX_ENVELOPES = 100, MAX_RESPONSES = 100;
const PAGE = 50;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@.]{2,}$/;
const SLUG_RE = /^[a-z2-7]{20}$/;
const ID_RE = /^[a-z0-9]{12}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const AMBIENCE = ["fireflies", "petals", "confetti", "pollen", "stars"];
const REPLY_CHOICES = ["yes", "time", "talk"];
const nowISO = () => new Date().toISOString();
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const newId = () => crypto.randomBytes(9).toString("hex").slice(0, 12);
const newSlug = () => { const a = "abcdefghijklmnopqrstuvwxyz234567"; const b = crypto.randomBytes(20); let s = ""; for (let i = 0; i < 20; i++) s += a[b[i] & 31]; return s; };

module.exports = function createPlatform(h) {
  const { json, fail, readJSON, readBody, parseCookies, sha, ip, str, arr, imageExt, csvCell, MIME, notFound, isAdmin, PHOTO_LIMIT, sendFile, legacyAdminFile, store: storeOf } = h;
  const store = () => storeOf();

  /* ---------------------------------------------------- passwords & sessions */
  async function hashPw(pw) {
    const salt = crypto.randomBytes(16).toString("hex");
    return { salt, hash: (await scrypt(pw, salt, 64)).toString("hex") };
  }
  async function checkPw(user, pw) {
    const salt = user?.salt || "0000000000000000", real = user?.hash;
    const got = await scrypt(String(pw ?? ""), salt, 64); // same work whether or not the account exists
    if (!real) return false;
    const a = Buffer.from(real, "hex");
    return a.length === got.length && crypto.timingSafeEqual(a, got);
  }
  const secureFlag = (req) => (req.headers["x-forwarded-proto"] === "https" || req.socket?.encrypted ? "; Secure" : "");
  async function startUserSession(req, res, userId) {
    const token = crypto.randomBytes(32).toString("hex");
    await store().docPut("usessions", sha(token), { userId, exp: Date.now() + USER_MS });
    res.setHeader("Set-Cookie", `lw_user=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${USER_MS / 1000}${secureFlag(req)}`);
  }
  async function currentUser(req) {
    const t = parseCookies(req).lw_user;
    if (!t || !/^[a-f0-9]{64}$/.test(t)) return null;
    const s = await store().docGet("usessions", sha(t));
    if (!s || s.exp < Date.now()) return null;
    const u = await store().docGet("users", s.userId);
    return u && !u.suspended ? u : null;
  }
  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });

  /* ---------------------------------------------------- envelope validation */
  const list = (v, max, maxLen) => arr(v).map((x) => str(x, maxLen).trim()).filter(Boolean).slice(0, max);

  function cleanEnvelope(input, prev) {
    const src = input && typeof input === "object" ? input : {};
    const pick = (k) => (k in src ? src[k] : prev[k]);
    const isProposal = prev.intent === "propose";
    const out = {};
    out.recipientName = str(pick("recipientName"), 60).trim();
    out.fromName = str(pick("fromName"), 60).trim();
    const gender = pick("gender"); out.gender = ["female", "male", "unspecified"].includes(gender) ? gender : "unspecified";
    const mode = pick("proposalMode"); out.proposalMode = mode === "gentle" ? "gentle" : "direct";
    out.ambience = AMBIENCE.includes(pick("ambience")) ? pick("ambience") : prev.ambience;

    const allowed = C.ALL_SECTIONS.filter((s) => s !== "proposal" || isProposal);
    const seen = new Set();
    out.sections = arr(pick("sections")).filter((s) => s && allowed.includes(s.id) && !seen.has(s.id) && seen.add(s.id)).map((s) => ({ id: s.id, on: s.on !== false }));
    allowed.forEach((id) => { if (!seen.has(id)) out.sections.push({ id, on: false }); });

    const ti = pick("titles") || {};
    out.titles = Object.fromEntries(["compliments", "gallery", "letters", "bouquet", "secrets", "questions"].map((k) => [k, str(ti[k], 120).trim() || (prev.titles || {})[k] || ""]));

    const op = pick("opening") || {};
    out.opening = { kicker: str(op.kicker, 120).trim(), greeting: str(op.greeting, 120).trim(), message: str(op.message, 2000).trim() };
    out.compliments = list(pick("compliments"), 40, 400);

    const ids = new Set();
    out.questions = arr(pick("questions")).slice(0, 40).map((q) => {
      const id = typeof q?.id === "string" && /^[a-z0-9]{1,16}$/.test(q.id) && !ids.has(q.id) ? q.id : "n" + crypto.randomBytes(5).toString("hex");
      ids.add(id);
      const options = list(q?.options, 6, 140);
      const type = q?.type === "choice" && options.length >= 2 ? "choice" : "text";
      return { id, q: str(q?.q, 300).trim(), type, options: type === "choice" ? options : [], on: q?.on !== false };
    }).filter((q) => q.q);

    const qz = pick("quiz") || {}, baseQuiz = prev.quiz;
    out.quiz = {
      title: str(qz.title, 120).trim() || baseQuiz.title,
      questions: baseQuiz.questions.map((bq, i) => {
        const iq = arr(qz.questions)[i] || {};
        return { q: str(iq.q, 200).trim() || bq.q, options: bq.options.map((o, j) => ({ t: str(arr(iq.options)[j]?.t, 140).trim() || o.t, k: o.k })) };
      }),
      results: Object.fromEntries(Object.entries(baseQuiz.results).map(([k, r]) => {
        const ir = qz.results?.[k] || {};
        return [k, { title: str(ir.title, 80).trim() || r.title, text: str(ir.text, 400).trim() || r.text }];
      })),
    };

    // uploads and deletes go through their own endpoints, so a stale autosave can't lose a photo
    const g = pick("gallery") || {}, prevPhotos = prev.gallery.photos;
    const byId = new Map(arr(g.photos).filter((p) => p && typeof p.id === "string").map((p) => [p.id, p]));
    const ordered = [...arr(g.photos).map((p) => prevPhotos.find((x) => x.id === p?.id)).filter(Boolean), ...prevPhotos.filter((p) => !byId.has(p.id))];
    const uniq = [...new Map(ordered.map((p) => [p.id, p])).values()];
    out.gallery = {
      layout: C.GALLERY_LAYOUTS[g.layout] ? g.layout : prev.gallery.layout,
      slideshow: g.slideshow === true, previewCover: g.previewCover === true,
      coverId: uniq.some((p) => p.id === g.coverId) ? g.coverId : "",
      photos: uniq.map((p) => {
        const inp = byId.get(p.id) || p;
        return { ...p, caption: str(inp.caption, 160).trim(), interlude: inp.interlude === true };
      }),
    };
    const photoIds = new Set(uniq.map((p) => p.id));
    out.letters = arr(pick("letters")).slice(0, 8).map((l) => ({ title: str(l?.title, 100).trim(), text: str(l?.text, 4000).trim(), photoId: photoIds.has(l?.photoId) ? l.photoId : "" })).filter((l) => l.title || l.text);

    const b = pick("bouquet") || {};
    const kinds = C.BOUQUET;
    out.bouquet = {
      kind: kinds.kinds[b.kind] ? b.kind : prev.bouquet.kind,
      color: HEX_RE.test(b.color) ? b.color : prev.bouquet.color,
      wrap: kinds.wraps[b.wrap] ? b.wrap : prev.bouquet.wrap,
      ribbon: kinds.ribbons[b.ribbon] ? b.ribbon : prev.bouquet.ribbon,
      count: Math.max(3, Math.min(12, parseInt(b.count, 10) || prev.bouquet.count)),
      anim: kinds.anims[b.anim] ? b.anim : prev.bouquet.anim,
      note: str(b.note, 600).trim(),
      messages: list(b.messages, 12, 300),
    };
    out.secrets = arr(pick("secrets")).slice(0, 8).map((s) => ({ label: str(s?.label, 60).trim(), text: str(s?.text, 500).trim() })).filter((s) => s.text);

    const pr = pick("proposal") || {};
    const after = pr.after || {};
    out.proposal = {
      lead: str(pr.lead, 300).trim(), lines: list(pr.lines, 6, 200), question: str(pr.question, 200).trim(),
      yes: str(pr.yes, 40).trim() || "Yes", time: str(pr.time, 40).trim() || "I need a little time", talk: str(pr.talk, 60).trim() || "Let's talk about this together",
      after: { yes: str(after.yes, 400).trim(), time: str(after.time, 400).trim(), talk: str(after.talk, 400).trim() },
    };
    const f = pick("finale") || {};
    out.finale = { title: str(f.title, 120).trim(), letter: str(f.letter, 4000).trim(), sign: str(f.sign, 120).trim() };
    return out;
  }

  function linkStatus(e, owner) {
    if (e.adminDisabled) return "removed";
    if (owner && owner.suspended) return "suspended";
    if (e.status !== "published") return "draft";
    if (e.disabled) return "disabled";
    if (e.expiresAt && Date.parse(e.expiresAt) < Date.now()) return "expired";
    return "published";
  }
  const photoUrl = (e, p) => `/media/${e.id}/${p.file}`;
  const withUrls = (e) => ({ ...e, gallery: { ...e.gallery, photos: e.gallery.photos.map((p) => ({ ...p, url: photoUrl(e, p) })) } });

  // only what a recipient needs; nothing about the owner or other recipients
  function publicView(e) {
    const on = new Set(e.sections.filter((s) => s.on).map((s) => s.id));
    return {
      slug: e.slug, relationship: e.relationship, intent: e.intent, gender: e.gender, recipientName: e.recipientName, fromName: e.fromName,
      proposalMode: e.proposalMode, ambience: e.ambience, titles: e.titles || {},
      sections: e.sections.filter((s) => s.on).map((s) => s.id),
      opening: e.opening,
      compliments: on.has("compliments") ? e.compliments : [],
      questions: on.has("questions") ? e.questions.filter((q) => q.on).map(({ on: _, ...q }) => q) : [],
      quiz: on.has("quiz") ? e.quiz : null,
      gallery: {
        layout: e.gallery.layout, slideshow: e.gallery.slideshow, coverId: e.gallery.coverId,
        photos: e.gallery.photos.map((p) => ({ id: p.id, url: photoUrl(e, p), caption: p.caption, interlude: p.interlude })),
      },
      letters: on.has("letters") ? e.letters : [],
      bouquet: on.has("bouquet") ? e.bouquet : null,
      secrets: on.has("secrets") ? e.secrets : [],
      proposal: on.has("proposal") ? e.proposal : null,
      finale: e.finale,
    };
  }

  function answeredCount(r) { return Object.values(r.answers || {}).filter((v) => String(v).trim()).length; }
  function summary(e, responses = [], owner) {
    const mine = responses.filter((r) => r.envelopeId === e.id);
    const cover = e.gallery.photos.find((p) => p.id === e.gallery.coverId) || e.gallery.photos[0];
    return {
      id: e.id, slug: e.slug, url: `/envelope/${e.slug}`, recipientName: e.recipientName, fromName: e.fromName, relationship: e.relationship, intent: e.intent,
      intentLabel: C.intentFor(e.relationship, e.intent)?.label || e.intent, gender: e.gender, status: linkStatus(e, owner), draft: e.status !== "published",
      disabled: !!e.disabled, adminDisabled: !!e.adminDisabled, expiresAt: e.expiresAt || null, visits: e.visits || 0, lastVisit: e.lastVisit || null,
      responses: mine.length, completed: mine.filter((r) => r.submittedAt).length, photos: e.gallery.photos.length,
      coverUrl: cover ? photoUrl(e, cover) : null, createdAt: e.createdAt, updatedAt: e.updatedAt,
    };
  }

  // a response, flattened into readable rows, against the questions as they were when answered
  function responseView(r, e) {
    const labels = { ...(r.questionText || {}) };
    (e?.questions || []).forEach((q) => { if (!labels[q.id]) labels[q.id] = q.q; });
    return {
      id: r.id, envelopeId: r.envelopeId, startedAt: r.startedAt, updatedAt: r.updatedAt, submittedAt: r.submittedAt || null, complete: !!r.submittedAt,
      answers: Object.entries(r.answers || {}).filter(([, v]) => String(v).trim()).map(([id, answer]) => ({ id, question: fill(labels[id] || "A question that has since been removed", e), answer })),
      quiz: r.quiz || null, proposal: r.proposal || null, feedback: r.feedback || null,
    };
  }
  const fill = (t, e) => C.fill(t, e || {});

  function responsesCSV(rows) {
    const out = [["Recipient", "Creator", "Envelope link", "Type", "Question", "Answer", "Date"].map(csvCell).join(",")];
    rows.forEach(({ view, recipient, creator, link }) => {
      const push = (type, q, a, at) => out.push([recipient, creator, link, type, q, a, at || view.updatedAt].map(csvCell).join(","));
      view.answers.forEach((a) => push("Question", a.question, a.answer, view.submittedAt));
      if (view.quiz) push("Quiz", view.quiz.quizTitle || "Quiz result", view.quiz.title, view.quiz.at);
      if (view.proposal) push("Proposal", "Reply", view.proposal.label, view.proposal.at);
      if (view.feedback) push("Feedback", "Message to creator", view.feedback.text, view.feedback.at);
    });
    return "\uFEFF" + out.join("\r\n");
  }
  function sendDownload(res, name, type, body) {
    res.writeHead(200, { "Content-Type": `${type}; charset=utf-8`, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" });
    res.end(body);
  }

  async function deleteEnvelope(e) {
    await store().docDelMany("responses", { envelopeId: e.id });
    await store().photoDeleteAll(e.id);
    await store().docDel("envelopes", e.id);
  }
  async function deleteUser(id) {
    for (const e of await store().docList("envelopes", { ownerId: id })) await deleteEnvelope(e);
    await store().docDelMany("usessions", { userId: id });
    await store().docDelMany("resets", { userId: id });
    await store().docDel("users", id);
  }
  const touch = (u) => {
    if (!u.lastActiveAt || Date.now() - Date.parse(u.lastActiveAt) > 5 * 60 * 1000) return store().docSet("users", u.id, { lastActiveAt: nowISO() });
  };
  const countDay = (field) => store().docInc("stats", `d:${dayKey()}`, { [field]: 1 });

  /* ---------------------------------------------------- account API */
  async function accountAPI(req, res, p, m) {
    if (p === "/api/account/me" && m === "GET") {
      const u = await currentUser(req);
      return json(res, 200, { user: u ? publicUser(u) : null });
    }
    if (p === "/api/account/register" && m === "POST") {
      if (await store().hit("reg:" + ip(req), 20, 3600e3)) return fail(res, 429, "Too many sign-ups from here. Please try again later.");
      const b = await readJSON(req);
      const name = str(b.name, 80).trim(), email = str(b.email, 254).trim().toLowerCase(), password = b.password;
      if (!name) return fail(res, 400, "Please tell us your name.");
      if (!EMAIL_RE.test(email)) return fail(res, 400, "That email address doesn't look right.");
      if (typeof password !== "string" || password.length < 8 || password.length > 200) return fail(res, 400, "Please use a password of at least 8 characters.");
      const now = nowISO();
      const id = newId();
      try {
        await store().docInsert("users", id, { name, email, ...(await hashPw(password)), suspended: false, createdAt: now, lastActiveAt: now }, "email");
      } catch (e) {
        if (e.dup) return fail(res, 409, "There's already an account with that email. Try logging in.");
        throw e;
      }
      await countDay("signups");
      await startUserSession(req, res, id);
      return json(res, 201, { user: publicUser({ id, name, email, createdAt: now }) });
    }
    if (p === "/api/account/login" && m === "POST") {
      if (await store().hit("ulogin:" + ip(req), 30, 15 * 60e3)) return fail(res, 429, "Too many attempts. Please try again in 15 minutes.");
      const b = await readJSON(req);
      const email = str(b.email, 254).trim().toLowerCase();
      if (await store().hit("uemail:" + sha(email), 10, 15 * 60e3)) return fail(res, 429, "Too many attempts. Please try again in 15 minutes.");
      const u = await store().docFindOne("users", { email });
      if (!(await checkPw(u, b.password))) return fail(res, 401, "That email and password don't match.");
      if (u.suspended) return fail(res, 403, "This account has been suspended. Please contact the site owner.");
      await store().docSet("users", u.id, { lastActiveAt: nowISO() });
      await startUserSession(req, res, u.id);
      return json(res, 200, { user: publicUser(u) });
    }
    if (p === "/api/account/logout" && m === "POST") {
      const t = parseCookies(req).lw_user;
      if (t && /^[a-f0-9]{64}$/.test(t)) await store().docDel("usessions", sha(t));
      res.setHeader("Set-Cookie", "lw_user=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
      return json(res, 200, { ok: true });
    }
    if (p === "/api/account/reset" && m === "POST") {
      if (await store().hit("reset:" + ip(req), 20, 3600e3)) return fail(res, 429, "Too many attempts. Please try again later.");
      const b = await readJSON(req);
      if (typeof b.token !== "string" || !/^[a-f0-9]{64}$/.test(b.token)) return fail(res, 400, "That reset link isn't valid.");
      if (typeof b.password !== "string" || b.password.length < 8 || b.password.length > 200) return fail(res, 400, "Please use a password of at least 8 characters.");
      const key = sha(b.token), r = await store().docGet("resets", key);
      if (!r || r.exp < Date.now()) return fail(res, 400, "That reset link has expired. Ask for a new one.");
      await store().docSet("users", r.userId, await hashPw(b.password));
      await store().docDelMany("usessions", { userId: r.userId });
      await store().docDel("resets", key);
      await startUserSession(req, res, r.userId);
      return json(res, 200, { ok: true });
    }
    const u = await currentUser(req);
    if (!u) return fail(res, 401, "Please log in.");
    if (p === "/api/account/me" && m === "PATCH") {
      const b = await readJSON(req);
      const name = str(b.name, 80).trim();
      if (!name) return fail(res, 400, "Please tell us your name.");
      await store().docSet("users", u.id, { name });
      return json(res, 200, { user: publicUser({ ...u, name }) });
    }
    if (p === "/api/account/password" && m === "POST") {
      const b = await readJSON(req);
      if (await store().hit("upw:" + u.id, 10, 15 * 60e3)) return fail(res, 429, "Too many attempts. Please try again in 15 minutes.");
      if (!(await checkPw(u, b.current))) return fail(res, 401, "Your current password isn't right.");
      if (typeof b.password !== "string" || b.password.length < 8 || b.password.length > 200) return fail(res, 400, "Please use a password of at least 8 characters.");
      await store().docSet("users", u.id, await hashPw(b.password));
      await store().docDelMany("usessions", { userId: u.id });
      await startUserSession(req, res, u.id);
      return json(res, 200, { ok: true });
    }
    if (p === "/api/account/delete" && m === "POST") {
      const b = await readJSON(req);
      if (await store().hit("upw:" + u.id, 10, 15 * 60e3)) return fail(res, 429, "Too many attempts. Please try again in 15 minutes.");
      if (!(await checkPw(u, b.password))) return fail(res, 401, "Your password isn't right.");
      await deleteUser(u.id);
      res.setHeader("Set-Cookie", "lw_user=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
      return json(res, 200, { ok: true });
    }
    return fail(res, 404, "Not found.");
  }

  /* ---------------------------------------------------- creator studio API */
  async function ownedEnvelope(u, id) {
    if (!ID_RE.test(id)) return null;
    const e = await store().docGet("envelopes", id);
    return e && e.ownerId === u.id ? e : null; // someone else's envelope looks exactly like a missing one
  }
  function validSetup(b) {
    const relationship = C.RELATIONSHIPS[b.relationship] ? b.relationship : null;
    const intent = relationship && C.intentFor(relationship, b.intent) ? b.intent : null;
    return { relationship, intent };
  }
  async function studioAPI(req, res, u, p, m, url) {
    await touch(u);
    if (p === "/api/studio/envelopes" && m === "GET") {
      const [envs, rs] = await Promise.all([store().docList("envelopes", { ownerId: u.id }), store().docList("responses", { ownerId: u.id })]);
      return json(res, 200, envs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((e) => summary(e, rs, u)));
    }
    if (p === "/api/studio/envelopes" && m === "POST") {
      const b = await readJSON(req);
      const { relationship, intent } = validSetup(b);
      if (!intent) return fail(res, 400, "Please choose who this is for and what you'd like to make.");
      const recipientName = str(b.recipientName, 60).trim();
      if (!recipientName) return fail(res, 400, "Please tell us their name.");
      if ((await store().docCount("envelopes", { ownerId: u.id })) >= MAX_ENVELOPES) return fail(res, 403, "You've reached the limit of envelopes on one account.");
      const base = C.build(relationship, intent, { gender: b.gender, recipientName, fromName: str(b.fromName, 60).trim() || u.name, proposalMode: b.proposalMode });
      const now = nowISO(), id = newId();
      const e = { ...base, id, slug: newSlug(), ownerId: u.id, status: "draft", disabled: false, adminDisabled: false, expiresAt: null, visits: 0, createdAt: now, updatedAt: now };
      await store().docInsert("envelopes", id, e);
      await countDay("created");
      return json(res, 201, withUrls(e));
    }
    if (p === "/api/studio/responses" && m === "GET") {
      const [envs, rs] = await Promise.all([store().docList("envelopes", { ownerId: u.id }), store().docList("responses", { ownerId: u.id })]);
      const byId = new Map(envs.map((e) => [e.id, e]));
      const rows = rs.filter((r) => byId.has(r.envelopeId)).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).map((r) => {
        const e = byId.get(r.envelopeId);
        return { ...responseView(r, e), recipientName: e.recipientName, gender: e.gender, relationship: e.relationship, intentLabel: C.intentFor(e.relationship, e.intent)?.label || "" };
      });
      return json(res, 200, rows);
    }
    let mm = p.match(/^\/api\/studio\/envelopes\/([a-z0-9]+)(?:\/([a-z]+))?(?:\/([a-z0-9]+))?$/);
    if (!mm) return fail(res, 404, "Not found.");
    const e = await ownedEnvelope(u, mm[1]);
    if (!e) return fail(res, 404, "We couldn't find that envelope.");
    const sub = mm[2] || "", arg = mm[3] || "";

    if (!sub && m === "GET") return json(res, 200, { ...withUrls(e), linkStatus: linkStatus(e, u) });
    if (!sub && m === "PUT") {
      const clean = cleanEnvelope(await readJSON(req, 512 * 1024), e);
      if (!clean.recipientName) return fail(res, 400, "Please tell us their name.");
      const fresh = await store().docGet("envelopes", e.id); // keep counters that changed while editing
      const next = { ...fresh, ...clean, gallery: { ...clean.gallery }, updatedAt: nowISO() };
      await store().docPut("envelopes", e.id, next);
      return json(res, 200, { ...withUrls(next), linkStatus: linkStatus(next, u) });
    }
    if (!sub && m === "DELETE") { await deleteEnvelope(e); return json(res, 200, { ok: true }); }
    if (sub === "preview" && m === "GET") return json(res, 200, publicView(e));
    if (sub === "restyle" && m === "POST") {
      const b = await readJSON(req);
      const { relationship, intent } = validSetup(b);
      if (!intent) return fail(res, 400, "Please choose a relationship and an idea.");
      const built = C.build(relationship, intent, { gender: e.gender, recipientName: e.recipientName, fromName: e.fromName, proposalMode: b.proposalMode || e.proposalMode });
      const next = { ...e, ...built, gallery: { ...built.gallery, layout: e.gallery.photos.length ? e.gallery.layout : built.gallery.layout, photos: e.gallery.photos, coverId: e.gallery.coverId, slideshow: e.gallery.slideshow, previewCover: e.gallery.previewCover }, updatedAt: nowISO() };
      await store().docPut("envelopes", e.id, next);
      return json(res, 200, { ...withUrls(next), linkStatus: linkStatus(next, u) });
    }
    if (sub === "publish" && m === "POST") {
      if (!e.recipientName) return fail(res, 400, "Please tell us their name first.");
      if (e.adminDisabled) return fail(res, 403, "This envelope has been taken down by the site owner.");
      const patch = { status: "published", disabled: false, publishedAt: e.publishedAt || nowISO(), updatedAt: nowISO() };
      await store().docSet("envelopes", e.id, patch);
      return json(res, 200, { ...withUrls({ ...e, ...patch }), linkStatus: linkStatus({ ...e, ...patch }, u) });
    }
    if (sub === "link" && m === "POST") {
      const b = await readJSON(req);
      const patch = { updatedAt: nowISO() };
      if ("disabled" in b) patch.disabled = b.disabled === true;
      if ("expiresAt" in b) {
        if (b.expiresAt === null || b.expiresAt === "") patch.expiresAt = null;
        else {
          const t = Date.parse(b.expiresAt);
          if (!Number.isFinite(t)) return fail(res, 400, "That date doesn't look right.");
          patch.expiresAt = new Date(t).toISOString();
        }
      }
      await store().docSet("envelopes", e.id, patch);
      return json(res, 200, { ...withUrls({ ...e, ...patch }), linkStatus: linkStatus({ ...e, ...patch }, u) });
    }
    if (sub === "photos" && m === "POST" && !arg) {
      if (await store().hit("photo:" + u.id, 200, 3600e3)) return fail(res, 429, "That's a lot of photos. Please wait a little while.");
      if (e.gallery.photos.length >= MAX_PHOTOS) return fail(res, 400, `One envelope can hold up to ${MAX_PHOTOS} photographs.`);
      const buf = await readBody(req, PHOTO_LIMIT);
      const ext = imageExt(buf);
      if (!ext) return fail(res, 415, "That file isn't a JPG, PNG, WebP or GIF image.");
      const pid = newId(), file = `${crypto.randomBytes(16).toString("hex").slice(0, 24)}.${ext}`;
      await store().photoSave(e.id, file, buf);
      // re-read so that photos uploaded side by side don't overwrite each other
      const fresh = await store().docGet("envelopes", e.id);
      const photo = { id: pid, file, caption: "", interlude: false, size: buf.length, at: nowISO() };
      const gallery = { ...fresh.gallery, photos: [...fresh.gallery.photos, photo] };
      if (!gallery.coverId) gallery.coverId = pid;
      await store().docSet("envelopes", e.id, { gallery, updatedAt: nowISO() });
      return json(res, 201, { photo: { ...photo, url: photoUrl(e, photo) }, coverId: gallery.coverId });
    }
    if (sub === "photos" && m === "DELETE" && arg) {
      const photo = e.gallery.photos.find((x) => x.id === arg);
      if (!photo) return fail(res, 404, "That photograph has already gone.");
      const photos = e.gallery.photos.filter((x) => x.id !== arg);
      const gallery = { ...e.gallery, photos, coverId: e.gallery.coverId === arg ? (photos[0]?.id || "") : e.gallery.coverId };
      const letters = e.letters.map((l) => (l.photoId === arg ? { ...l, photoId: "" } : l));
      await store().docSet("envelopes", e.id, { gallery, letters, updatedAt: nowISO() });
      await store().photoDelete(e.id, photo.file);
      return json(res, 200, { coverId: gallery.coverId });
    }
    if (sub === "responses" && m === "GET") {
      const rs = await store().docList("responses", { envelopeId: e.id });
      return json(res, 200, rs.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).map((r) => responseView(r, e)));
    }
    if (sub === "responses" && m === "DELETE" && arg) {
      const r = await store().docGet("responses", arg);
      if (!r || r.envelopeId !== e.id) return fail(res, 404, "Not found.");
      await store().docDel("responses", arg);
      return json(res, 200, { ok: true });
    }
    if (sub === "export" && m === "GET") {
      const rs = (await store().docList("responses", { envelopeId: e.id })).map((r) => responseView(r, e));
      const name = `${(e.recipientName || "envelope").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "envelope"}-responses`;
      if (url.searchParams.get("format") === "json") return sendDownload(res, `${name}.json`, "application/json", JSON.stringify({ recipient: e.recipientName, exportedAt: nowISO(), responses: rs }, null, 2));
      return sendDownload(res, `${name}.csv`, "text/csv", responsesCSV(rs.map((view) => ({ view, recipient: e.recipientName, creator: e.fromName, link: `/envelope/${e.slug}` }))));
    }
    return fail(res, 404, "Not found.");
  }

  /* ---------------------------------------------------- recipient API */
  async function loadPublished(slug) {
    if (!SLUG_RE.test(slug)) return { e: null };
    const e = await store().docFindOne("envelopes", { slug });
    if (!e) return { e: null };
    const owner = await store().docGet("users", e.ownerId);
    return linkStatus(e, owner || { suspended: true }) === "published" ? { e } : { e: null };
  }
  const closedMessage = "This envelope isn't open right now.";
  const responseId = (e, rid) => sha(`${e.id}:${rid}`).slice(0, 32);

  async function recipientAPI(req, res, slug, action, m) {
    const { e } = await loadPublished(slug);
    if (!e) return fail(res, 404, closedMessage);
    if (m === "GET" && !action) return json(res, 200, publicView(e));
    if (m !== "POST") return fail(res, 405, "method not allowed");
    if (await store().hit(`env:${ip(req)}:${e.id}`, 180, 60e3)) return fail(res, 429, "Slow down a little.");
    const b = await readJSON(req, 96 * 1024);
    const now = nowISO();
    if (action === "seen") {
      await store().docInc("envelopes", e.id, { visits: 1 }, { lastVisit: now });
      await countDay("visits");
      return json(res, 200, { ok: true });
    }
    if (typeof b.rid !== "string" || !/^[a-z0-9]{32}$/.test(b.rid)) return fail(res, 400, "bad request");
    const id = responseId(e, b.rid);
    const existing = await store().docGet("responses", id);

    if (action === "progress") {
      if (!existing) return json(res, 200, { progress: null });
      const { answers, index, submittedAt, quiz, proposal, feedback } = existing;
      return json(res, 200, { progress: { answers, index, submittedAt, quiz, proposal, feedback } });
    }
    if (action === "erase") {
      if (existing) await store().docDel("responses", id);
      return json(res, 200, { ok: true });
    }
    // nothing is stored until the recipient has been told who can read it
    if (b.consent !== true) return fail(res, 403, "Please confirm you're happy to share this first.");
    const sectionOn = (s) => e.sections.some((x) => x.id === s && x.on);
    const ensure = async () => {
      if (existing) return;
      if ((await store().docCount("responses", { envelopeId: e.id })) >= MAX_RESPONSES) throw Object.assign(new Error("full"), { full: true });
      await store().docPut("responses", id, { envelopeId: e.id, ownerId: e.ownerId, consentAt: now, startedAt: now, updatedAt: now, answers: {}, index: 0 });
    };
    try {
      if (action === "answers") {
        if (!sectionOn("questions")) return fail(res, 400, "bad request");
        await ensure();
        const valid = new Map(e.questions.filter((q) => q.on).map((q) => [q.id, q]));
        const answers = { ...(existing?.answers || {}) };
        const questionText = { ...(existing?.questionText || {}) };
        if (b.answers && typeof b.answers === "object") {
          for (const [k, v] of Object.entries(b.answers)) {
            const q = valid.get(k);
            if (!q) continue;
            const value = str(v, 2000);
            if (q.type === "choice" && value && !q.options.includes(value)) continue;
            answers[k] = value; questionText[k] = q.q;
          }
        }
        const index = Number.isInteger(b.index) ? Math.max(0, Math.min(b.index, valid.size)) : 0;
        const patch = { answers, questionText, index, updatedAt: now };
        if (b.submit === true) patch.submittedAt = now;
        await store().docSet("responses", id, patch);
        if (b.submit === true && !existing?.submittedAt) await countDay("completed");
        return json(res, 200, { ok: true, submittedAt: patch.submittedAt || existing?.submittedAt || null });
      }
      if (action === "quiz") {
        if (!sectionOn("quiz")) return fail(res, 400, "bad request");
        const r = e.quiz.results[b.result];
        if (!r) return fail(res, 400, "unknown result");
        await ensure();
        await store().docSet("responses", id, { quiz: { key: b.result, title: r.title, text: r.text, quizTitle: e.quiz.title, at: now }, updatedAt: now });
        return json(res, 200, { ok: true });
      }
      if (action === "proposal") {
        if (!sectionOn("proposal") || e.intent !== "propose") return fail(res, 400, "bad request");
        if (!REPLY_CHOICES.includes(b.choice)) return fail(res, 400, "unknown choice");
        await ensure();
        await store().docSet("responses", id, { proposal: { choice: b.choice, label: e.proposal[b.choice], at: now }, updatedAt: now });
        return json(res, 200, { ok: true });
      }
      if (action === "feedback") {
        const text = str(b.text, 2000).trim();
        if (!text) return fail(res, 400, "Write something first.");
        await ensure();
        await store().docSet("responses", id, { feedback: { text, at: now }, updatedAt: now });
        return json(res, 200, { ok: true });
      }
    } catch (err) {
      if (err.full) return fail(res, 429, "This envelope can't take any more replies.");
      throw err;
    }
    return fail(res, 404, "unknown action");
  }

  /* ---------------------------------------------------- admin API */
  function legacyRow(x) {
    const r = x.responses || {}, qn = r.questionnaire;
    const answered = qn ? Object.values(qn.answers || {}).filter((v) => String(v).trim()).length : 0;
    return {
      id: x.id, kind: "legacy", slug: x.slug, url: `/surprise/${x.slug}`, recipientName: x.name, fromName: x.from || "", creatorName: "You (original studio)", creatorEmail: "", ownerId: null,
      relationship: "friend", relationshipLabel: "Original world", intentLabel: "Original little world", gender: "unspecified", status: x.disabled ? "removed" : "published", adminDisabled: !!x.disabled,
      visits: r.openedAt ? 1 : 0, lastVisit: r.lastSeen || null, responses: qn ? 1 : 0, completed: qn?.submittedAt ? 1 : 0, answered,
      photos: (x.scrapbook || []).filter((s) => s.photo).length, createdAt: x.createdAt, updatedAt: x.updatedAt,
    };
  }
  function legacyResponse(x) {
    const r = x.responses || {}, qn = r.questionnaire;
    if (!qn && !r.personality && !r.meter) return null;
    const answers = (x.questions || []).filter((q) => String(qn?.answers?.[q.id] || "").trim()).map((q) => ({ id: q.id, question: q.q, answer: qn.answers[q.id] }));
    return {
      id: `legacy-${x.id}`, kind: "legacy", envelopeId: x.id, recipientName: x.name, creatorName: "You (original studio)", creatorEmail: "", relationship: "friend", intentLabel: "Original little world", url: `/surprise/${x.slug}`,
      startedAt: r.openedAt || null, updatedAt: qn?.updatedAt || r.lastSeen || null, submittedAt: qn?.submittedAt || null, complete: !!qn?.submittedAt, answers,
      quiz: r.personality ? { title: r.personality.result, at: r.personality.at } : null, proposal: null, feedback: null, meter: r.meter || null,
    };
  }
  async function everything() {
    const [users, envs, rs, legacy] = await Promise.all([store().docList("users"), store().docList("envelopes"), store().docList("responses"), store().list()]);
    return { users, envs, rs, legacy };
  }
  function envelopeRows({ users, envs, rs, legacy }) {
    const byUser = new Map(users.map((u) => [u.id, u]));
    const rows = envs.map((e) => {
      const owner = byUser.get(e.ownerId);
      const s = summary(e, rs, owner);
      return { ...s, kind: "envelope", ownerId: e.ownerId, creatorName: owner?.name || "Deleted account", creatorEmail: owner?.email || "", relationshipLabel: C.RELATIONSHIPS[e.relationship]?.label || e.relationship, answered: rs.filter((r) => r.envelopeId === e.id).reduce((n, r) => n + answeredCount(r), 0) };
    });
    return [...rows, ...legacy.map(legacyRow)].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
  function responseRows({ users, envs, rs, legacy }) {
    const byUser = new Map(users.map((u) => [u.id, u])), byEnv = new Map(envs.map((e) => [e.id, e]));
    const rows = rs.map((r) => {
      const e = byEnv.get(r.envelopeId), owner = byUser.get(r.ownerId);
      return { ...responseView(r, e), kind: "envelope", recipientName: e?.recipientName || "", creatorName: owner?.name || "Deleted account", creatorEmail: owner?.email || "", ownerId: r.ownerId, relationship: e?.relationship || "", intentLabel: e ? C.intentFor(e.relationship, e.intent)?.label : "", url: e ? `/envelope/${e.slug}` : "" };
    });
    return [...rows, ...legacy.map(legacyResponse).filter(Boolean)].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }
  const pageOf = (items, url) => {
    const page = Math.max(1, parseInt(url.searchParams.get("page"), 10) || 1);
    return { total: items.length, page, pages: Math.max(1, Math.ceil(items.length / PAGE)), items: items.slice((page - 1) * PAGE, page * PAGE) };
  };
  const has = (q, ...vals) => !q || vals.some((v) => String(v ?? "").toLowerCase().includes(q));
  const userRow = (u, envs, rs) => {
    const mine = envs.filter((e) => e.ownerId === u.id);
    return {
      id: u.id, name: u.name, email: u.email, createdAt: u.createdAt, lastActiveAt: u.lastActiveAt || null, suspended: !!u.suspended,
      envelopes: mine.length, published: mine.filter((e) => e.status === "published").length, visits: mine.reduce((n, e) => n + (e.visits || 0), 0), responses: rs.filter((r) => r.ownerId === u.id).length,
    };
  };

  async function controlAPI(req, res, p, m, url) {
    if (p === "/api/control/overview" && m === "GET") {
      const all = await everything();
      const rows = envelopeRows(all), resp = responseRows(all);
      const tally = (key) => Object.entries(rows.reduce((o, r) => ((o[r[key]] = (o[r[key]] || 0) + 1), o), {})).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
      return json(res, 200, {
        totals: {
          creators: all.users.length, envelopes: rows.length, opened: rows.reduce((n, r) => n + r.visits, 0),
          completed: rows.reduce((n, r) => n + r.completed, 0), answers: rows.reduce((n, r) => n + r.answered, 0), photos: rows.reduce((n, r) => n + r.photos, 0), responses: resp.length,
        },
        recentEnvelopes: rows.slice(0, 8),
        recentCreators: all.users.map((u) => userRow(u, all.envs, all.rs)).sort((a, b) => (b.lastActiveAt || "").localeCompare(a.lastActiveAt || "")).slice(0, 8),
        relationships: tally("relationshipLabel"), experiences: tally("intentLabel"),
      });
    }
    if (p === "/api/control/analytics" && m === "GET") {
      const days = (await store().docList("stats")).filter((d) => /^d:\d{4}-\d{2}-\d{2}$/.test(d.id)).reduce((o, d) => ((o[d.id.slice(2)] = d), o), {});
      const series = [];
      for (let i = 29; i >= 0; i--) {
        const key = dayKey(new Date(Date.now() - i * 864e5)), d = days[key] || {};
        series.push({ day: key, visits: d.visits || 0, created: d.created || 0, signups: d.signups || 0, completed: d.completed || 0 });
      }
      const all = await everything(), rows = envelopeRows(all);
      const statuses = Object.entries(rows.reduce((o, r) => ((o[r.status] = (o[r.status] || 0) + 1), o), {})).map(([label, count]) => ({ label, count }));
      const opened = rows.filter((r) => r.visits > 0).length, published = rows.filter((r) => r.status === "published").length;
      return json(res, 200, { series, statuses, funnel: { created: rows.length, published, opened, answered: rows.filter((r) => r.responses > 0).length, completed: rows.filter((r) => r.completed > 0).length } });
    }
    if (p === "/api/control/users" && m === "GET") {
      const [users, envs, rs] = await Promise.all([store().docList("users"), store().docList("envelopes"), store().docList("responses")]);
      const q = (url.searchParams.get("q") || "").toLowerCase().trim(), status = url.searchParams.get("status") || "";
      const rows = users.map((u) => userRow(u, envs, rs)).filter((u) => has(q, u.name, u.email) && (!status || (status === "suspended") === u.suspended)).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      return json(res, 200, pageOf(rows, url));
    }
    let mm;
    if ((mm = p.match(/^\/api\/control\/users\/([a-z0-9]{12})(?:\/([a-z-]+))?$/))) {
      const u = await store().docGet("users", mm[1]);
      if (!u) return fail(res, 404, "Not found.");
      const sub = mm[2] || "";
      if (!sub && m === "GET") {
        const [envs, rs] = await Promise.all([store().docList("envelopes", { ownerId: u.id }), store().docList("responses", { ownerId: u.id })]);
        return json(res, 200, { ...userRow(u, envs, rs), envelopesList: envs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((e) => summary(e, rs, u)) });
      }
      if (!sub && m === "PATCH") {
        const b = await readJSON(req);
        await store().docSet("users", u.id, { suspended: b.suspended === true });
        if (b.suspended === true) await store().docDelMany("usessions", { userId: u.id });
        return json(res, 200, { ok: true, suspended: b.suspended === true });
      }
      if (!sub && m === "DELETE") { await deleteUser(u.id); return json(res, 200, { ok: true }); }
      if (sub === "reset-link" && m === "POST") {
        const token = crypto.randomBytes(32).toString("hex");
        await store().docSweep("resets");
        await store().docPut("resets", sha(token), { userId: u.id, exp: Date.now() + RESET_MS });
        return json(res, 200, { path: `/create?reset=${token}` });
      }
    }
    if (p === "/api/control/envelopes" && m === "GET") {
      const q = (url.searchParams.get("q") || "").toLowerCase().trim(), status = url.searchParams.get("status") || "", rel = url.searchParams.get("relationship") || "";
      const rows = envelopeRows(await everything()).filter((r) => has(q, r.recipientName, r.fromName, r.creatorName, r.creatorEmail, r.slug, r.intentLabel) && (!status || r.status === status) && (!rel || (r.kind === "envelope" && r.relationship === rel)));
      return json(res, 200, pageOf(rows, url));
    }
    if ((mm = p.match(/^\/api\/control\/envelopes\/([a-z0-9]+)(?:\/([a-z]+))?$/))) {
      const e = ID_RE.test(mm[1]) ? await store().docGet("envelopes", mm[1]) : null;
      const sub = mm[2] || "";
      if (e) {
        if (!sub && m === "GET") {
          const [owner, rs] = await Promise.all([store().docGet("users", e.ownerId), store().docList("responses", { envelopeId: e.id })]);
          return json(res, 200, { kind: "envelope", summary: summary(e, rs, owner), creator: owner ? publicUser(owner) : null, config: withUrls(e), responses: rs.map((r) => responseView(r, e)) });
        }
        if (sub === "preview" && m === "GET") return json(res, 200, publicView(e));
        if (!sub && m === "PATCH") {
          const b = await readJSON(req);
          await store().docSet("envelopes", e.id, { adminDisabled: b.adminDisabled === true });
          return json(res, 200, { ok: true });
        }
        if (!sub && m === "DELETE") { await deleteEnvelope(e); return json(res, 200, { ok: true }); }
      }
      const legacy = /^[a-z0-9]{10}$/.test(mm[1]) ? await store().get(mm[1]) : null;
      if (legacy) {
        if (!sub && m === "GET") return json(res, 200, { kind: "legacy", summary: legacyRow(legacy), creator: null, config: null, responses: [legacyResponse(legacy)].filter(Boolean) });
        if (!sub && m === "PATCH") {
          const b = await readJSON(req);
          await store().put({ ...legacy, disabled: b.adminDisabled === true });
          return json(res, 200, { ok: true });
        }
        if (!sub && m === "DELETE") { await store().remove(legacy.id); return json(res, 200, { ok: true }); }
      }
      return fail(res, 404, "Not found.");
    }
    if (p === "/api/control/responses" && m === "GET") {
      const q = (url.searchParams.get("q") || "").toLowerCase().trim(), filter = url.searchParams.get("filter") || "";
      const rows = responseRows(await everything()).filter((r) =>
        has(q, r.recipientName, r.creatorName, r.creatorEmail, r.intentLabel, r.feedback?.text, r.quiz?.title, ...r.answers.flatMap((a) => [a.question, a.answer])) &&
        (!filter || (filter === "complete" ? r.complete : filter === "feedback" ? !!r.feedback : filter === "proposal" ? !!r.proposal : !r.complete)));
      return json(res, 200, pageOf(rows, url));
    }
    if ((mm = p.match(/^\/api\/control\/responses\/([a-z0-9]{32})$/)) && m === "DELETE") {
      await store().docDel("responses", mm[1]);
      return json(res, 200, { ok: true });
    }
    if ((mm = p.match(/^\/api\/control\/export\/(users|envelopes|responses)$/)) && m === "GET") {
      const all = await everything();
      const stamp = dayKey();
      if (mm[1] === "users") {
        const out = [["Name", "Email", "Registered", "Last active", "Status", "Envelopes", "Published", "Visits", "Responses"].map(csvCell).join(",")];
        all.users.forEach((u) => { const r = userRow(u, all.envs, all.rs); out.push([r.name, r.email, r.createdAt, r.lastActiveAt, r.suspended ? "Suspended" : "Active", r.envelopes, r.published, r.visits, r.responses].map(csvCell).join(",")); });
        return sendDownload(res, `creators-${stamp}.csv`, "text/csv", "\uFEFF" + out.join("\r\n"));
      }
      if (mm[1] === "envelopes") {
        const out = [["Creator", "Creator email", "Recipient", "Relationship", "Gender", "Experience", "Link", "Created", "Visits", "Completed", "Photos", "Status"].map(csvCell).join(",")];
        envelopeRows(all).forEach((r) => out.push([r.creatorName, r.creatorEmail, r.recipientName, r.relationshipLabel, r.gender, r.intentLabel, r.url, r.createdAt, r.visits, r.completed, r.photos, r.status].map(csvCell).join(",")));
        return sendDownload(res, `envelopes-${stamp}.csv`, "text/csv", "\uFEFF" + out.join("\r\n"));
      }
      const rows = responseRows(all).map((view) => ({ view, recipient: view.recipientName, creator: view.creatorName, link: view.url }));
      return sendDownload(res, `responses-${stamp}.csv`, "text/csv", responsesCSV(rows));
    }
    return fail(res, 404, "Not found.");
  }

  /* ---------------------------------------------------- photos */
  async function mediaRoute(req, res, id, file) {
    if (!ID_RE.test(id) || !/^[a-z0-9]{24}\.(jpg|png|webp|gif)$/.test(file)) return notFound(res);
    const e = await store().docGet("envelopes", id);
    if (!e || !e.gallery.photos.some((x) => x.file === file)) return notFound(res);
    const owner = await store().docGet("users", e.ownerId);
    let allowed = linkStatus(e, owner || { suspended: true }) === "published";
    if (!allowed) { const u = await currentUser(req); allowed = !!u && u.id === e.ownerId; }
    if (!allowed) allowed = await isAdmin(req);
    if (!allowed) return notFound(res);
    const buf = await store().photoGet(id, file);
    if (!buf) return notFound(res);
    res.writeHead(200, { "Content-Type": MIME["." + file.split(".").pop()], "Content-Length": buf.length, "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex" });
    res.end(buf);
  }

  /* ---------------------------------------------------- pages */
  function html(res, body, code = 200, extra = {}) {
    res.writeHead(code, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...extra });
    res.end(body);
  }
  function allowSameOriginFrame(res) {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", String(res.getHeader("Content-Security-Policy")).replace("frame-ancestors 'none'", "frame-ancestors 'self'"));
  }
  const originOf = (req) => process.env.PUBLIC_URL?.replace(/\/+$/, "") || `${req.headers["x-forwarded-proto"] || (req.socket?.encrypted ? "https" : "http")}://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const STUDIO_PAGE = /^\/studio(?:\/(?:create|experiences|responses|account)|\/edit\/[a-z0-9]{12})?$/;
  const ADMIN_PAGE = /^\/admin(?:\/(?:users|envelopes|responses|analytics))?(?:\/[a-z0-9]{10,12})?$/;

  async function pageRoute(req, res, p, url) {
    if (p === "/") return html(res, pages.landing());
    if (p === "/privacy") return html(res, pages.privacy());
    let mm;
    if ((mm = p.match(/^\/demo\/([a-z]+)$/))) {
      if (!C.RELATIONSHIPS[mm[1]]) return notFound(res);
      return html(res, pages.envelope({ theme: mm[1], demo: mm[1], title: "A sample envelope", description: "A sample of what your envelope could look like.", image: `${originOf(req)}${C.THEMES[mm[1]].og}`, url: `${originOf(req)}/demo/${mm[1]}`, noindex: true }));
    }
    if (!store()) return html(res, pages.unavailable(), 503);

    if (p === "/create") {
      if (url.searchParams.get("reset")) return html(res, pages.create());
      if (await currentUser(req)) { res.writeHead(302, { Location: "/studio/create" }); res.end(); return; }
      return html(res, pages.create());
    }
    if (STUDIO_PAGE.test(p)) {
      if (!(await currentUser(req))) { res.writeHead(302, { Location: `/create?next=${encodeURIComponent(p)}` }); res.end(); return; }
      return html(res, pages.studio());
    }
    if ((mm = p.match(/^\/studio\/preview\/([a-z0-9]{12})$/))) {
      const u = await currentUser(req);
      if (!u) { res.writeHead(302, { Location: "/create" }); res.end(); return; }
      const e = await ownedEnvelope(u, mm[1]);
      if (!e) return notFound(res);
      allowSameOriginFrame(res);
      return html(res, pages.envelope({ theme: e.relationship, previewApi: `/api/studio/envelopes/${e.id}/preview`, title: "Preview", description: "", noindex: true }));
    }
    if ((mm = p.match(/^\/admin\/preview\/([a-z0-9]{12})$/))) {
      if (!(await isAdmin(req))) return notFound(res);
      const e = await store().docGet("envelopes", mm[1]);
      if (!e) return notFound(res);
      return html(res, pages.envelope({ theme: e.relationship, previewApi: `/api/control/envelopes/${e.id}/preview`, title: "Preview", description: "", noindex: true }));
    }
    if (p === "/admin/worlds") return sendFile(res, legacyAdminFile, { "X-Robots-Tag": "noindex" });
    if (ADMIN_PAGE.test(p)) {
      const needsSetup = !(await store().getConfig()).hash;
      if (!(await isAdmin(req))) return html(res, pages.adminLogin(needsSetup), 200, { "X-Robots-Tag": "noindex" });
      return html(res, pages.admin(), 200, { "X-Robots-Tag": "noindex" });
    }
    if ((mm = p.match(/^\/envelope\/([^/]+)$/))) {
      const { e } = await loadPublished(mm[1]);
      const origin = originOf(req);
      if (!e) return html(res, pages.envelope({ theme: "friend", closed: true, title: "A little envelope", description: "This envelope isn't open right now.", noindex: true, image: `${origin}/img/og-friend.png`, url: `${origin}/` }), 404);
      const cover = e.gallery.previewCover && e.gallery.photos.find((x) => x.id === e.gallery.coverId);
      return html(res, pages.envelope({
        theme: e.relationship, slug: e.slug, noindex: true,
        title: `${e.recipientName}, ${e.fromName ? `${e.fromName} made` : "someone made"} this for you`,
        description: "A little surprise, made just for you. Open it when you have a quiet moment.",
        image: cover ? `${origin}${photoUrl(e, cover)}` : `${origin}${C.THEMES[e.relationship].og}`, url: `${origin}/envelope/${e.slug}`,
      }));
    }
    return false;
  }

  /* ---------------------------------------------------- router */
  async function route(req, res, url, p, m) {
    const isPlatformApi = /^\/api\/(account|studio|control|e)(\/|$)/.test(p);
    if (m === "GET" && !p.startsWith("/api/") && !p.startsWith("/media/")) {
      const handled = await pageRoute(req, res, p, url);
      return handled !== false;
    }
    if (!isPlatformApi && !p.startsWith("/media/")) return false;
    if (!store()) { fail(res, 503, h.storeError()); return true; }

    if (p.startsWith("/media/")) {
      const mm = p.match(/^\/media\/([^/]+)\/([^/]+)$/);
      if (m !== "GET" || !mm) notFound(res); else await mediaRoute(req, res, mm[1], mm[2]);
      return true;
    }
    if (p.startsWith("/api/account/")) { await accountAPI(req, res, p, m); return true; }
    if (p.startsWith("/api/studio/")) {
      const u = await currentUser(req);
      if (!u) fail(res, 401, "Please log in."); else await studioAPI(req, res, u, p, m, url);
      return true;
    }
    if (p.startsWith("/api/control/")) {
      if (!(await isAdmin(req))) fail(res, 401, "Please log in."); else await controlAPI(req, res, p, m, url);
      return true;
    }
    const mm = p.match(/^\/api\/e\/([a-z2-7]{20})(?:\/([a-z]+))?$/);
    if (!mm) fail(res, 404, closedMessage); else await recipientAPI(req, res, mm[1], mm[2] || "", m);
    return true;
  }
  return { route };
};
