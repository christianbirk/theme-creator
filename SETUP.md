# Local setup

Quick guide to get the Theme Creator running on your machine.

## 1. Prerequisites

You need:

- **Node.js 20** (or newer) — check with `node -v`. Install from <https://nodejs.org/> or with [nvm](https://github.com/nvm-sh/nvm).
- **Git** — to clone the repo.
- **GitHub CLI (`gh`)** *(optional but recommended)* — install from <https://cli.github.com/>. Used by the in-app "Sync framework" button to pull the latest `baseStylesV6` from the private `beru-org/Assets` repo. Without it, the app works fine but uses the bundled fallback. After installing, run:
  ```bash
  gh auth login
  ```
  You need `repo` scope for the private framework repo.

## 2. Clone the repo

```bash
git clone https://github.com/christianbirk/theme-creator.git
cd theme-creator
```

## 3. Install dependencies

```bash
npm install
```

Takes a couple of minutes the first time (~370 MB of `node_modules`).

## 4. Start the app

```bash
npm run dev
```

You should see:

```
[express] serving on port 3000
```

Open **<http://localhost:3000>** in your browser.

That's it — the app is running. There is no database to set up, no `.env` file to create, nothing to seed. All state lives in the browser.

---

## Troubleshooting

**`Error: listen EADDRINUSE: address already in use 0.0.0.0:3000`**
Another process is already on port 3000 — either the app is already running in another terminal, or kill it with:
```bash
lsof -ti :3000 | xargs kill
```
…then `npm run dev` again. Alternatively run on a different port: `PORT=3001 npm run dev`.

**`gh: command not found` when clicking "Sync framework"**
Install the GitHub CLI (see step 1) or just ignore the button — the bundled framework copy works for normal use.

**Node version warnings during `npm install`**
The app is tested on Node 20. If you're on 18 or 22 it will probably still work, but upgrade to 20 if you see odd errors.

---

## What's next

- Open `docs/cms-handover-technical-description.md` for an architectural overview.
- Open `docs/theme-source-conventions.md` for the theme format the app produces/consumes.
