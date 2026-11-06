/* A Little World — request handler.
   Works as a normal Node server (start-local.js) and as a Vercel serverless function (api/index.js).
   Kept out of the project root on purpose: Vercel treats a root app.js / server.js / index.js as the app entrypoint.
   Storage: MongoDB when MONGODB_URI is set, otherwise ./data on disk. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const DEFAULTS = require("../public/js/defaults.js");

const ROOT = path.join(__dirname, "..");
const PUB = path.join(ROOT, "public");
const ON_VERCEL = !!process.env.VERCEL;
const PHOTO_LIMIT = ON_VERCEL ? 4 * 1024 * 1024 : 8 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB

let store = null, storeError = null;
function getStore() {
  if (store || storeError) return store;
  try {
    if (process.env.MONGODB_URI) store = require("./store-mongo.js")(process.env.MONGODB_URI, process.env.MONGODB_DB || "littleworld");
    else if (ON_VERCEL) storeError = "The database isn't connected yet. In Vercel, open Settings → Environment Variables, add MONGODB_URI, then redeploy.";
    else store = require("./store-file.js")(process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data"));
  } catch (e) { storeError = "Couldn't start storage: " + e.message; }
  return store;
}

/* ---------------------------------------------------------------- auth */
const SESSION_MS = 7 * 24 * 3600 * 1000;
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
function hashPassword(pw, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString("hex") };
}
function checkPassword(cfg, pw) {
  if (!cfg.salt || !cfg.hash) return false;
  const a = Buffer.from(cfg.hash, "hex");
  const b = crypto.scryptSync(String(pw), cfg.salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((c) => {
    const i = c.indexOf("=");
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
async function isAuthed(req) {
  const t = parseCookies(req).lw_session;
  if (!t || !/^[a-f0-9]{64}$/.test(t)) return false;
  return !!(await store.sessionGet(sha(t)));
}
async function startSession(req, res) {
  const token = crypto.randomBytes(32).toString("hex");
  await store.sessionCreate(sha(token), Date.now() + SESSION_MS);
  const secure = req.headers["x-forwarded-proto"] === "https" || req.socket?.encrypted ? "; Secure" : "";
  res.setHeader("Set-Cookie", `lw_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure}`);
}
const ip = (req) => (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "?";

/* ---------------------------------------------------------- validation */
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const str = (v, max) => (typeof v === "string" ? v.replace(CTRL, "").slice(0, max) : "");
const arr = (v) => (Array.isArray(v) ? v : []);
const SECTION_IDS = DEFAULTS.SECTIONS.map((s) => s.id);
const ARTS = ["sun", "moon", "tea", "sea", "flower", "stars"];
const PERSONALITIES = ["overthinker", "drama", "main", "softie", "plot", "chaos", "sunshine", "menace"];
const PHOTO_RE = /^\/uploads\/[a-z0-9]+\/[a-z0-9]+\.(jpg|png|webp|gif)$/;

function strList(v, max, maxLen, fallback, exact) {
  let out = arr(v).map((x) => str(x, maxLen).trim()).filter(Boolean).slice(0, max);
  if (exact) { out = out.slice(0, exact); while (out.length < exact) out.push(fallback[out.length] || ""); }
  return out.length ? out : fallback.slice();
}

function sanitizeExperience(input, base) {
  const d = DEFAULTS.create();
  const src = input && typeof input === "object" ? input : {};
  const prev = base || d;
  const pick = (k) => (k in src ? src[k] : prev[k]);
  const out = {};

  out.name = str(pick("name"), 60).trim();
  out.from = str(pick("from"), 60).trim();
  out.phone = str(pick("phone"), 20).replace(/\D/g, "").slice(0, 15);
  out.note = str(pick("note"), 3000).trim();
  out.finalMessage = str(pick("finalMessage"), 600).trim() || d.finalMessage;

  const seen = new Set();
  out.sections = arr(pick("sections"))
    .filter((s) => s && SECTION_IDS.includes(s.id) && !seen.has(s.id) && seen.add(s.id))
    .map((s) => ({ id: s.id, on: s.on !== false }));
  SECTION_IDS.forEach((id) => { if (!seen.has(id)) out.sections.push({ id, on: true }); });

  out.compliments = strList(pick("compliments"), 40, 400, d.compliments);
  const bq = pick("bouquet") || {};
  out.bouquet = {
    messages: strList(bq.messages, 9, 300, d.bouquet.messages, 9),
    letter: str(bq.letter, 4000).trim() || d.bouquet.letter,
  };
  out.garden = strList(pick("garden"), 12, 300, d.garden, 12);
  out.stars = strList(pick("stars"), 9, 200, d.stars, 9);
  out.letters = d.letters.map((def, i) => {
    const l = arr(pick("letters"))[i] || {};
    return { title: str(l.title, 80).trim() || def.title, text: str(l.text, 3000).trim() || def.text };
  });
  out.scrapbook = arr(pick("scrapbook")).slice(0, 12).map((s, i) => ({
    photo: typeof s?.photo === "string" && PHOTO_RE.test(s.photo) && base && s.photo.startsWith(`/uploads/${base.id}/`) ? s.photo : "",
    caption: str(s?.caption, 120).trim(),
    note: str(s?.note, 120).trim(),
    art: ARTS.includes(s?.art) ? s.art : ARTS[i % ARTS.length],
  }));
  out.gift = str(pick("gift"), 1000).trim() || d.gift;
  const wh = pick("wheel") || {};
  out.wheel = {
    dares: strList(wh.dares, 30, 300, d.wheel.dares),
    secrets: strList(wh.secrets, 30, 300, d.wheel.secrets),
    surprises: strList(wh.surprises, 30, 300, d.wheel.surprises),
  };
  out.wishReplies = strList(pick("wishReplies"), 30, 300, d.wishReplies);
  out.meter = d.meter.map((def, i) => {
    const m = arr(pick("meter"))[i] || {};
    return { title: str(m.title, 60).trim() || def.title, text: str(m.text, 300).trim() || def.text };
  });
  out.secretButton = str(pick("secretButton"), 500).trim() || d.secretButton;

  const ids = new Set();
  out.questions = arr(pick("questions")).slice(0, 150).map((q) => {
    const id = typeof q?.id === "string" && /^[a-z0-9]{1,16}$/.test(q.id) && !ids.has(q.id) ? q.id : "c" + crypto.randomBytes(5).toString("hex");
    ids.add(id);
    const options = arr(q?.options).slice(0, 6)
      .map((o) => ({ t: str(o?.t, 140).trim(), r: str(o?.r, 160).trim() }))
      .filter((o) => o.t);
    const type = q?.type === "choice" && options.length >= 2 ? "choice" : "text";
    return { id, cat: str(q?.cat, 40).trim() || "Questions", q: str(q?.q, 300).trim(), type, options: type === "choice" ? options : [], on: q?.on !== false };
  }).filter((q) => q.q);

  return out;
}

/* ------------------------------------------------------------- helpers */
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function headers(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", CSP);
}
function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
const fail = (res, code, msg) => json(res, code, { error: msg });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error("too large"), { code: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function readJSON(req, limit = 256 * 1024) {
  if (!(req.headers["content-type"] || "").startsWith("application/json")) throw Object.assign(new Error("expected json"), { code: 415 });
  const buf = await readBody(req, limit);
  try { return JSON.parse(buf.toString("utf8") || "{}"); } catch { throw Object.assign(new Error("bad json"), { code: 400 }); }
}

function sendFile(res, file, extra = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-cache", ...extra });
    fs.createReadStream(file).pipe(res);
  });
}
function safeJoin(base, rel) {
  const p = path.resolve(base, "." + path.sep + rel);
  return p.startsWith(base + path.sep) ? p : null;
}
function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

const rand = (n) => crypto.randomBytes(n).toString("hex").slice(0, n);
const slugify = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "friend";
const randomSlug = (name) => `${slugify(name)}-${crypto.randomBytes(4).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 6).padEnd(6, "x")}`;

function summary(e) {
  const qn = e.responses?.questionnaire;
  const active = e.questions.filter((q) => q.on);
  return {
    id: e.id, slug: e.slug, name: e.name, from: e.from, note: e.note, createdAt: e.createdAt, updatedAt: e.updatedAt,
    answered: qn ? active.filter((q) => (qn.answers?.[q.id] || "").trim()).length : 0,
    totalQuestions: active.length,
    submittedAt: qn?.submittedAt || null,
    personality: e.responses?.personality?.result || null,
    openedAt: e.responses?.openedAt || null,
    lastSeen: e.responses?.lastSeen || null,
  };
}
function adminView(e) {
  const { diary, wishes, ...rest } = e.responses || {};
  return { ...e, responses: { ...rest, diaryCount: (diary || []).length, wishCount: (wishes || []).length } };
}
function publicView(e) {
  const r = e.responses || {};
  return {
    id: e.id, slug: e.slug, name: e.name, from: e.from, phone: e.phone, note: e.note, finalMessage: e.finalMessage,
    sections: e.sections, compliments: e.compliments, bouquet: e.bouquet, garden: e.garden, letters: e.letters,
    scrapbook: e.scrapbook, gift: e.gift, wheel: e.wheel, stars: e.stars, wishReplies: e.wishReplies, meter: e.meter,
    secretButton: e.secretButton, questions: e.questions.filter((q) => q.on),
    progress: { questionnaire: r.questionnaire || null, personality: r.personality || null, meter: r.meter || null, diary: r.diary || [], wishes: r.wishes || [] },
  };
}
function imageExt(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "webp";
  if (buf.slice(0, 3).toString() === "GIF") return "gif";
  return null;
}
// a leading ' stops spreadsheets running text that starts with = + - @ as a formula
const csvCell = (v) => { const s = String(v ?? ""); return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`; };

const platform = require("./platform.js")({
  json, fail, readJSON, readBody, parseCookies, sha, ip, str, arr, imageExt, csvCell, MIME, notFound, sendFile, PHOTO_LIMIT,
  isAdmin: (req) => isAuthed(req),
  legacyAdminFile: path.join(PUB, "admin.html"),
  store: () => getStore(),
  storeError: () => storeError,
});

/* -------------------------------------------------------------- routes */
async function handle(req, res) {
  headers(res);
  const u = new URL(req.url, "http://x");
  const p = decodeURIComponent(u.pathname).replace(/\/+$/, "") || "/";
  const m = req.method;

  // every state-changing API call must carry our header (blocks cross-site form posts)
  if (p.startsWith("/api/") && m !== "GET" && req.headers["x-lw"] !== "1") return fail(res, 403, "forbidden");

  /* ---- static + original experience links (no storage needed) ---- */
  if (m === "GET" && /^\/surprise\/[^/]+$/.test(p)) return sendFile(res, path.join(PUB, "experience.html"), { "X-Robots-Tag": "noindex" });
  if (m === "GET" && /^\/(css|js|img)\//.test(p)) { const f = safeJoin(PUB, p.slice(1)); return f ? sendFile(res, f) : notFound(res); }

  /* ---- the envelope platform: landing, /create, /studio, /admin, /envelope, and their APIs ---- */
  getStore();
  if (await platform.route(req, res, u, p, m)) return;

  if (!p.startsWith("/api/") && !p.startsWith("/uploads/")) return notFound(res);
  if (!getStore()) return fail(res, 503, storeError);

  if (m === "GET" && p.startsWith("/uploads/")) {
    const mm = p.match(/^\/uploads\/([a-z0-9]+)\/([a-z0-9]+\.(jpg|png|webp|gif))$/);
    if (!mm) return notFound(res);
    const buf = await store.photoGet(mm[1], mm[2]);
    if (!buf) return notFound(res);
    res.writeHead(200, { "Content-Type": MIME["." + mm[3]], "Content-Length": buf.length, "Cache-Control": "public, max-age=86400" });
    return res.end(buf);
  }

  /* ---- auth ---- */
  if (p === "/api/auth/status" && m === "GET") {
    const cfg = await store.getConfig();
    return json(res, 200, { setup: !!cfg.hash, authed: await isAuthed(req) });
  }
  if (p === "/api/auth/setup" && m === "POST") {
    if ((await store.getConfig()).hash) return fail(res, 409, "A password is already set.");
    const { password, setupKey } = await readJSON(req);
    // online, a brand-new database must not let the first visitor claim the admin panel
    if (store.kind !== "file") {
      const key = process.env.ADMIN_SETUP_KEY;
      if (!key) return fail(res, 403, "Set ADMIN_SETUP_KEY in your hosting settings first, then redeploy and try again.");
      if (await store.hit("setup:" + ip(req), 10, 15 * 60 * 1000)) return fail(res, 429, "Too many attempts. Try again in 15 minutes.");
      const a = sha(String(setupKey ?? "")), b = sha(key);
      if (!crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))) return fail(res, 403, "That setup key isn't right.");
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 200) return fail(res, 400, "Use at least 8 characters.");
    await store.setConfig(hashPassword(password));
    await startSession(req, res); return json(res, 200, { ok: true });
  }
  if (p === "/api/auth/login" && m === "POST") {
    if (await store.hit("login:" + ip(req), 10, 15 * 60 * 1000)) return fail(res, 429, "Too many attempts. Try again in 15 minutes.");
    const { password } = await readJSON(req);
    if (!checkPassword(await store.getConfig(), password)) return fail(res, 401, "That's not the password.");
    await startSession(req, res); return json(res, 200, { ok: true });
  }
  if (p === "/api/auth/logout" && m === "POST") {
    const t = parseCookies(req).lw_session;
    if (t) await store.sessionDelete(sha(t));
    res.setHeader("Set-Cookie", "lw_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
    return json(res, 200, { ok: true });
  }

  /* ---- public (recipient) API: link = access ---- */
  let mm;
  if ((mm = p.match(/^\/api\/x\/([a-z0-9-]{1,48})(\/[a-z]+)?$/))) {
    const e = await store.bySlug(mm[1]);
    const action = mm[2] || "";
    if (!e || e.disabled) return fail(res, 404, "This little world doesn't exist.");
    if (m === "GET" && !action) return json(res, 200, publicView(e));
    if (m !== "POST") return fail(res, 405, "method not allowed");
    if (await store.hit(`pub:${ip(req)}:${e.id}`, 120, 60 * 1000)) return fail(res, 429, "Slow down a little.");
    const body = await readJSON(req, 64 * 1024);
    const r = e.responses || {};
    const now = new Date().toISOString();

    if (action === "/seen") {
      if (!r.openedAt) await store.setResponse(e.id, "openedAt", now);
      await store.setResponse(e.id, "lastSeen", now);
      return json(res, 200, { ok: true });
    }
    if (action === "/answers") {
      const valid = new Map(e.questions.filter((q) => q.on).map((q) => [q.id, q]));
      const answers = {};
      if (body.answers && typeof body.answers === "object") {
        for (const [k, v] of Object.entries(body.answers)) if (valid.has(k)) answers[k] = str(v, 1500);
      }
      const index = Number.isInteger(body.index) ? Math.max(0, Math.min(body.index, valid.size)) : 0;
      const qn = { answers, index, updatedAt: now, submittedAt: r.questionnaire?.submittedAt || null };
      if (body.submit === true) qn.submittedAt = now;
      await store.setResponse(e.id, "questionnaire", qn);
      return json(res, 200, { ok: true, submittedAt: qn.submittedAt });
    }
    if (action === "/personality") {
      if (!PERSONALITIES.includes(body.result)) return fail(res, 400, "unknown result");
      const scores = {};
      PERSONALITIES.forEach((k) => { const n = Number(body.scores?.[k]); scores[k] = Number.isFinite(n) ? Math.max(0, Math.min(99, Math.round(n))) : 0; });
      await store.setResponse(e.id, "personality", { result: body.result, scores, at: now });
      return json(res, 200, { ok: true });
    }
    if (action === "/meter") {
      const score = Number(body.score);
      if (!Number.isFinite(score) || score < 0 || score > 999) return fail(res, 400, "bad score");
      await store.setResponse(e.id, "meter", { score: Math.round(score), title: str(body.title, 60), at: now });
      return json(res, 200, { ok: true });
    }
    if (action === "/diary" || action === "/wish") {
      const text = str(body.text, action === "/diary" ? 2000 : 500).trim();
      if (!text) return fail(res, 400, "Write something first.");
      const entries = await store.pushResponse(e.id, action === "/diary" ? "diary" : "wishes", { text, at: now }, 200);
      return json(res, 200, { ok: true, entries });
    }
    return fail(res, 404, "unknown action");
  }

  /* ---- admin API ---- */
  if (!(await isAuthed(req))) return fail(res, 401, "Please log in.");

  if (p === "/api/defaults" && m === "GET") return json(res, 200, { ...DEFAULTS.create(), sectionList: DEFAULTS.SECTIONS });
  if (p === "/api/experiences" && m === "GET") {
    return json(res, 200, (await store.list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(summary));
  }
  if (p === "/api/experiences" && m === "POST") {
    const clean = sanitizeExperience(await readJSON(req), null);
    if (!clean.name) return fail(res, 400, "Their name is required.");
    let id; do { id = rand(10); } while (await store.get(id));
    let slug; do { slug = randomSlug(clean.name); } while (await store.bySlug(slug));
    const now = new Date().toISOString();
    const e = { id, slug, createdAt: now, updatedAt: now, ...clean, scrapbook: clean.scrapbook.map((s) => ({ ...s, photo: "" })), responses: {} };
    await store.put(e);
    return json(res, 201, adminView(e));
  }
  if ((mm = p.match(/^\/api\/experiences\/([a-z0-9]{10})(\/[a-z]+)?$/))) {
    const e = await store.get(mm[1]);
    if (!e) return fail(res, 404, "Not found.");
    const sub = mm[2] || "";
    if (!sub && m === "GET") return json(res, 200, adminView(e));
    if (!sub && m === "PUT") {
      const clean = sanitizeExperience(await readJSON(req), e);
      if (!clean.name) return fail(res, 400, "Their name is required.");
      // re-read responses so an answer saved while editing isn't overwritten
      const fresh = await store.get(e.id);
      const next = { ...fresh, ...clean, updatedAt: new Date().toISOString() };
      await store.put(next);
      await store.photoCleanup(e.id, new Set(next.scrapbook.map((s) => s.photo && path.basename(s.photo)).filter(Boolean)));
      return json(res, 200, adminView(next));
    }
    if (!sub && m === "DELETE") { await store.remove(e.id); return json(res, 200, { ok: true }); }
    if (sub === "/photos" && m === "POST") {
      const buf = await readBody(req, PHOTO_LIMIT);
      const ext = imageExt(buf);
      if (!ext) return fail(res, 415, "That file isn't a JPG, PNG, WebP or GIF image.");
      const name = `${rand(16)}.${ext}`;
      await store.photoSave(e.id, name, buf);
      return json(res, 201, { url: `/uploads/${e.id}/${name}` });
    }
    if (sub === "/responses" && m === "DELETE") {
      const r = e.responses || {};
      const keep = { openedAt: r.openedAt, lastSeen: r.lastSeen, diary: r.diary, wishes: r.wishes };
      Object.keys(keep).forEach((k) => keep[k] === undefined && delete keep[k]);
      await store.setResponses(e.id, keep);
      return json(res, 200, adminView({ ...e, responses: keep }));
    }
    if (sub === "/export" && m === "GET") {
      const r = e.responses || {};
      const ans = r.questionnaire?.answers || {};
      const file = `${slugify(e.name)}-answers`;
      if (u.searchParams.get("format") === "json") {
        const out = {
          name: e.name, exportedAt: new Date().toISOString(), openedAt: r.openedAt || null, submittedAt: r.questionnaire?.submittedAt || null,
          answers: e.questions.map((q) => ({ category: q.cat, question: q.q, answer: ans[q.id] || "" })),
          personality: r.personality || null, friendshipMeter: r.meter || null,
        };
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.json"` });
        return res.end(JSON.stringify(out, null, 2));
      }
      const rows = [["Category", "Question", "Answer"].map(csvCell).join(",")];
      e.questions.forEach((q) => rows.push([q.cat, q.q, ans[q.id] || ""].map(csvCell).join(",")));
      if (r.personality) rows.push(["Personality quiz", "Result", r.personality.result].map(csvCell).join(","));
      if (r.meter) rows.push(["Friendship meter", "Score", `${r.meter.score}% — ${r.meter.title}`].map(csvCell).join(","));
      res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.csv"` });
      return res.end("﻿" + rows.join("\r\n"));
    }
  }
  return fail(res, 404, "Not found.");
}

function handler(req, res) {
  return handle(req, res).catch((err) => {
    if (res.headersSent) return res.end();
    const code = [400, 413, 415].includes(err.code) ? err.code : 500;
    if (code === 500) console.error(err);
    fail(res, code, code === 413 ? "That's too large." : code === 500 ? "Something went wrong." : err.message);
  });
}

// export the handler itself, so any host that expects a request function can use this file directly
module.exports = handler;
module.exports.handler = handler;
module.exports.sanitizeExperience = sanitizeExperience;
