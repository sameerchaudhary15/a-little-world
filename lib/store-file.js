/* File storage: data/db.json + data/uploads/. Used when MONGODB_URI is not set (running on your own computer). */
"use strict";
const fs = require("fs");
const path = require("path");

module.exports = function fileStore(DATA) {
  const UPLOADS = path.join(DATA, "uploads");
  const FILE = path.join(DATA, "db.json");
  fs.mkdirSync(UPLOADS, { recursive: true });

  let db = {};
  try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { /* first run */ }
  db.config = db.config || {};
  db.experiences = db.experiences || {};
  db.sessions = db.sessions || {};
  const save = () => { const t = FILE + ".tmp"; fs.writeFileSync(t, JSON.stringify(db, null, 1)); fs.renameSync(t, FILE); };
  const clone = (o) => (o == null ? null : JSON.parse(JSON.stringify(o)));
  const buckets = new Map();
  const coll = (c) => (db[c] = db[c] || {});
  const matches = (doc, filter) => Object.entries(filter || {}).every(([k, v]) => doc[k] === v);

  return {
    kind: "file",

    /* generic documents: users, usessions, envelopes, responses, stats */
    async docGet(c, id) { return clone(coll(c)[id]); },
    async docInsert(c, id, doc, uniqueField) {
      if (coll(c)[id]) throw Object.assign(new Error("duplicate"), { dup: true });
      if (uniqueField && Object.values(coll(c)).some((d) => d[uniqueField] === doc[uniqueField])) throw Object.assign(new Error("duplicate"), { dup: true });
      coll(c)[id] = { ...clone(doc), id }; save();
    },
    async docPut(c, id, doc) { coll(c)[id] = { ...clone(doc), id }; save(); },
    async docSet(c, id, patch) { const d = coll(c)[id]; if (d) { Object.assign(d, clone(patch)); save(); } },
    async docInc(c, id, deltas, extra) {
      if (!coll(c)[id] && c !== "stats") return;
      const d = (coll(c)[id] = coll(c)[id] || { id });
      for (const [k, n] of Object.entries(deltas)) d[k] = (d[k] || 0) + n;
      if (extra) Object.assign(d, clone(extra));
      save();
    },
    async docDel(c, id) { if (coll(c)[id]) { delete coll(c)[id]; save(); } },
    async docDelMany(c, filter) {
      for (const [id, d] of Object.entries(coll(c))) if (matches(d, filter)) delete coll(c)[id];
      save();
    },
    async docList(c, filter) { return Object.values(coll(c)).filter((d) => matches(d, filter)).map(clone); },
    async docFindOne(c, filter) { return clone(Object.values(coll(c)).find((d) => matches(d, filter))); },
    async docCount(c, filter) { return Object.values(coll(c)).filter((d) => matches(d, filter)).length; },
    async docSweep(c) {
      const now = Date.now();
      for (const [id, d] of Object.entries(coll(c))) if (d.exp && d.exp < now) delete coll(c)[id];
      save();
    },
    async photoDelete(expId, name) { fs.rmSync(path.join(UPLOADS, expId, name), { force: true }); },
    async photoDeleteAll(expId) { fs.rmSync(path.join(UPLOADS, expId), { recursive: true, force: true }); },

    async getConfig() { return clone(db.config); },
    async setConfig(v) { db.config = { ...db.config, ...v }; save(); },

    async list() { return Object.values(db.experiences).map(clone); },
    async get(id) { return clone(db.experiences[id]); },
    async bySlug(slug) { return clone(Object.values(db.experiences).find((e) => e.slug === slug)); },
    async put(e) { db.experiences[e.id] = clone(e); save(); },
    async remove(id) { delete db.experiences[id]; save(); fs.rmSync(path.join(UPLOADS, id), { recursive: true, force: true }); },
    async setResponse(id, key, val) {
      const e = db.experiences[id]; if (!e) return;
      e.responses = e.responses || {}; e.responses[key] = val; save();
    },
    async pushResponse(id, key, entry, cap) {
      const e = db.experiences[id]; if (!e) return [];
      e.responses = e.responses || {};
      e.responses[key] = [...(e.responses[key] || []), entry].slice(-cap); save();
      return clone(e.responses[key]);
    },
    async setResponses(id, r) { const e = db.experiences[id]; if (e) { e.responses = r; save(); } },

    async sessionCreate(key, expires) {
      const now = Date.now();
      for (const [k, v] of Object.entries(db.sessions)) if (v < now) delete db.sessions[k];
      db.sessions[key] = expires; save();
    },
    async sessionGet(key) { const v = db.sessions[key]; return v && v > Date.now() ? v : null; },
    async sessionDelete(key) { if (db.sessions[key]) { delete db.sessions[key]; save(); } },

    async hit(key, max, windowMs) {
      const now = Date.now();
      let b = buckets.get(key);
      if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
      b.n++;
      if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
      return b.n > max;
    },

    async photoSave(expId, name, buf) {
      const dir = path.join(UPLOADS, expId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name), buf);
    },
    async photoGet(expId, name) {
      try { return fs.readFileSync(path.join(UPLOADS, expId, name)); } catch { return null; }
    },
    async photoCleanup(expId, used) {
      const dir = path.join(UPLOADS, expId);
      if (!fs.existsSync(dir)) return;
      for (const f of fs.readdirSync(dir)) {
        if (!used.has(f) && Date.now() - fs.statSync(path.join(dir, f)).mtimeMs > 3600e3) fs.rmSync(path.join(dir, f), { force: true });
      }
    },
  };
};
