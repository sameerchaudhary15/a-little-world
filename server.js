/* A Little World — local server.  Run:  node server.js   (Node 18+)
   Without MONGODB_URI, data is saved in ./data (db.json + uploads/).
   On Vercel, api/index.js is used instead of this file. */
"use strict";
const http = require("http");
const { handler } = require("./app.js");

const PORT = Number(process.env.PORT) || 3000;
http.createServer(handler).listen(PORT, () => console.log(`A Little World is running → http://localhost:${PORT}/admin`));
