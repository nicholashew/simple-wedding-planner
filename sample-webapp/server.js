const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// __dirname is always the directory containing server.js, regardless of where
// the process was launched from. All paths are anchored here.
const PUBLIC = path.join(__dirname, 'public');

// Serve all static assets (css, js, images, etc.) from public/
app.use(express.static(PUBLIC));

// Routes
app.get('/', (_req, res) => res.redirect('/homestay'));

app.get('/homestay', (_req, res) =>
  res.sendFile(path.join(PUBLIC, 'pages', 'homestay.html'))
);

app.get('/wedding', (_req, res) =>
  res.sendFile(path.join(PUBLIC, 'pages', 'wedding.html'))
);

app.listen(PORT, () => {
  console.log(`\n🏠💒  Planner App → http://localhost:${PORT}\n`);
  console.log(`   Homestay : http://localhost:${PORT}/homestay`);
  console.log(`   Wedding  : http://localhost:${PORT}/wedding`);
  console.log('\n  Hot-reload: npm run dev  |  Static-only: npm run dev:static\n');
});