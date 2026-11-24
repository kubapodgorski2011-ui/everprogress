# EverProgress

A local-first personal progress tracker built with HTML, CSS and vanilla JavaScript.

## Files

- `index.html` — app structure
- `style.css` — responsive dark/light styling
- `app.js` — task management, IndexedDB storage, charts, insights and backup
- `manifest.json` — installable web app metadata
- `service-worker.js` — offline app shell cache
- `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — app icons

## Run on your PC

A Progressive Web App needs to be served from `localhost` or HTTPS. Do not open `index.html` directly with a `file://` URL.

### Option 1: Visual Studio Code

1. Install Visual Studio Code.
2. Open the `EverProgress` folder.
3. Install the **Live Server** extension.
4. Right-click `index.html` and choose **Open with Live Server**.
5. The app should open at an address similar to `http://127.0.0.1:5500`.

### Option 2: Python local server

If Python is installed, open a terminal in this folder and run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Use it on your phone

### Quick local-network test

1. Connect your PC and phone to the same trusted Wi-Fi network.
2. Find your PC's local IPv4 address.
   - Windows: open Command Prompt and run `ipconfig`.
   - macOS: open System Settings > Wi-Fi > Details, or run `ipconfig getifaddr en0`.
3. On your phone, open `http://YOUR-PC-IP:8000` (replace with the address shown on your PC).
4. Your firewall may ask whether to allow local network access. Only allow it on a trusted private network.
5. This local HTTP address is useful for testing, but it is not a secure production deployment and PWA installation/offline features may be limited on a phone.

## Install it as a phone app

For reliable PWA installation, publish the folder to a static host that provides HTTPS, such as GitHub Pages or another trusted static hosting provider.

- Android: open the HTTPS site in Chrome, open the browser menu, and choose **Install app** or **Add to Home screen**.
- iPhone: open the HTTPS site in Safari, tap Share, then **Add to Home Screen**.

Browser menus and install support vary by device and browser.

## Data and privacy

- Tasks are stored in IndexedDB in the current browser profile on the current device.
- No account, application server, analytics, or cloud sync is included.
- PC and phone data are separate. Use Settings > Export JSON and Settings > Import JSON to move a backup manually.
- Browser storage can be cleared by browser cleanup, device settings, or uninstalling/resetting the browser. Export backups regularly.
- The app caches its local shell for offline use after it has been loaded successfully once while online.

## Security notes

- User task names are inserted using `textContent`, not interpreted as HTML.
- The app does not use `eval`, external APIs, login forms, or collect task data remotely.
- Serve the deployed app over HTTPS.
- This is a small personal app, not a security-audited product. A restrictive hosting-level Content Security Policy is recommended for production.
- The starter app does not load third-party fonts, analytics, or remote scripts.

## Progress calculations

- Completion percentage = completed tasks / all tasks recorded for that day.
- Net score = +1 for each completed task and −1 for each incomplete task.
- Empty days are not treated as failed days and are excluded from averages.
- Insights use recent recorded task data and avoid guessing why a task was not completed.
