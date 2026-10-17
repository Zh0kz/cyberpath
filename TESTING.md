# V2.2.1 verification notes

Checks run before packaging:

- `node --check app.js`
- `node --check data.js`
- `node --check validator.js`
- `node --check service-worker.js`
- 10 validator regression tests passed, including TCP handshake formatting variants and rejection of `ACK` → `ACT` typo.
- All 21 short-answer missions self-match at least their declared accepted answers through the new validator.
- Data integrity check: 87 missions, 8 modules, 8 bosses, 36 review cards; all 87 missions have a check definition.
- HTML local asset reference check passed; no referenced local CSS/JS/manifest/icon file is missing.

Environment limitation: the container's managed Chromium policy blocks loopback/file pages, so a full interactive browser E2E click-through could not be executed here. The package should therefore still be tested once in the user's normal Chrome before replacing the GitHub Pages deployment.
