/* MongoDB storage (MongoDB Atlas free tier works). Used when MONGODB_URI is set, e.g. on Vercel.
   Collections: config, experiences, sessions, ratelimits, photos. */
"use strict";
const { MongoClient } = require("mongodb");

module.exports = function mongoStore(uri, dbName = "littleworld") {
  // reuse one connection across serverless invocations
  if (!global.__lwMongo) {
    const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
    global.__lwMongo = client.connect().then(async (c) => {
      const d = c.db(dbName);
      await Promise.all([
        d.collection("experiences").createIndex({ slug: 1 }, { unique: true }),
        d.collection("sessions").createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
        d.collection("ratelimits").createIndex({ reset: 1 }, { expireAfterSeconds: 0 }),
        d.collection("photos").createIndex({ exp: 1 }),
        d.collection("users").createIndex({ email: 1 }, { unique: true }),
        d.collection("usessions").createIndex({ userId: 1 }),
        d.collection("usessions").createIndex({ _ttl: 1 }, { expireAfterSeconds: 0 }),
        d.collection("resets").createIndex({ _ttl: 1 }, { expireAfterSeconds: 0 }),
        d.collection("envelopes").createIndex({ slug: 1 }, { unique: true }),
        d.collection("envelopes").createIndex({ ownerId: 1, updatedAt: -1 }),
        d.collection("responses").createIndex({ envelopeId: 1 }),
        d.collection("responses").createIndex({ ownerId: 1 }),
      ]).catch((e) => console.error("Index setup:", e.message));
      return d;
    }).catch((err) => { global.__lwMongo = null; throw err; });
  }
  const col = async (name) => (await global.__lwMongo).collection(name);
  const toExp = (doc) => { if (!doc) return null; const { _id, ...rest } = doc; return { id: _id, ...rest }; };
  // generic documents: `exp` (ms) is mirrored to a real Date so MongoDB's TTL index can expire them
  const toDoc = (doc) => { if (!doc) return null; const { _id, _ttl, ...rest } = doc; return { ...rest, id: _id }; };
  const toRaw = (doc) => { const { id, _id, ...rest } = doc; if (rest.exp) rest._ttl = new Date(rest.exp); return rest; };

  return {
    kind: "mongo",

    async docGet(c, id) { return toDoc(await (await col(c)).findOne({ _id: id })); },
    async docInsert(c, id, doc) {
      try { await (await col(c)).insertOne({ _id: id, ...toRaw(doc) }); }
      catch (e) { if (e.code === 11000) throw Object.assign(new Error("duplicate"), { dup: true }); throw e; }
    },
    async docPut(c, id, doc) { await (await col(c)).replaceOne({ _id: id }, toRaw(doc), { upsert: true }); },
    async docSet(c, id, patch) { await (await col(c)).updateOne({ _id: id }, { $set: patch }); },
    async docInc(c, id, deltas, extra) {
      await (await col(c)).updateOne({ _id: id }, { $inc: deltas, ...(extra ? { $set: extra } : {}) }, { upsert: c === "stats" });
    },
    async docDel(c, id) { await (await col(c)).deleteOne({ _id: id }); },
    async docDelMany(c, filter) { await (await col(c)).deleteMany(filter || {}); },
    async docList(c, filter) { return (await (await col(c)).find(filter || {}).toArray()).map(toDoc); },
    async docFindOne(c, filter) { return toDoc(await (await col(c)).findOne(filter || {})); },
    async docCount(c, filter) { return (await col(c)).countDocuments(filter || {}); },
    async docSweep() { /* handled by the TTL index */ },
    async photoDelete(expId, name) { await (await col("photos")).deleteOne({ _id: `${expId}/${name}` }); },
    async photoDeleteAll(expId) { await (await col("photos")).deleteMany({ exp: expId }); },

    async getConfig() {
      const c = await (await col("config")).findOne({ _id: "main" });
      if (!c) return {};
      const { _id, ...rest } = c; return rest;
    },
    async setConfig(v) { await (await col("config")).updateOne({ _id: "main" }, { $set: v }, { upsert: true }); },

    async list() { return (await (await col("experiences")).find({}).toArray()).map(toExp); },
    async get(id) { return toExp(await (await col("experiences")).findOne({ _id: id })); },
    async bySlug(slug) { return toExp(await (await col("experiences")).findOne({ slug })); },
    async put(e) { const { id, ...rest } = e; await (await col("experiences")).replaceOne({ _id: id }, rest, { upsert: true }); },
    async remove(id) {
      await (await col("experiences")).deleteOne({ _id: id });
      await (await col("photos")).deleteMany({ exp: id });
    },
    async setResponse(id, key, val) { await (await col("experiences")).updateOne({ _id: id }, { $set: { [`responses.${key}`]: val } }); },
    async pushResponse(id, key, entry, cap) {
      const doc = await (await col("experiences")).findOneAndUpdate(
        { _id: id },
        { $push: { [`responses.${key}`]: { $each: [entry], $slice: -cap } } },
        { returnDocument: "after" },
      );
      return doc?.responses?.[key] || [];
    },
    async setResponses(id, r) { await (await col("experiences")).updateOne({ _id: id }, { $set: { responses: r } }); },

    async sessionCreate(key, expires) { await (await col("sessions")).insertOne({ _id: key, expires: new Date(expires) }); },
    async sessionGet(key) {
      const s = await (await col("sessions")).findOne({ _id: key });
      return s && s.expires.getTime() > Date.now() ? s.expires.getTime() : null;
    },
    async sessionDelete(key) { await (await col("sessions")).deleteOne({ _id: key }); },

    // fixed-window counter shared by every serverless instance
    async hit(key, max, windowMs) {
      const now = new Date(), next = new Date(Date.now() + windowMs);
      const expired = { $or: [{ $eq: [{ $type: "$reset" }, "missing"] }, { $lt: ["$reset", now] }] };
      const doc = await (await col("ratelimits")).findOneAndUpdate(
        { _id: key },
        [{ $set: { n: { $cond: [expired, 1, { $add: ["$n", 1] }] }, reset: { $cond: [expired, next, "$reset"] } } }],
        { upsert: true, returnDocument: "after" },
      );
      return (doc?.n || 1) > max;
    },

    async photoSave(expId, name, buf) {
      await (await col("photos")).insertOne({ _id: `${expId}/${name}`, exp: expId, data: buf, at: new Date() });
    },
    async photoGet(expId, name) {
      const p = await (await col("photos")).findOne({ _id: `${expId}/${name}` });
      return p ? Buffer.from(p.data.buffer ?? p.data) : null;
    },
    async photoCleanup(expId, used) {
      await (await col("photos")).deleteMany({
        exp: expId,
        _id: { $nin: [...used].map((n) => `${expId}/${n}`) },
        at: { $lt: new Date(Date.now() - 3600e3) },
      });
    },
  };
};
