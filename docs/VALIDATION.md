# MVP validation record

2026-10-27 / cloud Linux, Node.js 24.19.0, Python 3.12.14, system Chromium.

## Verified in this instance

- `npm ci --cache /workspace/.npm-cache`: clean lockfile install succeeded.
- `npm run build`: strict TypeScript check and production Vite build succeeded.
- `npm run lint`: succeeded.
- `npm test`: 5 tests passed. EMA, raw values, independent devices, timeout/recovery, threshold boundaries, invalid input, device limit, and mock WebSocket retry/cancellation.
- `BRIDGE_PYTHON=/workspace/orchestra-venv/bin/python PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`: 6 tests passed (3 scenarios × desktop/mobile).
  - DEMO device count/sliders, user-triggered audio start, timeout, sound controls, CSV download, panel visibility and responsive width. No JavaScript page errors observed.
  - All four actual Web Audio graphs render finite nonzero samples in OfflineAudioContext; stale devices render silence. This verifies synthesis, not physical speaker output or artistic sound quality.
  - Built frontend served by the Python bridge on local HTTP, simulated WS packets, explicit SIMULATION labeling, server termination and real reconnect after restart.
- `python -m py_compile bridge/server.py`: succeeded; pinned Bleak/websockets installed.
- Desktop stage screenshot visually inspected.

## Not verified / external blockers

- Real Windows BLE scan, Bluetooth adapters, Android/iOS advertising, 2–5 physical devices, field acoustics and long-duration performance: no relevant hardware in this cloud instance. Transport simulation must not be interpreted as BLE reception.
- WSS certificates/server are not implemented. Local HTTP + WS is the supported bridge path; HTTPS + insecure WS is rejected by the UI.
- GitHub API access initially returned `Forbidden`, then recovered. Branch `feat/orchestra-mvp` was pushed and PR #1 created. Remote CI passed its install/lint/unit/build steps; final remote outcome is recorded in the delivery report.
- Pages enablement API returned `403 Resource not accessible by integration`. A repository administrator must select Settings → Pages → Source: GitHub Actions before deployment can succeed.
- Public-site HTTPS fetch initially failed through policy and later returned HTTP 404 (Pages not enabled). A Chromium attempt through the proxy reports an untrusted certificate. Adding the environment proxy CA to the browser trust store was rejected by automatic approval review; no trust-store change or TLS-verification bypass was performed. Published DEMO is not verified.
- Browser download from `cdn.playwright.dev` was blocked; system Chromium was used successfully for local tests.

## Deliberate MVP limits

Names, colors, sound/visual settings and device registration are session-local. The first five advertising devices are auto-registered; use repeated bridge `--device` arguments to select the installation's devices. No native phone advertiser, identity persistence, authentication service, arbitrary audio file player or remote multi-PC sync is included.

CI and Pages workflow files are included; their presence is not evidence of a successful deployment. See README for the Windows procedure and Pages settings.
