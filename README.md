# Simple Wedding Planner

A static wedding banquet website with an admin planner tool. Designed for deployment on Cloudflare Pages or Vercel — no build step required.

---

## Repository Structure

```text
simple-wedding-planner/
├── wedding/                      # ← Deployable static site (root of deployment)
│   ├── index.html                # Public home page
│   ├── table.html                # Find My Table (QR code scan)
│   ├── menu.html                 # Wedding menu
│   ├── video.html                # Love story video (time-locked)
│   ├── gallery.html              # Photo gallery
│   ├── wish.html                 # Send wishes (Google Form embed)
│   ├── robots.txt                # Disallow all bots
│   │
│   ├── assets/
│   │   ├── css/
│   │   │   ├── gw.css            # Shared public styles (design tokens, header, layout)
│   │   │   ├── app.css           # Admin planner styles
│   │   │   └── shared.css        # Admin nav styles
│   │   ├── js/
│   │   │   ├── gw.js             # Shared public JS (i18n, data loader, QR encode/decode)
│   │   │   ├── admin-shared-nav.js
│   │   │   ├── admin-wedding.js
│   │   │   └── admin-homestay.js
│   │   └── data/
│   │       ├── config.json       # Event config (couple names, date, menu, video, etc.)
│   │       ├── guests.json       # Guest list with table assignments
│   │       ├── banner.jpg        # Home page banner image
│   │       ├── floral-background.jpg
│   │       └── montage.mp4       # Love story video
│   │
│   ├── admin/
│   │   ├── login.html            # Admin login (PIN-based, cookie auth)
│   │   ├── index.html            # Admin dashboard
│   │   ├── wedding.html          # Wedding seating planner (canvas-based)
│   │   ├── homestay.html         # Homestay room assignment planner
│   │   └── find-table.html       # Admin QR scan + guest search tool
│   │
│   ├── server.js                 # Express static server (local dev only)
│   └── package.json
│
├── sample-webapp/                # Reference app (source of admin planner UI)
├── requirements/                 # Original requirements docs
└── README.md
```

---

## Public Pages

| Page | URL | Description |
|---|---|---|
| Home | `/` | Nav cards linking to all sections |
| Find My Table | `/table.html` | Guests scan invitation QR code to find their seat |
| Wedding Menu | `/menu.html` | Banquet courses from `config.json` |
| Love Story Video | `/video.html` | Time-locked video (unlocks at configured date/time) |
| Photo Gallery | `/gallery.html` | Photo grid with lightbox, loaded from `config.json` |
| Send Wishes | `/wish.html` | Embedded Google Form |

All public pages support **English / Chinese (Traditional)** via the language toggle. Translations are managed in `assets/js/gw.js`.

---

## Admin Pages

Protected by a PIN-based login (credentials in `config.json` → `adminUser` / `adminPin`). Auth is stored as a `gw_admin=1` session cookie.

| Page | URL | Description |
|---|---|---|
| Login | `/admin/login.html` | PIN login |
| Dashboard | `/admin/` | Links to all admin tools |
| Wedding Planner | `/admin/wedding.html` | Canvas table layout, seat assignment, QR generation |
| Homestay Planner | `/admin/homestay.html` | Drag & drop room assignment |
| Find Table (Admin) | `/admin/find-table.html` | QR scan + guest name search |

---

## Configuration

Edit `wedding/assets/data/config.json`:

```json
{
  "projectName": "Smith & Jones Wedding",
  "eventDate": "2026-03-10",
  "adminUser": "admin",
  "adminPin": "1234",
  "montage": {
    "videoUrl": "/assets/data/montage.mp4",
    "availableDate": "2026-03-10",
    "availableFrom": "18:00",
    "availableTo": "23:00"
  },
  "googleFormUrl": "https://docs.google.com/forms/d/e/YOUR_ID/viewform?embedded=true",
  "gallery": ["/assets/data/photo1.jpg", "/assets/data/photo2.jpg"],
  "menu": [
    {
      "courseEn": "Starter",
      "courseZh": "頭盤",
      "items": [
        { "nameEn": "Dish Name", "nameZh": "菜名", "emoji": "🍤", "descEn": "...", "descZh": "..." }
      ]
    }
  ]
}
```

Guest data is managed via the admin Wedding Planner and exported to `assets/data/guests.json`.

---

## Local Development

```bash
cd wedding
npm install
npm start
# → http://localhost:3000
```

Requires Node.js v18+. Uses Express + nodemon for hot reload.

---

## Deployment

Deploy the `wedding/` folder as the site root (no build step needed).

**Cloudflare Pages / Vercel:** set the root directory to `wedding/` and leave the build command empty.

The site is fully static — `server.js` and `node_modules` are not required in production.

---

## Key Design Decisions

| Question | Answer |
|---|---|
| Framework? | Pure static HTML — no build step, instant deploy |
| CSS approach? | Custom CSS with design tokens (`--accent`, `--gold`, `--bg`, etc.) |
| i18n? | `data-i18n` attributes + `GW.setLang()` in `gw.js`; lang stored in `localStorage` |
| QR format? | `btoa(JSON.stringify([guestId, ...]))` — decoded client-side via jsQR |
| Video lock? | Client-side time check against `availableDate` + `availableFrom` in config |
| Admin auth? | PIN stored in `config.json`, checked client-side, cookie set for session |
| Bot protection? | `robots.txt` with `Disallow: /` + `noindex` meta on every page |
