# Frontend Developer Onboarding — onedocepares.com

Welcome! This guide gets your machine set up and walks you through the daily workflow for contributing to the frontend (`apps/web/`). Read it top to bottom once, then keep it as a reference.

You do **not** need to know Rust to work on the frontend — Docker Compose runs the API and database for you. You only need to touch `apps/web/`.

---

## 1. Tools to install

Install these in order. Skip a step only if you already have it installed and it meets the version listed.

| Tool | Why | Version |
|---|---|---|
| [Git](https://git-scm.com/downloads) | Version control | Any recent version |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Runs the database, API, and frontend together | Latest |
| [Node.js](https://nodejs.org/) | Lets you run `npm` commands directly (optional if you only use Docker, but install it anyway — see §5) | 24+ |
| [VS Code](https://code.visualstudio.com/) | Recommended editor | Latest |
| [GitHub Desktop](https://desktop.github.com/) (optional) | GUI alternative to git commands, if you prefer not to use the terminal | Latest |

### 1.1 Installing Docker Desktop (Windows)

1. Download Docker Desktop from the link above.
2. Run the installer. When prompted, **enable WSL 2** (Windows Subsystem for Linux) — the installer will guide you through this, or ask it to install it for you.
3. Restart your computer if asked.
4. Launch Docker Desktop. Wait for the whale icon in the system tray to stop animating — that means Docker has finished starting.
5. Verify it works by opening a terminal (PowerShell) and running:

   ```powershell
   docker --version
   docker compose version
   ```

   Both should print a version number, not an error.

If Docker Desktop ever fails to start, the most common fix is: open Docker Desktop → Settings → make sure "Use the WSL 2 based engine" is checked → restart Docker Desktop.

---

## 2. GitHub account & SSH keys

You've already been invited to the repository ([github.com/lerrouxlopez/onedocepares](https://github.com/lerrouxlopez/onedocepares)) — accept the invite email first.

This repo is cloned over **SSH**, not HTTPS, so you need an SSH key pair set up before you can clone or push.

### 2.1 Generate an SSH key

In PowerShell:

```powershell
ssh-keygen -t ed25519 -C "your-email@example.com"
```

- Press Enter to accept the default file location.
- You can press Enter twice to skip setting a passphrase, or set one if you want extra security (you'll be asked for it each time you push).

### 2.2 Add the key to the SSH agent

```powershell
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519
```

### 2.3 Add the public key to GitHub

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | Set-Clipboard
```

This copies your **public** key to the clipboard. Then:

1. Go to GitHub → click your profile picture → **Settings**.
2. **SSH and GPG keys** → **New SSH key**.
3. Title it something like "My Laptop", paste the key, click **Add SSH key**.

### 2.4 Test the connection

```powershell
ssh -T git@github.com
```

You should see: `Hi <your-username>! You've successfully authenticated...`. Type `yes` if it asks to confirm the host fingerprint the first time.

### 2.5 Set your git identity

```powershell
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

Use the same email associated with your GitHub account.

---

## 3. Clone the repository

```powershell
git clone git@github.com:lerrouxlopez/onedocepares.git
cd onedocepares
```

The repo has these branches: `master` (production), `develop` (integration), `frontend` and `backend` (team branches). **You work exclusively on the `frontend` branch.** Never check out or commit to `master`, `develop`, or `backend`.

```powershell
git checkout frontend
```

---

## 4. Set up your environment files

Before running anything, create your local `.env` file from the template:

```powershell
cd apps/web
copy .env.example .env
cd ../..

cd apps/api
copy .env.example .env
cd ../..
```
Open .env file and input your preffered superadmin user and password. Yopu will use this to login to the admin panel.

This file (`apps/web/.env and app/api/.env`) is git-ignored — it's local to your machine and won't be committed. You shouldn't need to change any values in it for local development; it's just required for `npm`/Vite to start cleanly. **Do this now, before moving on to §5** — if you skip it, `npm run dev` (Option B below) may fail to start.

> Note: if you run the app through Docker Compose (Option A, recommended), the `api` and `web` containers already get their config from `docker-compose.yml`, so you don't strictly need `.env` files for that path either — but create `apps/web/.env` anyway so it's ready if you ever switch to running things directly with `npm`.

---

## 5. Running the app

You have two options. **Use Option A (Docker) unless told otherwise** — it's the simplest because it also starts the database and API for you, and matches what everyone else on the team is running.

### Option A: Docker Compose (recommended)

From the repo root:

```powershell
docker compose up -d
```

- `up` starts the containers (`postgres`, `api`, `web`).
- `-d` means "detached" — it runs in the background and gives you your terminal back. Without `-d`, it runs in the foreground and streams logs (also useful — see below).
- The first run will take a few minutes (downloading images, installing dependencies). Subsequent runs are fast.

To check it's running and watch logs:

```powershell
docker compose ps
docker compose logs -f web
```

(Press `Ctrl+C` to stop following logs — this does **not** stop the containers.)

To stop everything:

```powershell
docker compose down
```

This stops and removes the containers but **keeps your data** (database contents persist in a Docker volume). Containers restart cleanly next time with `docker compose up -d`.

> If you ever want a truly clean slate (wipe the database), use `docker compose down -v` — but check with the team first, since this deletes local data.

### Option B: Running the frontend directly with npm

Only do this if Docker isn't working, or if you want faster reloads while doing pure frontend-only work and someone else's API/DB is already running separately. You'd still need the API and database running somehow (e.g. via Docker for just those two services).

```powershell
cd apps/web
npm install
npm run dev
```

This starts Vite directly on your machine instead of inside a container.

### Accessing the app in the browser

Once running (either option), open:

- **Public site:** http://localhost:5173
- **Admin panel:** http://localhost:5173/admin/
- **API health check:** http://localhost:8000/api/v1/health (should show `{"status":"ok"}` — confirms the backend is up)

If `localhost:5173` doesn't load, check `docker compose ps` to confirm the `web` container shows as running, and check `docker compose logs web` for errors.

---

## 6. Project structure — where things live

```
apps/web/
├── index.html          # Public site entry point
├── admin/index.html     # Admin panel entry point
├── src/
│   ├── css/             # SCSS (main.scss, admin.scss, etc.)
│   ├── js/              # JS modules (api.js, auth.js, teams.js, etc.)
│   ├── main.js           # Public site JS entry
│   └── admin.js          # Admin JS entry
├── public/              # Static assets served as-is
├── package.json
└── vite.config.js
```

A few things worth knowing before you start editing:

- **All API calls go through `src/js/api.js`.** Don't write raw `fetch`/`$.ajax` calls elsewhere — use the shared wrapper so CSRF tokens and session cookies are handled consistently.
- **Don't introduce React/Vue/Angular or any SPA framework.** This project intentionally uses plain HTML + Bootstrap 5 + jQuery + Vite.
- **The frontend must keep working even if the API is down.** Pages shouldn't crash if a fetch fails — show an empty/error state instead.
- There's a static reference template in `admin template/` (an SB Admin 2 Bootstrap theme) — use it for layout/markup/CSS class inspiration when building admin pages, but adapt it into our actual `src/` files rather than copying it wholesale.
- Read `CLAUDE.md` and `BUILDPLAN.md` in the repo root for the fuller architecture and conventions — these are the project's source of truth, ask if anything there is unclear.

---

## 7. Daily git workflow

### 7.1 Start of day — get the latest changes

```powershell
git checkout frontend
git pull
```

### 7.2 Create a branch for your work

**Never commit directly to `frontend`.** Always work on a feature branch cut from it:

```powershell
git checkout -b feature/players-directory-page
```

Suggested naming: `feature/<short-description>` for new work, `fix/<short-description>` for bug fixes.

### 7.3 Make changes, then check what you've changed

```powershell
git status
git diff
```

### 7.4 Stage and commit

```powershell
git add apps/web/src/js/players.js apps/web/players.html
git commit -m "Add players directory page with search filter"
```

Tips:
- Write commit messages that explain *why*, not just *what* (e.g. "Fix pagination off-by-one on players list" rather than "fix bug").
- Avoid `git add .` / `git add -A` — they can accidentally stage files you didn't mean to commit (like a stray `.env`). Add specific files/folders by name.
- Commit often, in small logical chunks, rather than one giant commit at the end.

### 7.5 Push your branch

```powershell
git push -u origin feature/players-directory-page
```

The `-u` is only needed the first time you push that branch — after that, `git push` alone works.

### 7.6 Keeping your branch up to date

If `frontend` has moved on while you were working:

```powershell
git checkout frontend
git pull
git checkout feature/players-directory-page
git merge frontend
```

If you hit merge conflicts and aren't sure how to resolve them, **stop and ask** rather than guessing — don't use `git checkout --theirs`/`--ours` blindly or discard changes you don't understand.

---

## 8. Creating a Pull Request

Once your branch is pushed and your feature/fix is ready for review:

1. Go to the repo on GitHub: https://github.com/lerrouxlopez/onedocepares
2. You'll usually see a yellow banner "Compare & pull request" for your just-pushed branch — click it. (Or go to **Pull requests** → **New pull request**.)
3. Set the **base** branch to `frontend` — never `master` or `develop`.
4. Write a clear title and description:
   - What does this PR do?
   - How did you test it? (e.g. "Loaded /players on localhost:5173, checked search filter and pagination")
   - Screenshots are very welcome for frontend changes — drag images directly into the PR description box.
5. Click **Create pull request**.
6. A CI check will run automatically (`npm ci && npm run build`) — wait for the green checkmark. If it fails, click "Details" to see the error, fix it, and push again (the PR updates automatically).
7. Request a review and wait for approval before merging — don't merge your own PR unless told it's fine to do so.

### What CI checks on your PR

For the frontend, CI runs:

```powershell
npm ci
npm run build
```

So before pushing, it's good practice to run this yourself first to catch errors early:

```powershell
cd apps/web
npm run build
```

---

## 9. Things to avoid

- **Never commit `.env` files** — they're git-ignored on purpose; they can contain secrets. If `git status` ever shows a `.env` file as ready to commit, stop and ask before adding it.
- **Never force-push** (`git push --force`) to a shared branch — it can erase other people's work.
- **Don't run `npm run dev` *and* `docker compose up` for the web service at the same time** — they'll both try to use port 5173 and conflict. Pick one.
- **Don't commit `node_modules/` or `dist/`** — they're git-ignored and get rebuilt automatically.
- **Don't edit files under `apps/api/`** unless you've been asked to — that's the Rust backend, owned by the backend track.

---

## 10. Quick command reference

```powershell
# Docker
docker compose up -d           # start everything in the background
docker compose down            # stop everything (keeps data)
docker compose logs -f web     # follow frontend container logs
docker compose ps              # see what's running

# Frontend (only if running outside Docker)
cd apps/web
npm install                    # install dependencies
npm run dev                    # start dev server directly
npm run build                  # production build (also what CI runs)

# Git
git pull                       # get latest changes
git checkout -b feature/x      # start new work
git add <files>                # stage specific files
git commit -m "message"        # commit
git push -u origin feature/x   # push new branch (first time)
git push                       # push subsequent commits
```

---

## 11. Who to ask

If you're stuck for more than ~20–30 minutes on a setup issue (Docker not starting, SSH not working, merge conflicts, etc.), ask rather than spending hours on it alone — these are usually quick to unblock with a second pair of eyes.
