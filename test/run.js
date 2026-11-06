/* End-to-end API tests. Starts the server on a spare port with a throwaway data folder.
   Run:  node test/run.js */
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = 3900 + Math.floor(Math.random() * 90);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lw-test-"));
const BASE = `http://127.0.0.1:${PORT}`;
let cookie = "";
let passed = 0, failed = 0;

function ok(cond, name, extra) {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra !== undefined ? "  → " + JSON.stringify(extra).slice(0, 300) : "")); }
}
async function req(method, url, { body, raw, type, auth = true, csrf = true } = {}) {
  const headers = {};
  if (csrf) headers["X-LW"] = "1";
  if (auth && cookie) headers.Cookie = cookie;
  let payload;
  if (raw) { payload = raw; headers["Content-Type"] = type; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers["Content-Type"] = "application/json"; }
  const r = await fetch(BASE + url, { method, headers, body: payload, redirect: "manual" });
  const sc = r.headers.get("set-cookie");
  if (sc && sc.startsWith("lw_session=") && auth) cookie = sc.split(";")[0];
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text, headers: r.headers };
}

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "start-local.js")], { env: { ...process.env, PORT, DATA_DIR: DATA, ADMIN_SETUP_KEY: "test-setup-key" }, stdio: ["ignore", "pipe", "pipe"] });
  srv.stderr.on("data", (d) => process.stderr.write(d));
  await new Promise((res) => srv.stdout.on("data", (d) => String(d).includes("running") && res()));

  try {
    console.log("\nPages & static");
    let r = await req("GET", "/");
    ok(r.status === 200 && r.text.includes("A Little World"), "/ is the public landing page");
    r = await req("GET", "/admin/worlds");
    ok(r.status === 200 && r.text.includes("A Little World") && !r.text.includes("developed by Sameer"), "admin page served, no watermark on admin");
    r = await req("GET", "/surprise/whatever-abc123");
    ok(r.status === 200 && r.text.includes("The site is developed by Sameer ♡"), "experience page served with watermark");
    ok((r.headers.get("content-security-policy") || "").includes("default-src 'self'"), "security headers present");
    r = await req("GET", "/js/../../server.js");
    ok(r.status === 404, "path traversal blocked (js)");
    r = await req("GET", "/uploads/../db.json");
    ok(r.status === 404, "path traversal blocked (uploads)");
    for (const f of ["/js/world-core.js", "/js/world-sections.js", "/js/world-play.js", "/js/world-boot.js", "/js/admin.js", "/js/flowers.js", "/js/defaults.js", "/css/world.css", "/css/admin.css", "/css/styles.css"]) {
      r = await req("GET", f); ok(r.status === 200, `asset ${f}`);
    }

    console.log("\nAuth & permissions");
    r = await req("GET", "/api/auth/status");
    ok(r.json && r.json.setup === false && r.json.authed === false, "fresh install needs setup");
    r = await req("GET", "/api/experiences", { auth: false });
    ok(r.status === 401, "admin list requires login");
    r = await req("POST", "/api/auth/setup", { body: { password: "short", setupKey: "test-setup-key" } });
    ok(r.status === 400, "setup rejects short password");
    r = await req("POST", "/api/auth/setup", { body: { password: "correct horse battery" }, csrf: false });
    ok(r.status === 403, "state-changing request without X-LW header is refused");
    r = await req("POST", "/api/auth/setup", { body: { password: "correct horse battery", setupKey: "test-setup-key" } });
    ok(r.status === 200 && cookie, "setup sets password and logs in");
    const goodCookie = cookie;
    r = await req("POST", "/api/auth/setup", { body: { password: "another password" } });
    ok(r.status === 409, "setup can't be run twice");
    cookie = "";
    r = await req("POST", "/api/auth/login", { body: { password: "wrong password" } });
    ok(r.status === 401, "wrong password refused");
    r = await req("POST", "/api/auth/login", { body: { password: "correct horse battery" } });
    ok(r.status === 200 && cookie && cookie !== goodCookie, "correct password logs in");
    r = await req("GET", "/api/auth/status");
    ok(r.json.authed === true, "session recognised");

    console.log("\nCreate & validate experiences");
    r = await req("POST", "/api/experiences", { body: { name: "   " } });
    ok(r.status === 400, "name is required");
    r = await req("POST", "/api/experiences", { body: { name: "Anjali", from: "Sameer", phone: "+91 98765-43210" } });
    ok(r.status === 201, "create experience", r.json);
    const exp = r.json;
    ok(/^anjali-[a-z0-9]{6}$/.test(exp.slug), "unguessable slug " + exp.slug);
    ok(exp.phone === "919876543210", "phone normalised to digits");
    ok(exp.questions.length === 53 && exp.questions.filter((q) => /^q\d+$/.test(q.id)).length === 50, "50 bank questions + 3 multiple choice");
    ok(exp.letters.length === 5 && exp.garden.length === 12 && exp.bouquet.messages.length === 9 && exp.stars.length === 9, "letters, garden, bouquet, stars defaults");

    const evil = {
      ...exp,
      name: "Anjali Sharma",
      note: "x".repeat(5000),
      sections: [{ id: "garden", on: false }, { id: "hacker", on: true }, { id: "garden", on: true }],
      compliments: ["ok", 42, "", "<script>alert(1)</script>"],
      scrapbook: [{ photo: "/uploads/../../etc/passwd", caption: "a", art: "nope" }, { photo: "https://evil.example/x.jpg", caption: "b" }],
      questions: [...exp.questions.slice(0, 2), { id: "../bad", q: "Custom?", type: "choice", options: [{ t: "only one" }] }, { q: "" }],
      bouquet: { messages: ["one"], letter: "" },
      responses: { questionnaire: { answers: { q1: "forged" } } },
      slug: "hijack",
    };
    r = await req("PUT", `/api/experiences/${exp.id}`, { body: evil });
    ok(r.status === 200, "update accepted");
    const up = r.json;
    ok(up.name === "Anjali Sharma" && up.slug === exp.slug, "name updated, slug unchanged");
    ok(up.note.length === 3000, "overlong text truncated");
    ok(up.sections.length === 16 && up.sections[0].id === "garden" && up.sections[0].on === false && !up.sections.some((s) => s.id === "hacker"), "sections: unknown dropped, duplicates removed, missing re-added");
    ok(up.compliments.length === 2 && up.compliments[1] === "<script>alert(1)</script>", "compliments: non-strings & blanks dropped (HTML is escaped on render)");
    ok(up.scrapbook.every((s) => s.photo === "") && up.scrapbook[0].art === "sun", "scrapbook: foreign/traversal photo paths rejected, bad art reset");
    ok(up.questions.length === 3 && up.questions[2].type === "text" && /^c[0-9a-f]{10}$/.test(up.questions[2].id), "questions: bad id regenerated, 1-option choice → text, empty removed");
    ok(up.bouquet.messages.length === 9 && up.bouquet.messages[0] === "one" && up.bouquet.letter.length > 20, "bouquet padded to 9, empty letter → default");
    ok(!up.responses.questionnaire, "responses can't be forged through admin update");

    // restore full question list for the rest of the tests
    r = await req("PUT", `/api/experiences/${exp.id}`, { body: { questions: exp.questions, sections: exp.sections } });
    ok(r.json.questions.length === 53, "questions restored");

    console.log("\nPhotos");
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000000200015e2c2ae00000000049454e44ae426082", "hex");
    r = await req("POST", `/api/experiences/${exp.id}/photos`, { raw: png, type: "image/png" });
    ok(r.status === 201 && /^\/uploads\/[a-z0-9]+\/[a-z0-9]+\.png$/.test(r.json.url), "PNG upload stored", r.json);
    const photoUrl = r.json.url;
    r = await req("POST", `/api/experiences/${exp.id}/photos`, { raw: Buffer.from("<?php echo 1; ?>"), type: "image/png" });
    ok(r.status === 415, "non-image upload rejected by magic bytes");
    r = await req("POST", `/api/experiences/${exp.id}/photos`, { raw: png, type: "image/png", auth: false });
    ok(r.status === 401, "upload requires login");
    const cur = (await req("GET", `/api/experiences/${exp.id}`)).json;
    cur.scrapbook[0].photo = photoUrl;
    r = await req("PUT", `/api/experiences/${exp.id}`, { body: cur });
    ok(r.json.scrapbook[0].photo === photoUrl, "own uploaded photo accepted in scrapbook");
    r = await req("GET", photoUrl, { auth: false });
    ok(r.status === 200 && r.headers.get("content-type") === "image/png", "photo publicly viewable for the recipient");

    console.log("\nRecipient (public) API");
    const S = exp.slug;
    r = await req("GET", `/api/x/${S}`, { auth: false });
    ok(r.status === 200 && r.json.name === "Anjali Sharma", "public experience loads without login");
    ok(r.json.responses === undefined && r.json.config === undefined, "public view hides admin-only fields");
    ok(r.json.questions.length === 53, "public view lists enabled questions");
    r = await req("GET", `/api/x/anjali-zzzzzz`, { auth: false });
    ok(r.status === 404, "unknown slug → 404");
    r = await req("POST", `/api/x/${S}/answers`, { auth: false, body: { answers: { q1: "my answer", q2: "x".repeat(4000), notaquestion: "nope", b1: "I don't want to talk about it." }, index: 7 } });
    ok(r.status === 200, "answers saved", r.json);
    r = await req("GET", `/api/x/${S}`, { auth: false });
    const qn = r.json.progress.questionnaire;
    ok(qn.answers.q1 === "my answer" && qn.answers.q2.length === 1500 && !("notaquestion" in qn.answers) && qn.index === 7, "progress persisted, unknown keys dropped, long answers capped");
    r = await req("POST", `/api/x/${S}/answers`, { auth: false, body: { answers: { ...qn.answers, q3: "done" }, index: 52, submit: true } });
    ok(r.status === 200 && r.json.submittedAt, "questionnaire submitted");
    r = await req("POST", `/api/x/${S}/personality`, { auth: false, body: { result: "hacker", scores: {} } });
    ok(r.status === 400, "unknown personality rejected");
    r = await req("POST", `/api/x/${S}/personality`, { auth: false, body: { result: "softie", scores: { softie: 9, drama: 1e9 } } });
    ok(r.status === 200, "personality result saved");
    r = await req("POST", `/api/x/${S}/meter`, { auth: false, body: { score: 5000 } });
    ok(r.status === 400, "meter score out of range rejected");
    r = await req("POST", `/api/x/${S}/meter`, { auth: false, body: { score: 131, title: "Two Brain Cells" } });
    ok(r.status === 200, "meter saved");
    r = await req("POST", `/api/x/${S}/diary`, { auth: false, body: { text: "dear diary, secret" } });
    ok(r.status === 200 && r.json.entries.length === 1, "diary entry saved");
    r = await req("POST", `/api/x/${S}/diary`, { auth: false, body: { text: "   " } });
    ok(r.status === 400, "empty diary rejected");
    r = await req("POST", `/api/x/${S}/wish`, { auth: false, body: { text: "a trip to the mountains" } });
    ok(r.status === 200, "wish saved");
    r = await req("POST", `/api/x/${S}/seen`, { auth: false, body: {} });
    ok(r.status === 200, "visit recorded");
    r = await req("POST", `/api/x/${S}/answers`, { auth: false, csrf: false, body: { answers: {} } });
    ok(r.status === 403, "public write without X-LW refused");
    r = await req("POST", `/api/x/${S}/answers`, { auth: false, raw: "answers=1", type: "application/x-www-form-urlencoded" });
    ok(r.status === 415, "non-JSON body refused");
    r = await req("PUT", `/api/x/${S}`, { auth: false, body: { name: "pwned" } });
    ok(r.status === 405, "recipient can't edit the experience");

    console.log("\nAdmin sees answers, not private notes");
    r = await req("GET", `/api/experiences/${exp.id}`);
    const resp = r.json.responses;
    ok(resp.questionnaire.answers.q3 === "done" && resp.personality.result === "softie" && resp.personality.scores.drama === 99, "answers + personality visible, scores clamped");
    ok(resp.diaryCount === 1 && resp.wishCount === 1 && !resp.diary && !resp.wishes, "diary & wishes hidden (counts only)");
    ok(resp.openedAt, "opened timestamp recorded");
    r = await req("GET", "/api/experiences");
    ok(r.json[0].answered === 4 && r.json[0].submittedAt && r.json[0].personality === "softie", "list summary shows progress");
    r = await req("GET", `/api/experiences/${exp.id}/export?format=csv`);
    ok(r.status === 200 && r.headers.get("content-type").startsWith("text/csv") && r.text.includes("my answer") && r.text.includes("softie"), "CSV export");
    r = await req("GET", `/api/experiences/${exp.id}/export?format=json`);
    ok(r.status === 200 && JSON.parse(r.text).answers.length === 53, "JSON export");
    r = await req("GET", `/api/experiences/${exp.id}/export?format=csv`, { auth: false });
    ok(r.status === 401, "export requires login");

    console.log("\nSeparation between experiences");
    r = await req("POST", "/api/experiences", { body: { name: "Riya" } });
    const exp2 = r.json;
    ok(exp2.slug !== exp.slug && !exp2.responses.questionnaire, "second experience starts empty");
    r = await req("POST", `/api/x/${exp2.slug}/answers`, { auth: false, body: { answers: { q1: "riya's answer" } } });
    r = await req("GET", `/api/x/${S}`, { auth: false });
    ok(r.json.progress.questionnaire.answers.q1 === "my answer", "answers stay with their own experience");
    const c2 = (await req("GET", `/api/experiences/${exp2.id}`)).json;
    c2.scrapbook[0].photo = photoUrl;
    r = await req("PUT", `/api/experiences/${exp2.id}`, { body: c2 });
    ok(r.json.scrapbook[0].photo === "", "can't reference another experience's photo");

    console.log("\nClear, delete, logout");
    r = await req("DELETE", `/api/experiences/${exp.id}/responses`);
    ok(r.status === 200 && !r.json.responses.questionnaire && r.json.responses.diaryCount === 1, "clear answers keeps private diary");
    r = await req("DELETE", `/api/experiences/${exp2.id}`);
    ok(r.status === 200, "delete experience");
    r = await req("GET", `/api/x/${exp2.slug}`, { auth: false });
    ok(r.status === 404, "deleted link stops working");
    if (process.env.MONGODB_URI) {
      r = await req("GET", `/api/experiences/${exp.id}`);
      ok(r.status === 200 && r.json.name === "Anjali Sharma", "data persisted in MongoDB");
    } else {
      ok(fs.existsSync(path.join(DATA, "db.json")) && JSON.parse(fs.readFileSync(path.join(DATA, "db.json"))).experiences[exp.id], "database persisted to disk");
    }
    r = await req("POST", "/api/auth/logout", { body: {} });
    r = await req("GET", "/api/experiences");
    ok(r.status === 401, "logout ends the session");

    console.log("\nLogin rate limit");
    cookie = "";
    let last;
    for (let i = 0; i < 12; i++) last = await req("POST", "/api/auth/login", { body: { password: "nope nope nope" } });
    ok(last.status === 429, "brute force attempts are throttled");
  } catch (e) {
    failed++; console.error(e);
  } finally {
    srv.kill();
    fs.rmSync(DATA, { recursive: true, force: true });
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(failed ? 1 : 0);
  }
})();
