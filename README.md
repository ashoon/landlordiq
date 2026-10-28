# LandlordIQ

A single-page React app for managing rental units: a rent-status dashboard, tenant move-out / move-in,
and financial analytics. There is no backend. Data lives in your browser and, optionally, in a JSON
file in **your own Google Drive** so it follows you to any Mac.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
npm run lint
```

Without any setup the app works in **local-only mode**: data is saved in the browser. The steps below
turn on Google Drive sync.

---

## How Drive sync works

- Click **Connect Google Drive** in the header and sign in. The app creates one file,
  `landlordiq-data.json`, in the Drive folder **My Drive → Colombia → Apartments** (folders are created if
  missing; an existing file in the Drive root is moved there) and keeps it up to date (changes upload ~1.5 s
  after you make them).
- The permission requested is `drive.file`: the app can only see files **it created**, never the rest
  of your Drive.
- Open the app on another Mac or phone, sign in with the same Google account, and the same data appears.
  While the tab is open and visible it checks Drive **every 30 seconds**, and also when you switch back
  to it, so edits made elsewhere show up on their own.
- If Drive can't be reached, edits stay on the device and upload when you're back online.
- **Two people can edit at once.** If both this device and Drive changed since the last sync, the two
  copies are **merged record by record** and the result is saved to both. Different payments, expenses,
  tax payments, units or tenancies never clash, and edits to different fields of the same unit are both
  kept. A deletion on one side stays deleted unless the other side edited that record meanwhile. If both
  sides changed the *same field* of the same record, this device's value wins. A backup of this device's
  data is kept before a merge changes it (`landlordiq_local_backup`).
- Only if this device has no record of the last synced data (for example after clearing browser data
  while having unsynced edits) does a banner ask whether to keep the Drive copy or this device's copy.
- Google sign-in tokens last about an hour. The app renews them quietly; if Google needs a click you'll
  see a **Reconnect** button. Your edits are never lost while signed out.
- A teammate with **their own Google account** can't see your file automatically (see the limits of the
  `drive.file` permission). Share it with them and have them use **Open shared file**; see
  [Sharing with teammates](#sharing-with-teammates).

> Google sign-in does not work from a `file://` page (double-clicking `index.html`). Use the hosted
> URL, `npm run dev`, or `npm run preview`.

---

## Google Cloud setup (once, ~10 minutes, free, no billing)

Google renames console menus from time to time; follow the intent if a label differs slightly.

1. **Create a project.** Go to <https://console.cloud.google.com>, sign in with the Google account whose
   Drive will hold the data, open the project picker → **New project**, name it `LandlordIQ`, **Create**.
   No billing account is needed.
2. **Enable the Drive API.** **APIs & Services → Library** → search **Google Drive API** → **Enable**.
3. **Configure the consent screen** (**APIs & Services → OAuth consent screen**, or **Google Auth
   Platform** in newer consoles):
   - App name `LandlordIQ`, plus a support email and developer contact email.
   - Audience / user type: **External**.
   - **Scopes / Data access:** add only `https://www.googleapis.com/auth/drive.file`.
   - **Test users:** add the email of every Google account that will sign in (including yours).
4. **Create the OAuth client.** **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**, name `LandlordIQ web`.
   - **Authorized JavaScript origins** (scheme + host + port only: no path, no trailing slash):
     - `http://localhost:5173` (dev server)
     - `http://localhost:4173` (`npm run preview`)
     - `https://<your-github-username>.github.io` (hosted app)
   - **Authorized redirect URIs:** leave empty (popup sign-in doesn't use them).
   - **Create**, then copy the **Client ID** (`1234567890-abc….apps.googleusercontent.com`).
     Ignore the client secret: the app never uses it. The client ID is not secret.
5. **Wait a few minutes**, as new origins can take a little while to take effect.
6. **Give the app the Client ID:**
   - Local: copy `.env.example` to `.env.local` and set `VITE_GOOGLE_CLIENT_ID=<your id>`, then restart
     `npm run dev`.
   - Hosted: see below.

### Optional: the file picker (for teammates with their own Google account)

Needed only if teammates use different Google accounts. Without it, the **Open shared file** button is hidden.

1. In the same project: **APIs & Services → Library** → search **Google Picker API** → **Enable**.
2. **APIs & Services → Credentials → Create credentials → API key.** Then **Edit** the key: under
   *Application restrictions* choose **Websites** and add `http://localhost:5173/*` and
   `https://<your-github-username>.github.io/*`; under *API restrictions* allow only **Google Picker API**.
   The key ships in the page, so it is not secret, but the restrictions stop others from using it.
3. Put it in `.env.local` as `VITE_GOOGLE_API_KEY=<key>` and restart `npm run dev`. For the hosted app, add a
   repository variable named `GOOGLE_API_KEY` (next to `GOOGLE_CLIENT_ID`).
4. Add each teammate's Google email as a **test user** (consent screen → Audience), same as step 3 above.

### Good to know

- **Use the same client ID everywhere.** With the `drive.file` scope, Google only lets the app see files
  created through *that* client ID. A different client ID can't see the same file, and a copy dragged into
  Drive by hand isn't visible to the app.
- **Testing vs production.** While the consent screen is in *Testing*, only listed test users can sign in
  and Google expires their consent after about 7 days (you'd re-approve weekly). Setting the publishing
  status to **In production** removes that; for the `drive.file` scope alone Google's app verification
  shouldn't be required, though the sign-in screen will show an "unverified app" warning you can click
  through. Check Google's current documentation to confirm this before relying on it.
- **A bad file is never loaded.** If `landlordiq-data.json` is edited by hand into invalid JSON, the app
  reports an error and keeps your local data.
- **Deleting the file** in Drive makes the app recreate it from this device's data on the next save.

---

## Your tenant list and privacy

**No tenant names, phone numbers or rents are in the code.** They exist only in your browser storage and in the
Drive file. The first list came from `private/tenants.json`, which is git-ignored: keep it that way and never
commit it. It is imported into your saved data once, when you run `npm run dev` on the machine that has the file;
after that, Drive is the source of truth. A published copy of the app, or a new laptop, starts empty and loads the
tenants from Drive after you click **Connect Google Drive**.

- **Back up `private/tenants.json`** somewhere private (it's the only copy outside your saved data).
- **Moving to a new laptop:** you don't need that file; connect Drive there.
- **The Drive file holds everything** (tenants, payments, expenses). It is private to your Google account.
- **Teammates with their own Google accounts won't see your file automatically.** With the `drive.file` permission
  an account only sees files the app created for *that* account, so a second account starts with an empty list.
  Share the file and use the picker (below), or have everyone sign in with the same Google account.

### Sharing with teammates

1. Set up the optional file picker above (Picker API, API key, teammates as test users).
2. In Google Drive, open **My Drive → Colombia → Apartments**, right-click `landlordiq-data.json` →
   **Share**, add each teammate's email as **Editor**. (Viewers can't save changes.)
3. The teammate opens the app, clicks **Open shared file** (or the same item in the Drive menu once connected),
   signs in with their own account and picks `landlordiq-data.json` from the **Shared with me** tab.
4. From then on that device syncs with your file: edits upload within seconds, other people's edits arrive within
   30 seconds, and simultaneous edits are merged. Their device remembers the file, so this is a one-time step.

Notes: a teammate's device that already has its own data is compared with the shared file and asked which to
keep, so use a fresh browser or profile for the first connection. Whoever owns the file can stop sharing at any time
(the teammate's app then reports the file can't be opened). Anyone with Editor access can see and change all tenant
data. The picker only grants the app access to the one file chosen. I have not been able to test this with a real
second Google account, so try it once with a teammate before relying on it.

### Adding a family member (own login, shared file)

Use this when several people each sign in with their own Google account but work on one data file. The
steps below repeat what is above in checklist form.

**Owner, once**

1. Finish the Google Cloud setup and the optional file picker setup above, and add every person's Google
   email as a **test user**.
2. On your own device, click **Connect Google Drive** so the app creates `landlordiq-data.json`.
3. In Drive, open **My Drive → Colombia → Apartments**, right-click `landlordiq-data.json` → **Share**, and add
   each person as **Editor**. In the share settings, turn off *Editors can change permissions and share* so
   they can't pass the file on.

**Each person, once per device**

1. Open the hosted app URL in a browser profile that has no LandlordIQ data yet (a private window is fine for
   a first try, but its storage is lost when it closes).
2. Click **Open shared file**, sign in with your own Google account, and pick `landlordiq-data.json` from the
   **Shared with me** tab.
3. The units appear, and the device remembers the file. After that, only **Reconnect** is ever needed.

**Phones and tablets**

- The app is a normal web page. Adding it to the Home Screen does not change how it syncs. On iOS a Home Screen
  shortcut may keep its own separate browser storage (not verified), so if you use one, do the
  **Open shared file** step inside it.
- Phone browsers often block Google's silent sign-in renewal, so expect to tap **Reconnect** now and then.
  Edits stay on the device until you do.
- Google's file picker is designed for desktop and may be awkward on a small screen. If it is, do the first
  connection on a desktop browser.
- Sync only runs while the page is open and visible. Opening the app pulls the latest data straight away.

**Check that sharing works (two accounts)**

Do this once before relying on it, with a second Google account, on a desktop and on a phone.

1. The second account is a test user and has Editor access to the file.
2. On the second device, **Open shared file** loads the same units as the owner's device.
3. Owner marks a unit paid. Within about 30 seconds (or on switching back to the tab) it shows paid on the
   other device.
4. The other device adds an expense. It appears on the owner's device.
5. Turn one device offline (airplane mode), mark a different unit paid on each device, then go back online.
   Both changes should be present on both devices and no conflict banner should appear.
6. Remove the second account's Editor access in Drive. Its app should report that the file can't be opened,
   rather than creating a new file.

If any step fails, see the troubleshooting table below.

---

## Hosting on GitHub Pages

GitHub only serves the code; your data stays in your Drive. The published app contains no tenant data.

1. Push this project to a GitHub repository. On a free account, Pages needs the repository to be
   **public**, so the code is public. **Never commit a data file to the repo.**
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → Variables tab → New repository variable:**
   name `GOOGLE_CLIENT_ID`, value = your Client ID.
4. Push to `main` (or run the workflow from the Actions tab). `.github/workflows/deploy.yml` builds and
   publishes the app to `https://<your-github-username>.github.io/<repo-name>/`.
5. Make sure `https://<your-github-username>.github.io` is in the OAuth client's authorized origins.

Open that URL on any Mac, click **Connect Google Drive**, and you're in.

Any other static host (Netlify, Vercel, an S3 bucket…) also works: build with
`VITE_GOOGLE_CLIENT_ID=<id> npm run build`, upload `dist/`, and add the host's origin to the OAuth client.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| No Connect button | `VITE_GOOGLE_CLIENT_ID` is empty. The app is in local-only mode. |
| Popup says `redirect_uri_mismatch` / `origin_mismatch` | The page's origin isn't in **Authorized JavaScript origins** (check scheme, port, no trailing slash), or it was added moments ago. |
| `Access blocked: LandlordIQ has not completed the Google verification process` | Your account isn't in **Test users** while the app is in Testing. |
| "Drive error 403" in the header | Drive API not enabled in the project, or the account isn't a test user. |
| Asked to sign in again about weekly | Consent screen is in Testing mode (see above). |
| Popup is blocked | Click **Connect / Reconnect** again. Browsers only allow the popup straight after a click. |

---

## Licence

Released under the [MIT License](LICENSE). The repository holds code only: no tenant data, and the Google
client ID and API key are supplied at build time, never committed.

