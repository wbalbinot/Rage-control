# Rage Control — Microphone Monitor

Small, local web app that listens to your microphone and provides audio and visual feedback (page color) to indicate loud speech. Useful as a friendly reminder when someone is shouting in voice channels.

Files added
- `index.html` — main UI and controls
- `app.js` — microphone monitoring logic and adjustable parameters
- `style.css` — layout and simple styling

How to use
1. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
2. The page will request microphone permission and begin monitoring automatically — no Start button or sliders.

Defaults
- The app uses sensible defaults for calibration, threshold and sensitivity so it should be "work ready" on most desktops.

If you need finer control, open `app.js` and tweak the `CONFIG` defaults near the top of the file.

Notes
- The app runs entirely in the browser; no server is required.
- For quick testing, open the page locally (drag file into browser or use a simple static server).

Possible improvements
- Visual smoothing, longer-term averaging, or per-band detection.
- Option to play a louder notification sound or send desktop notifications.

Enjoy — and keep it friendly!
