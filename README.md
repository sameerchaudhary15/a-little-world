# A Little World

A platform for personalised digital envelopes. A customer signs up, makes a surprise for their partner, best friend, friend, mom or dad, and sends the link. Whoever receives it opens an envelope, walks through photos, letters, flowers and questions, and their replies go back to the person who made it.

There are three separate experiences behind one server:

| Who | Where | What they can reach |
|---|---|---|
| Site owner | `/admin` | Everything. Needs the admin password. |
| Creators (customers) | `/create`, `/studio` | Only their own envelopes and replies. |
| Recipients | `/envelope/<random-link>` | Only that published envelope, and their own replies. |

Needs Node.js 18 or newer. On your own computer it runs with nothing to install or set up; the `mongodb` package is only used online.

## Run it on your computer

Double-click **`Start A Little World.bat`**, or in a terminal:

```
node start-local.js
```

Then open **http://localhost:3000**. The first time you open **/admin**, it asks you to choose the admin password. Links made on `localhost` only work on your computer.

## Put it online (Vercel + MongoDB Atlas)

1. Create a MongoDB Atlas cluster and a database user, allow network access from `0.0.0.0/0`, and copy the `mongodb+srv://…` connection string.
2. Import this GitHub repo in Vercel (Framework preset: **Other**). `vercel.json` does the rest.
3. In Vercel → Settings → Environment Variables, add the variables below, then redeploy.

| Variable | Needed? | What it does |
|---|---|---|
| `MONGODB_URI` | Yes | The database connection string. |
| `MONGODB_DB` | No | Database name. Defaults to `littleworld`. |
| `ADMIN_SETUP_KEY` | Only for a brand-new database | A long secret you make up. It stops a stranger claiming `/admin` before you do. If an admin password is already set, it isn't used. |
| `PUBLIC_URL` | Recommended | Your site's address, such as `https://example.com`. Used for WhatsApp link previews. |

Without `MONGODB_URI`, everything is saved in `data/` on disk (or `DATA_DIR`).

### Photos

Photos are resized in the browser (to 1800 px at most), then stored in MongoDB and served only through the server, so no storage credentials ever reach a browser. A photo opens only while its envelope is live; otherwise only its creator and the admin can see it. MongoDB Atlas's free M0 tier holds 512 MB in total, which is roughly a thousand or two photos. Upgrade the cluster before you reach that, or move the `photoSave` / `photoGet` functions in `lib/store-mongo.js` to object storage. Nothing else depends on where the photos are kept.

## Pages

```
/                       public landing page
/demo/<relationship>    a sample envelope (partner, bestie, friend, mom, dad)
/privacy                privacy notice (a draft: have it reviewed before launch)
/create                 sign up or log in
/studio                 creator dashboard
/studio/create          the step-by-step wizard
/studio/experiences     all of a creator's envelopes
/studio/edit/<id>       the editor, with live preview
/studio/preview/<id>    private preview
/studio/responses       "Their little responses"
/studio/account         name, password, delete account
/admin                  admin overview
/admin/users            creators: search, suspend, reset password, delete
/admin/envelopes        every envelope: preview, disable, delete, export
/admin/responses        every reply, searchable
/admin/analytics        30-day activity
/admin/worlds           the original studio, still working
/envelope/<slug>        what a recipient opens
/surprise/<slug>        links made by the original studio, still working
```

## Data

The original `config`, `experiences`, `sessions`, `ratelimits` and `photos` collections are untouched and keep working. These were added:

| Collection | Holds |
|---|---|
| `users` | Creator accounts: name, email (unique), scrypt password hash, suspended flag. |
| `usessions` | Creator logins, stored only as hashes, and expiring by themselves. |
| `resets` | One-time password reset links, expiring after 24 hours. |
| `envelopes` | One envelope and its `ownerId`: relationship, intent, gender, sections, wording, questions, gallery, letters, bouquet, secrets, proposal, finale, link status, visit count. |
| `responses` | One recipient's replies, with `envelopeId` and `ownerId`: answers, quiz, proposal reply, message. |
| `stats` | Daily totals for analytics. Identifies nobody. |

All relationship wording and question banks are in `public/js/catalog.js`.

## Security

MongoDB has no row-level security, so all access control is enforced on the server, on every request:

- **Admin:** a separate session cookie (`SameSite=Strict`). The dashboard's code isn't even sent until the session is checked, and every `/api/control` call checks it again. A creator's login doesn't work there.
- **Creators:** every studio route loads the envelope and compares its owner to the logged-in user. Someone else's envelope answers 404, the same as one that doesn't exist.
- **Recipients:** the public view is a list of allowed fields, with no owner, email or stats. Each recipient has a random private ID, so someone else opening the same link can't see their answers.
- **Consent:** the server refuses to store replies until the recipient has been told who can read them. They can erase their replies at the end.
- **Links:** 100 bits of randomness, no names in the URL, and no edit access. Creators can switch them off or set a closing date. The admin can take one down in a way the creator can't undo. A suspended creator's links stop.
- **Input:** every field is checked for type, length and allowed values. Protected fields such as owner and status can't be set through an edit. Uploads are checked by file signature. Exports neutralise spreadsheet formulas.
- **Also:** scrypt passwords, HttpOnly cookies, rate limits on logins and writes, a required custom header on every write (CSRF), and Content-Security-Policy and frame headers.

There's no email service, so forgotten passwords are handled by the admin making a one-time reset link on the creator's page in `/admin/users/…`. To reset the admin password, delete `config` from the database (and set `ADMIN_SETUP_KEY` if online).

## Tests

```
npm test
```

Runs `test/run.js` (the original site) and `test/platform.js` (accounts, ownership, consent, photos, links, admin). Set `MONGODB_URI` to run them against MongoDB.

## Files

```
start-local.js          runs the site on your computer
api/index.js            Vercel entry point
lib/app.js              server basics, and the original studio's API
lib/platform.js         accounts, creator, recipient and admin APIs, and page routing
lib/pages.js            HTML for each page, including link-preview tags
lib/store-*.js          storage: MongoDB, or data/ on disk
public/js/catalog.js    relationships, ideas, questions, default wording
public/js/envelope.js   the recipient's experience
public/js/bouquet.js    draws customised bouquets
public/js/studio*.js    the creator studio
public/js/panel*.js     the admin panel
public/css/             site, studio, envelope (five themes), bouquet, panel
```
