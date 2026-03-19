# Simple Wedding Planner

A static wedding banquet website with an admin planner tool. Designed for deployment on Cloudflare Pages or Vercel — no build step required.

---

## Repository Structure

```text
simple-wedding-planner/
├── wedding-v3/                       # ← Current deployable static site
│   ├── index.html                    # Public home page
│   ├── table.html                    # Find My Table (QR code scan)
│   ├── menu.html                     # Wedding banquet menu
│   ├── video.html                    # Love story video (time-locked)
│   ├── gallery.html                  # Photo gallery with lightbox
│   ├── wish.html                     # Send wishes (Google Form embed)
│   ├── robots.txt                    # Disallow all bots
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                         # Service worker (PWA offline support)
│   │
│   ├── assets/
│   │   ├── css/
│   │   │   ├── gw.css                # Shared public styles (design tokens, layout)
│   │   │   ├── app.css               # Admin planner styles
│   │   │   └── shared.css            # Admin nav styles
│   │   ├── js/
│   │   │   ├── gw.js                 # Shared public JS (i18n, config loader, QR utils, toast, scroll-top)
│   │   │   ├── admin-shared-nav.js
│   │   │   ├── admin-wedding.js
│   │   │   ├── admin-homestay.js
│   │   │   ├── admin-find-table.js
│   │   │   └── libs/jsqr.min.js      # jsQR (bundled, no CDN dependency)
│   │   ├── data/
│   │   │   ├── config.json           # Event config (couple names, date, menu, video, etc.)
│   │   │   ├── guests.json           # Guest list with table assignments
│   │   │   ├── logo.svg              # Wedding logo (nav + drawer)
│   │   │   ├── banner.jpg            # Home page banner image
│   │   │   ├── floral-background.jpg # Page background texture
│   │   │   └── montage.mp4           # Love story video
│   │   └── img/
│   │       ├── banquet-menu.png      # Decorative menu image
│   │       └── icons/                # Dish icons for menu page
│   │           ├── beef.svg, broccoli.svg, chicken.svg, crab.png
│   │           ├── dessert.svg, duck.svg, fish.svg, leaf.svg
│   │           ├── lotus.svg, pork.svg, ribs.svg, rice.svg
│   │           ├── shrimp.svg, soup.svg, soup-dessert.svg
│   │           └── tray-with-cover.svg
│   │
│   ├── admin/
│   │   ├── login.html                # Admin login (PIN-based, cookie auth)
│   │   ├── index.html                # Admin dashboard
│   │   ├── wedding.html              # Wedding seating planner (canvas-based)
│   │   ├── homestay.html             # Homestay room assignment planner
│   │   ├── find-table.html           # Admin guest search + QR code generation
│   │   └── scan-qr.html              # Admin QR code scanner
│   │
│   ├── server.js                     # Express static server (local dev only, port 3002)
│   └── package.json
│
├── wedding-v2/                       # Previous version (kept for reference)
├── wedding/                          # Legacy version (kept for reference)
├── sample-webapp/                    # Reference app (source of admin planner UI)
├── requirements/                     # Original requirements docs
└── README.md
```

---

## Public Pages

| Page | URL | Description |
|---|---|---|
| Home | `/` | Nav cards linking to all sections |
| Find My Table | `/table.html` | Guests scan invitation QR code to find their seat |
| Wedding Menu | `/menu.html` | Banquet courses with dish icons, sticky course tabs |
| Love Story Video | `/video.html` | Time-locked video (unlocks at configured date/time) |
| Photo Gallery | `/gallery.html` | Masonry photo grid with lightbox and swipe gesture |
| Send Wishes | `/wish.html` | Embedded Google Form with loading indicator |

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
| Find Table (Admin) | `/admin/find-table.html` | Guest name search + QR code generation |
| Scan QR (Admin) | `/admin/scan-qr.html` | QR code scanner |

---

## Configuration

Edit `wedding-v3/assets/data/config.json`:

```json
{
  "projectName": "Smith & Jones Wedding 💍",
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
        {
          "nameEn": "Dish Name",
          "nameZh": "菜名",
          "descEn": "Description",
          "descZh": "描述",
          "icon": [
            { "type": "svg", "value": "chicken.svg" },
            { "type": "png", "value": "crab.png" },
            { "type": "emoji", "value": "✨" }
          ]
        }
      ]
    }
  ]
}
```

### Menu `icon` field

Each dish item has an `icon` array of display entries rendered left-to-right:

| `type` | `value` | Renders as |
|---|---|---|
| `"svg"` / `"png"` | filename in `assets/img/icons/` | `<img>` 28×28px |
| `"emoji"` | any emoji string | inline `<span>` |

Guest data is managed via the admin Wedding Planner and exported to `assets/data/guests.json`.

---

## Local Development

```bash
cd wedding-v3
npm install
npm start
# → http://localhost:3002
```

Requires Node.js v18+. Uses Express + nodemon for hot reload.

---

## Deployment

Run the build script from the repo root to copy all deployable files into `dist/` (strips `node_modules`, `server.js`, and `package*.json`):

```bash
sh build.sh
```

Output: `dist/wedding-v3/` (and older versions) ready to upload.

**Cloudflare Pages / Vercel:** set the root directory to `dist/wedding-v3/` and leave the build command empty.

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
| Menu icons? | Per-dish `icon` array in `config.json` — supports SVG, PNG, and emoji entries |
