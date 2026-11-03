# A Little World

A personalised interactive gift website. You make a "little world" for someone in the studio, send them the link on WhatsApp, and they get an envelope that opens into a bouquet, a night garden, letters, a scrapbook, quizzes and more. Their answers come back to you.

Needs Node.js 18 or newer. On your own computer it runs without installing anything; the `mongodb` package is only used online.

## Run it on your computer

Double-click **`Start A Little World.bat`**, or in a terminal:

```
node start-local.js
```

Then open **http://localhost:3000/admin**. The first time, it asks you to choose a studio password.

Links made on your computer (`localhost`) only work on your computer. To send them to someone, put the site online (below).

## Put it online (Vercel + MongoDB Atlas, both free)

1. Create a free **M0** cluster on MongoDB Atlas, a database user, and allow network access from `0.0.0.0/0`. Copy the `mongodb+srv://…` connection string.
2. Import this GitHub repo in Vercel (Framework preset: **Other**). `vercel.json` does the rest.
3. In Vercel → Settings → Environment Variables add `MONGODB_URI` = your connection string, then redeploy.
4. Open `https://your-project.vercel.app/admin` and set the studio password straight away.

When `MONGODB_URI` is set, answers, sessions and photos are stored in MongoDB (`littleworld` database, override with `MONGODB_DB`). Without it, everything is saved in `data/` on disk, which is what happens on your own computer.

Other hosts work too: any Node host with `MONGODB_URI`, or a host with a persistent disk (set `DATA_DIR`).

Always use HTTPS in production. The login cookie is marked `Secure` automatically behind an HTTPS proxy.

## The studio (`/admin`)

- **New world**: their name (+ yours). You get a link like `/surprise/anjali-k3x9q2`. The random part means links can't be guessed.
- **Basics**: names, your WhatsApp number (answers are sent back there), personal note, final message.
- **Sections**: switch any section on or off and reorder them.
- **Compliments & words / Bouquet / Garden & stars / Secret letters / Wheel, wish & meter**: edit every message. `{name}` and `{from}` are filled in automatically.
- **Scrapbook**: upload photos (resized in your browser first) and write captions. Without a photo, an illustration is shown.
- **Questions**: all 50 questions plus 3 multiple-choice ones. Edit, add, delete, reorder, switch on/off, change type.
- **Answers**: when they opened it, progress, every answer, personality result, friendship meter. Export as CSV or JSON.

Diary pages and wishes are kept private to the recipient and are not shown in the studio. Anyone who has the link can see them, though, so the link is the key.

## Security

- Studio protected by a password (scrypt-hashed), HttpOnly + SameSite=Strict session cookie, login rate-limited.
- Every write is validated on the server: field types, lengths, list sizes, allowed section and personality IDs, question IDs, photo paths. Unknown fields are dropped.
- Recipients can only write their own answers, quiz result, meter, diary and wishes, and only to their own world.
- Uploads are checked by file signature (JPG/PNG/WebP/GIF, max 8 MB) and stored under random names.
- Content-Security-Policy, nosniff, frame and referrer headers on every response.

To reset the password, stop the server and delete `config` from `data/db.json` (or the whole `data/` folder to start fresh).

## Tests

```
node test/run.js
```

80 end-to-end checks: auth, permissions, validation, uploads, saving and separating answers, export, delete.

## Files

```
start-local.js          runs the site on your computer
lib/app.js              the server logic (API, auth, validation)
lib/store-*.js          storage: MongoDB or data/ on disk
api/index.js            Vercel entry point
public/admin.html       the studio
public/experience.html  the recipient's page
public/js/              defaults (all default content + 50 questions), flowers (SVG illustrations),
                        world-core / world-sections / world-play / world-boot (recipient), admin
public/css/             styles.css (base), world.css (recipient sections), admin.css
data/                   created on first run: db.json + uploads/
_v1-static-backup/      the previous static version, untouched
```
