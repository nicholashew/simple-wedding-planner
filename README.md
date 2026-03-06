# 🏠💒 Planner App

A Node.js web app with two planning tools:

- **Homestay Planner** — assign guests to rooms with drag & drop
- **Wedding Banquet Planner** — arrange tables on a canvas, assign seats by category

---

## Project Structure

```bash
planner-app/
│
├── public/                   # ← Everything here is static and deployable
│   ├── index.html            # Home / landing page
│   ├── css/
│   │   ├── shared.css        # Nav bar, save status, toast — shared by all pages
│   │   └── app.css           # app styles
│   ├── js/
│   │   ├── shared-nav.js     # Nav bar injection + localStorage save/load/autosave
│   │   ├── homestay.js       # Homestay planner logic
│   │   └── wedding.js        # Wedding banquet planner logic
│   └── pages/
│       ├── homestay.html     # Homestay planner page
│       └── wedding.html      # Wedding banquet planner page
│
├── server.js                 # Express server (dev + self-hosting)
├── package.json
└── README.md
```

### Why this structure?

| Question | Answer |
|---|---|
| **Split JS/CSS into folders?** | Yes — `public/css/` and `public/js/`. Cleaner imports, easier caching, scales well. |
| **Shared HTML layout?** | The nav is injected at runtime by `shared-nav.js` — no server-side templating needed. For a larger app, consider Vite or EJS/Handlebars. |
| **Shared CSS?** | `shared.css` holds the nav bar, save-status indicator, toast, and toggle styles. Each page loads both `shared.css` and its own CSS file. |
| **Shared JS?** | `shared-nav.js` is loaded on every page and handles: nav injection, localStorage read/write, autosave timer, and the global `markUnsaved()`. |

---

## Getting Started

### Prerequisites

- Node.js v18+

### Install

```bash
npm install
```

### Development (hot reload)

#### Option A — Express + Browser-Sync proxy

```bash
npm run dev
```

Opens at `http://localhost:3001`. Browser-Sync proxies Express (port 3000) and reloads the browser on any change to `public/**`. `nodemon` restarts the server when `server.js` changes.

#### Option B — Static-only (no Node server)

```bash
npm run dev:static
```

Opens at `http://localhost:3000/index.html`. Browser-Sync serves `public/` directly — fastest option for frontend-only work.

### Production

```bash
npm start
# → http://localhost:3000
```

---

## localStorage — Saving Data

Both planners save state to `localStorage` so nothing is lost on page refresh.

### Save modes

| Mode | How |
|---|---|
| **Manual save** | Click 💾 Save in the nav bar |
| **Auto-save** | Toggle the switch — saves 30 seconds after any change |
| **Clear** | Click 🗑 Clear in the nav bar (prompts for confirmation) |

### Storage keys

| Page | localStorage key |
|---|---|
| Homestay | `homestay-v1` |
| Wedding | `wedding-banquet-v1` |

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Enter` | Submit the focused input |
| `Escape` | Close open modals |
| `Ctrl/Cmd+Z` | Undo last action (Homestay only) |
