/* A Little World — server
   Zero dependencies. Run with:  node server.js   (Node 18+)
   Data lives in ./data (db.json + uploads/). */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const DEFAULTS = require("./public/js/defaults.js");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUB = path.join(ROOT, "public");
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data");
const UPLOADS = path.join(DATA, "uploads");
const DB_FILE = path.join(DATA, "db.json");
fs.mkdirSync(UPLOADS, { recursive: true });

/* ------------------------------------------------------------------ db */
let db = { config: {}, experiences: {} };
try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch { /* first run */ }
db.config = db.config || {};
db.experiences = db.experiences || {};
function save() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB_FILE);
}
const bySlug = (slug) => Object.values(db.experiences).find((e) => e.slug === slug);

/* ---------------------------------------------------------------- auth */
const sessions = new Map(); // token -> expiry
const SESSION_MS = 7 * 24 * 3600 * 1000;
function hashPassword(pw, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString("hex") };
}
function checkPassword(pw) {
  const { salt, hash } = db.config;
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = crypto.scryptSync(String(pw), salt, 64);
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
function isAuthed(req) {
  const t = parseCookies(req).lw_session;
  const exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
function startSession(req, res) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_MS);
  const secure = req.headers["x-forwarded-proto"] === "https" || req.socket.encrypted ? "; Secure" : "";
  res.setHeader("Set-Cookie", `lw_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure}`);
}

/* ---------------------------------------------------------- rate limit */
const buckets = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.n++;
  return b.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k); }, 60000).unref();
const ip = (req) => (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";

/* ---------------------------------------------------------- validation */
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const str = (v, max) => (typeof v === "string" ? v.replace(CTRL, "").slice(0, max) : "");
const arr = (v) => (Array.isArray(v) ? v : []);
const SECTION_IDS = DEFAULTS.SECTIONS.map((s) => s.id);
const ARTS = ["sun", "moon", "tea", "sea", "flower", "stars"];
const PERSONALITIES = ["overthinker", "drama", "main", "softie", "plot", "chaos", "sunshine", "menace"];

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
    photo: typeof s?.photo === "string" && /^\/uploads\/[a-z0-9]+\/[a-z0-9]+\.(jpg|png|webp|gif)$/.test(s.photo) && base && s.photo.startsWith(`/uploads/${base.id}/`) ? s.photo : "",
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
    let id = typeof q?.id === "string" && /^[a-z0-9]{1,16}$/.test(q.id) && !ids.has(q.id) ? q.id : "c" + crypto.randomBytes(5).toString("hex");
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
function cleanUploads(e) {
  const dir = path.join(UPLOADS, e.id);
  if (!fs.existsSync(dir)) return;
  const used = new Set(e.scrapbook.map((s) => s.photo && path.basename(s.photo)).filter(Boolean));
  for (const f of fs.readdirSync(dir)) if (!used.has(f) && Date.now() - fs.statSync(path.join(dir, f)).mtimeMs > 60 * 60 * 1000) fs.rmSync(path.join(dir, f), { force: true });
}
function imageExt(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "webp";
  if (buf.slice(0, 3).toString() === "GIF") return "gif";
  return null;
}
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/* -------------------------------------------------------------- routes */
async function handle(req, res) {
  headers(res);
  const u = new URL(req.url, "http://x");
  const p = decodeURIComponent(u.pathname).replace(/\/+$/, "") || "/";
  const m = req.method;

  // every state-changing API call must carry our header (blocks cross-site form posts)
  if (p.startsWith("/api/") && m !== "GET" && req.headers["x-lw"] !== "1") return fail(res, 403, "forbidden");

  /* ---- pages & static ---- */
  if (m === "GET" && p === "/") { res.writeHead(302, { Location: "/admin" }); return res.end(); }
  if (m === "GET" && p === "/admin") return sendFile(res, path.join(PUB, "admin.html"), { "X-Robots-Tag": "noindex" });
  if (m === "GET" && /^\/surprise\/[^/]+$/.test(p)) return sendFile(res, path.join(PUB, "experience.html"), { "X-Robots-Tag": "noindex" });
  if (m === "GET" && /^\/(css|js|img)\//.test(p)) { const f = safeJoin(PUB, p.slice(1)); return f ? sendFile(res, f) : notFound(res); }
  if (m === "GET" && p.startsWith("/uploads/")) {
    if (!/^\/uploads\/[a-z0-9]+\/[a-z0-9]+\.(jpg|png|webp|gif)$/.test(p)) return notFound(res);
    const f = safeJoin(UPLOADS, p.slice("/uploads/".length));
    return f ? sendFile(res, f, { "Cache-Control": "public, max-age=86400" }) : notFound(res);
  }

  /* ---- auth ---- */
  if (p === "/api/auth/status" && m === "GET") return json(res, 200, { setup: !!db.config.hash, authed: isAuthed(req) });
  if (p === "/api/auth/setup" && m === "POST") {
    if (db.config.hash) return fail(res, 409, "A password is already set.");
    const { password } = await readJSON(req);
    if (typeof password !== "string" || password.length < 8 || password.length > 200) return fail(res, 400, "Use at least 8 characters.");
    db.config = { ...db.config, ...hashPassword(password) }; save();
    startSession(req, res); return json(res, 200, { ok: true });
  }
  if (p === "/api/auth/login" && m === "POST") {
    if (limited("login:" + ip(req), 10, 15 * 60 * 1000)) return fail(res, 429, "Too many attempts. Try again in 15 minutes.");
    const { password } = await readJSON(req);
    if (!checkPassword(password)) return fail(res, 401, "That's not the password.");
    startSession(req, res); return json(res, 200, { ok: true });
  }
  if (p === "/api/auth/logout" && m === "POST") {
    sessions.delete(parseCookies(req).lw_session);
    res.setHeader("Set-Cookie", "lw_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
    return json(res, 200, { ok: true });
  }

  /* ---- public (recipient) API: link = access ---- */
  let mm;
  if ((mm = p.match(/^\/api\/x\/([a-z0-9-]{1,48})(\/[a-z]+)?$/))) {
    const e = bySlug(mm[1]);
    const action = mm[2] || "";
    if (!e) return fail(res, 404, "This little world doesn't exist.");
    if (m === "GET" && !action) return json(res, 200, publicView(e));
    if (m !== "POST") return fail(res, 405, "method not allowed");
    if (limited(`pub:${ip(req)}:${e.id}`, 120, 60 * 1000)) return fail(res, 429, "Slow down a little.");
    const body = await readJSON(req, 64 * 1024);
    const r = (e.responses = e.responses || {});
    const now = new Date().toISOString();

    if (action === "/seen") { r.openedAt = r.openedAt || now; r.lastSeen = now; save(); return json(res, 200, { ok: true }); }
    if (action === "/answers") {
      const valid = new Map(e.questions.filter((q) => q.on).map((q) => [q.id, q]));
      const answers = {};
      if (body.answers && typeof body.answers === "object") {
        for (const [k, v] of Object.entries(body.answers)) if (valid.has(k)) answers[k] = str(v, 1500);
      }
      const index = Number.isInteger(body.index) ? Math.max(0, Math.min(body.index, valid.size)) : 0;
      const qn = { answers, index, updatedAt: now, submittedAt: r.questionnaire?.submittedAt || null };
      if (body.submit === true) qn.submittedAt = now;
      r.questionnaire = qn; save();
      return json(res, 200, { ok: true, submittedAt: qn.submittedAt });
    }
    if (action === "/personality") {
      if (!PERSONALITIES.includes(body.result)) return fail(res, 400, "unknown result");
      const scores = {};
      PERSONALITIES.forEach((k) => { const n = Number(body.scores?.[k]); scores[k] = Number.isFinite(n) ? Math.max(0, Math.min(99, Math.round(n))) : 0; });
      r.personality = { result: body.result, scores, at: now }; save();
      return json(res, 200, { ok: true });
    }
    if (action === "/meter") {
      const score = Number(body.score);
      if (!Number.isFinite(score) || score < 0 || score > 999) return fail(res, 400, "bad score");
      r.meter = { score: Math.round(score), title: str(body.title, 60), at: now }; save();
      return json(res, 200, { ok: true });
    }
    if (action === "/diary" || action === "/wish") {
      const text = str(body.text, action === "/diary" ? 2000 : 500).trim();
      if (!text) return fail(res, 400, "Write something first.");
      const key = action === "/diary" ? "diary" : "wishes";
      r[key] = [...(r[key] || []), { text, at: now }].slice(-200); save();
      return json(res, 200, { ok: true, entries: r[key] });
    }
    return fail(res, 404, "unknown action");
  }

  /* ---- admin API ---- */
  if (p.startsWith("/api/")) {
    if (!isAuthed(req)) return fail(res, 401, "Please log in.");

    if (p === "/api/defaults" && m === "GET") return json(res, 200, { ...DEFAULTS.create(), sectionList: DEFAULTS.SECTIONS });
    if (p === "/api/experiences" && m === "GET") {
      return json(res, 200, Object.values(db.experiences).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(summary));
    }
    if (p === "/api/experiences" && m === "POST") {
      const body = await readJSON(req);
      const clean = sanitizeExperience(body, null);
      if (!clean.name) return fail(res, 400, "Their name is required.");
      let id; do { id = rand(10); } while (db.experiences[id]);
      let slug; do { slug = randomSlug(clean.name); } while (bySlug(slug));
      const now = new Date().toISOString();
      db.experiences[id] = { id, slug, createdAt: now, updatedAt: now, ...clean, scrapbook: clean.scrapbook.map((s) => ({ ...s, photo: "" })), responses: {} };
      save();
      return json(res, 201, adminView(db.experiences[id]));
    }
    if ((mm = p.match(/^\/api\/experiences\/([a-z0-9]{10})(\/[a-z]+)?$/))) {
      const e = db.experiences[mm[1]];
      if (!e) return fail(res, 404, "Not found.");
      const sub = mm[2] || "";
      if (!sub && m === "GET") return json(res, 200, adminView(e));
      if (!sub && m === "PUT") {
        const clean = sanitizeExperience(await readJSON(req), e);
        if (!clean.name) return fail(res, 400, "Their name is required.");
        Object.assign(e, clean, { updatedAt: new Date().toISOString() });
        save(); cleanUploads(e);
        return json(res, 200, adminView(e));
      }
      if (!sub && m === "DELETE") {
        delete db.experiences[e.id]; save();
        fs.rmSync(path.join(UPLOADS, e.id), { recursive: true, force: true });
        return json(res, 200, { ok: true });
      }
      if (sub === "/photos" && m === "POST") {
        const buf = await readBody(req, 8 * 1024 * 1024);
        const ext = imageExt(buf);
        if (!ext) return fail(res, 415, "That file isn't a JPG, PNG, WebP or GIF image.");
        const dir = path.join(UPLOADS, e.id);
        fs.mkdirSync(dir, { recursive: true });
        const name = `${rand(16)}.${ext}`;
        fs.writeFileSync(path.join(dir, name), buf);
        return json(res, 201, { url: `/uploads/${e.id}/${name}` });
      }
      if (sub === "/responses" && m === "DELETE") {
        const keep = { openedAt: e.responses?.openedAt, lastSeen: e.responses?.lastSeen, diary: e.responses?.diary, wishes: e.responses?.wishes };
        e.responses = keep; save();
        return json(res, 200, adminView(e));
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

  return notFound(res);
}

http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    if (res.headersSent) return res.end();
    const code = [400, 413, 415].includes(err.code) ? err.code : 500;
    if (code === 500) console.error(err);
    fail(res, code, code === 413 ? "That's too large." : code === 500 ? "Something went wrong." : err.message);
  });
}).listen(PORT, () => console.log(`A Little World is running → http://localhost:${PORT}/admin`));

module.exports = { sanitizeExperience };
