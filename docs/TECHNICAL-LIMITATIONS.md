# Technical limitations — detect & mitigate

What can go wrong on a visitor's computer, how the page notices it by itself, and what it does then.
Detection code: `js/core/system-check.js` (shared by the app and `experiments/e9-limitations`).
Rule of thumb: **every camera or model failure ends in a working mouse mode**, with one plain sentence about why.

Status: ✅ built — checked in headless Chrome on 14 Nov for #1, 4, 6, 9, 11, 16 and the full mouse-mode run · 🟡 built, still to test with a real webcam / situation · 🔍 known limitation, only partly solvable

## 1. Before anything loads (instant checks)

| # | Limitation | How it's detected | Mitigation | Status |
|---|---|---|---|---|
| 1 | Opened as a file (`file://`) | `location.protocol === 'file:'` in an inline classic script (modules never run there) | Red banner: "run `npx serve`", static story shown | ✅ |
| 2 | Not https (camera blocked) | `window.isSecureContext === false` | Camera button disabled, mouse mode offered; hosting must have a certificate | ✅ |
| 3 | No camera API (old browser) | `!navigator.mediaDevices?.getUserMedia` | Mouse mode + "try a recent Chrome, Edge or Firefox" | ✅ |
| 4 | No camera at all | `enumerateDevices()` has no `videoinput` | Camera button disabled from the start | ✅ |
| 5 | Camera already blocked for this site | `navigator.permissions.query({ name: 'camera' })` = `denied` (Chrome/Edge only) | Explain how to unblock (camera icon in the address bar) + mouse mode | 🟡 |
| 6 | No GPU / software rendering → TF.js on CPU (0.5 fps in E1) | `navigator.gpu.requestAdapter()`, WebGL2 context, renderer name contains SwiftShader / llvmpipe | Warn + suggest hardware acceleration; mouse mode recommended | ✅ (headless Chrome = SwiftShader) |
| 7 | WebGL only (≈ 22 fps in E1) | Same check, WebGPU missing | HandPose `lite` instead of `full` (E1: lite is faster) | 🟡 |
| 8 | Weak laptop (< 4 cores) | `navigator.hardwareConcurrency`, `deviceMemory` | Only one model detects at a time; FaceMesh only loads during the stir step | 🟡 |
| 9 | Small screen | `innerWidth < 1024 or innerHeight < 600` | Notice "best on a laptop" + "continue anyway" | ✅ |
| 10 | Visitor prefers reduced motion | `prefers-reduced-motion: reduce` | `gsap.matchMedia` → shorter, calmer tweens (E7), CSS transitions off | ✅ |
| 11 | GSAP or a plugin doesn't load | `window.gsap` / plugin globals missing | Static text version of the story | ✅ |
| 12 | JavaScript off | `<noscript>` | Static text version | ✅ |

## 2. Starting the camera and the models

| # | Limitation | How it's detected | Mitigation | Status |
|---|---|---|---|---|
| 13 | Visitor clicks "Block" | `NotAllowedError` → camera machine `denied` | Sentence + mouse mode; "try again" stays available | ✅ |
| 14 | Camera busy (Zoom, Teams, Photo Booth) | `NotReadableError` → `busy` | "Close the other app and try again" | 🟡 |
| 15 | ml5 is 4.5 MB | — | Lazy-loaded only after "Use my camera" (`loadScript`), 30 s timeout | ✅ |
| 16 | Model weights come from a CDN at runtime (no internet, blocked school network, CDN down) | `TypeError: Failed to fetch` during `ml5.handPose()` | Explained as a download problem → mouse mode. **To investigate:** self-hosting the model files so only our own server is needed | ✅ detected / 🔍 self-hosting |
| 17 | Model takes forever | `withTimeout(…, 45 s)` | Timeout error → mouse mode | ✅ |
| 18 | ml5 1.4 without p5 returns a promise from `handPose()` / `faceMesh()` | (bug found in E1) | Always `await` the factory; `neuralNetwork()` is not a promise | ✅ |
| 19 | `<video>` without width/height → model sees 0×0 | — | Set `video.width/height` from `videoWidth/videoHeight` after `play()` | ✅ |

## 3. While playing

| # | Limitation | How it's detected | Mitigation | Status |
|---|---|---|---|---|
| 20 | Camera unplugged / taken by another app mid-story | Track `ended` / `mute`, `devicechange` with no cameras | Session machine → `blocked`; notice with **Try again** / **Continue with my mouse** | ✅ (simulated) 🟡 (real unplug) |
| 21 | Tab in the background | `visibilitychange` | Detection stops (`detectStop`), resumes on return; no burst of stale results | ✅ |
| 22 | Low frame rate | Rolling fps over 2 s (< 20 laggy, < 10 too slow) | Status light shows fps; suggest lite model / closing tabs; mouse mode below 10 | 🟡 |
| 23 | Too dark / backlit (window behind you) | Average brightness of a 32×24 copy of the frame; edges much brighter than centre = backlit | Hint "turn on a light in front of you" | 🟡 |
| 24 | Hand too close, too far, half out of the image | Palm size in px; keypoints within 3 % of the border | Hint "come closer" / "move back" / "keep your hand in the middle" | 🟡 |
| 25 | Two people / two hands in view | `maxHands: 1` picks one, possibly the wrong one | 🔍 Ask to cook alone in the intro; later: follow the hand closest to the previous position | 🔍 |
| 26 | Movement depends on distance to the camera | — | Every gesture is measured in **palms** (wrist → middle finger base), not pixels | ✅ |
| 27 | Mirrored image confuses left/right | — | `flipped: true` on the models + mirrored preview | ✅ |
| 28 | Jitter when the hand is still | E1: worst gap 74–283 ms; E2 graph | Smoothing (EMA in the detectors, `gsap.quickTo` in the mappings) + hysteresis on every event | ✅ |
| 29 | Fast chopping is too small to count (E2 finding) | — | "Too fast" counts strokes separately from chops | ✅ |
| 30 | A laugh looks like "too spicy" (mouth open + eyes scrunched) | Smile warmth > 0.5 at the same moment | Spicy score damped while smiling (E6 checkbox) | 🟡 |
| 31 | Glasses, beards, head tilt change the face measurements | Neutral calibration (median of 40 frames) per visitor | Relative thresholds instead of absolute ones; "calibrate again" | 🟡 |
| 32 | Self-trained classifier only knows *this* visitor in *this* light | Confusion matrix in E5; fewer than 10 samples recorded = warning | Teach at the start of every visit (it's part of the story); distance rule as fallback ("skip") | 🟡 |
| 33 | Model accuracy may differ per skin tone, hand size, jewellery, gloves | 🔍 Can't be detected live | 🔍 Prototype test (E9 in the plan) with 5 different people; every step has "skip this step" and mouse mode | 🔍 |
| 34 | Runtime error in a step | `window.onerror`, `unhandledrejection`, try/catch around `step.enter` | Rate-limited toast, step can be skipped | ✅ |

## 4. Privacy

Nothing leaves the browser: no recording, no upload. The video goes only into the models. Said in the setup screen, before the browser asks for permission.

## How to test (E9 test plan)

Open `experiments/e9-limitations/` and log a snapshot for each of these:

1. `file://` · 2. http via the local IP instead of localhost · 3. block the camera · 4. camera busy in Photo Booth · 5. unplug an external camera (or "simulate") · 6. dark room · 7. window behind you · 8. hand very close / very far / at the edge · 9. tab in the background for 10 s · 10. Chrome with hardware acceleration off · 11. wifi off before pressing "Run" · 12. Firefox and Safari.
