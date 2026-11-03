// Vercel serverless entry: every request that isn't a static file lands here (see vercel.json).
// If the app fails to load, say why instead of Vercel's generic FUNCTION_INVOCATION_FAILED page.
let handler = null, loadError = null;
try { handler = require("../lib/app.js"); } catch (e) { loadError = e; console.error("Startup failed:", e); }

module.exports = (req, res) => {
  if (loadError) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end(`A Little World couldn't start.\n\n${loadError.stack || loadError.message}`);
  }
  return handler(req, res);
};
