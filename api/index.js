// Vercel serverless entry: every request that isn't a static file lands here (see vercel.json).
module.exports = require("../app.js").handler;
