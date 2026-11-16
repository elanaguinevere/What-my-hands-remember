# Experiment log — What my hands remember

## experiment 0: does the camera work?

## experiment 1: what are the right conditions for handpose to work?
| Backend | Model | Light    | FPS  | ms per result | Worst gap | Hand found | Verdict     |
|---------|-------|----------|------|---------------|-----------|------------|-------------|
| webgpu  | full  | normal   | 51.6 | 19            | 128 ms    | 100%       | PASS        |
| webgpu  | lite  | normal   | 57.4 | 17            | 113 ms    | 100%       | PASS        |
| webgpu  | lite  | dim 0.35 | 39.0 | 26            | 139 ms    | 100%       | PASS        |
| webgpu  | lite  | dim 0.2  | 31.5 | 32            | 283 ms    | 100%       | PASS        |
| webgl   | full  | normal   | 22.0 | 46            | 74 ms     | 100%       | PASS (just) |
| cpu     | full  | normal   | 0.5  | 2061          | 4530 ms   | 70%        | FAIL        |

## experiment 2: can I do a chopping motion that gets detected?

| Time     | Test              | Duration | Slices | Ignored (too fast) | False | Missed | fps  | Verdict |
|----------|-------------------|----------|--------|--------------------|-------|--------|------|---------|
| 12:12:29 | normal chopping   | 59 s     | 8/8    | 0                  | 0     | 0      | 59.4 | PASS    |
| 12:12:50 | normal chopping   | 20 s     | 8/8    | 0                  | 0     | 0      | 52.9 | PASS    |
| 12:13:04 | hand still        | 14 s     | 0/8    | 0                  | 0     | 0      | 45.6 | PASS    |
| 12:13:23 | slow up and down  | 19 s     | 0/8    | 0                  | 0     | 0      | 29.9 | PASS    |
| 12:13:43 | as fast as I can  | 20 s     | 3/8    | 0                  | 0     | 0      | 30.3 | FAIL    |

Finding: fast chops are small, so they never drop the 2 palms needed to count as a chop. Because "too fast" only looked at counted chops, it could never trigger.
Change: "too fast" now counts every fast stroke (more than 3.5 per second), separately from chops. The drop is now measured at the deepest point of the chop.
To do: redo all four tests with the new version.

## experiment 3: how can I make the scroll transitions fun?

## experiment 4: can I turn circles into grinding and stirring?
Approach (v1): palm centre (wrist + 4 finger bases, in palms) over the last 1.5 s → centre = mean, radius = mean distance, roundness = CV of the distances. While CV ≤ 0.45 and radius ≥ 0.35 palms, the change in angle around the centre is added up → turns + turns/second. Fist vs open hand by "openness" (fingertips → wrist in palms, < 1.25 = fist).
Mapping: grind = turns → seeds crack one by one (accumulate); stir = turns → curry darker (accumulate), speed → steam (continuous), > 1.5 turns/s → "slowly" (state).
Pass: 5 slow circles = 5 ± 0.5 turns · still / chop / wave / wrong shape < 0.5 turns.
Mouse check (14 Nov): 5 drawn circles → 4.44 turns.

### v1 results with the camera (16 Nov)
| Time     | Mode  | Test              | Duration | Turns | Peak speed   | fps  | Verdict |
|----------|-------|-------------------|----------|-------|--------------|------|---------|
| 09:05:55 | grind | five slow circles | 99 s     | 16.05 | 2.23 turns/s | 47.4 | FAIL    |
| 09:08:30 | stir  | five slow circles | 34 s     | 16.58 | 0.87 turns/s | 44.6 | FAIL    |

Finding: ~3× too many turns, in both modes. Stir: 16.6 turns in 34 s = a steady 0.5 turns/s for the whole round, so it isn't only extra movement before the circles.
Simulated (node, 47 fps) to find out why:
- v1 divided the absolute palm position (pixels) by the *current* palm size. While circling, the hand tilts, so the palm size changes with the circle → the path gets distorted and loops. Simulated with the palm size following the circle: 5 circles → 1.1 to 3.8 turns depending on the pattern. Real data wobbles differently, but this is clearly wrong.
- v1 used the mean of the last 1.5 s as the centre. That only works when the window holds a whole circle: 4 s per turn → 2.9 turns, 6 s per turn → 0 turns. And mom asks for *slow* stirring.
- v1 lost ~0.5 turn at the start of every circle while finding the centre.
- The rounds also included everything since the camera started (no reset), so the 99 s round counts more than the 5 circles.

### v2 (16 Nov): `js/gestures/circle.js`, now shared by E4 and the app
- angles in plain pixels (an angle doesn't depend on distance to the camera); palm size (median over the window) only for the radius check
- least-squares circle fit over 2.5 s instead of the mean → part of a circle is enough
- not a line: flatness (short ÷ long axis of the path) ≥ 0.25; roundness CV ≤ 0.3
- lock on after 10 round frames in a row, let go after 10 non-round ones (hysteresis); on lock-on the arc already in the window is counted once
- E4 page: "Start round" with 3-2-1 (resets), round timer, auto-reset when the camera starts, a dot flashes on the path for every whole turn, "Save recording" + "Replay" (frames as JSON, to replay a strange round with other settings)

Simulation, 300 runs (10 cases × 3 palm-size patterns × 10 random runs), all PASS:
5 circles at 1.5 / 3 / 4 / 6 s per turn, small circles (30 px), circles at the edge of the image → 5 ± 0.5 · hand still, chop, wave → < 0.5 · 10 fast circles → 9–11.
Known: a figure 8 still gives ~0.6–1 turn (not in the test plan, not a cooking gesture).
Mouse check: 5 circles of 3 s → 4.91 turns (grind and stir), wave → 0.00.

To do: redo the camera rounds with v2 (press "Start round" first) and fill the table below. If a round is off, save its recording.

| Time     | Mode  | Test                     | Turns | Peak speed | Verdict |
|----------|-------|--------------------------|-------|------------|---------|
| 09:18:44 | grind | five slow circles (14 s) | 7.14  | 0.98       | FAIL    |
| 09:19:08 | grind | hand still               | 0.00  | 0.00       | PASS    |
| 09:19:32 | grind | chop up and down         | 0.00  | 0.00       | PASS    |
| 09:19:56 | grind | wave side to side        | 0.00  | 0.00       | PASS    |
| 09:20:16 | grind | wrong shape (open)       | 0.00  | 0.00       | PASS    |
| 09:20:36 | grind | as fast as I can         | 0.00  | 0.00       | FAIL    |

Finding (v2, 16 Nov): the "nothing should count" tests all pass now. Two problems left: 5 slow circles → 7.14 (still ~1.4× too many) and fast circles → nothing at all. fps dropped to 29–42 in some rounds (49.8 in the first).
Next: the log now has a "why" line per round (hand lost %, right shape %, round %, counting %, median radius / CV / flatness). Redo both failing rounds and save their recordings, so they can be replayed with other settings.

Second v2 run (16 Nov, with the "why" line):

| Time     | Mode  | Test              | Turns | Peak | fps  | Hand lost | Counting | Verdict     |
|----------|-------|-------------------|-------|------|------|-----------|----------|-------------|
| 09:23:20 | grind | five slow circles | 5.79  | 0.68 | 24.4 | 16%       | 67%      | FAIL (just) |
| 09:23:43 | stir  | five slow circles | 5.34  | 0.67 | 28.7 | 15%       | 74%      | PASS        |
| 09:24:02 | stir  | hand still        | 0.00  | 0.00 | 26.6 | 11%       | 0%       | PASS        |
| 09:24:21 | stir  | chop up and down  | 0.34  | 0.02 | 33.5 | 26%       | 1%       | PASS        |
| 09:24:39 | stir  | wave side to side | 0.00  | 0.00 | 35.1 | 12%       | 0%       | PASS        |
| 09:25:02 | stir  | wrong hand shape  | 0.00  | 0.00 | 28.7 | 31%       | 7%       | PASS        |
| 09:25:24 | stir  | as fast as I can  | 0.66  | 0.05 | 33.1 | 38%       | 1%       | FAIL        |

Finding: slow circles are about right now (5.3–5.8 for 5). The extra is probably the hand already moving in an arc before the first circle, which gets counted when the tracker locks on. For the app that's fine ("about 6 turns until it smells").
Fast circles fail because HandPose loses the hand in 38% of the frames (motion blur), and v2 threw the whole path away at every missed frame, so it never got going (round 17%, counting 1%).
Also: fps was lower than earlier that morning (24–35 instead of 45–50), and the hand was lost in 11–16% of frames even when still or slow → check the light (E9) and close other tabs before testing.

### v2.1 (16 Nov): bridge short gaps
- A frame without a hand no longer resets the tracker; only a gap > 0.3 s does.
- After a gap, the allowed angle jump grows with the time that passed (max 2.6 rad, below π so the direction can't flip).

Simulated with the fps and loss rates from the logs above (30 runs per case):

| Case                                        | Result                                        |
|---------------------------------------------|-----------------------------------------------|
| 5 slow circles (3 s, 25 fps, 16% lost)      | 30/30 PASS                                    |
| 5 circles of 6 s (25 fps, 16% lost)         | 30/30 PASS                                    |
| still / chop / wave (11–26% lost)           | 30/30 at 0 turns                              |
| fast, 0.5 s per turn (33 fps, 38% lost)     | "too fast" 30/30, ~18 of 20 turns counted     |

Very fast circles still undercount, but there the "too fast" badge is what matters.

v2.1 with the camera (16 Nov):

| Time     | Mode  | Test              | Turns | Peak | fps  | Hand lost | Counting | Verdict                 |
|----------|-------|-------------------|-------|------|------|-----------|----------|-------------------------|
| 09:32:15 | grind | five slow circles | 5.15  | 0.59 | 26.7 | 12%       | 63%      | PASS                    |
| 09:32:35 | grind | as fast as I can  | 17.25 | 2.85 | 34.7 | 51%       | 84%      | PASS ("too fast" shown) |
| 09:32:57 | stir  | five slow circles | 5.60  | 0.80 | 48.0 | 15%       | 88%      | FAIL (just, +0.1)       |
| 09:33:15 | stir  | as fast as I can  | 21.20 | 2.83 | 42.3 | 40%       | 88%      | PASS ("too fast" shown) |

Finding: bridging short gaps fixed fast circles. Even with half the frames lost (51%), the tracker keeps counting (84–88% of the time) and the "too fast" badge shows (peak ~2.8 turns/s).
Slow circles: 5.15 and 5.60 for 5 real circles. Across all v2/v2.1 rounds the count is 0.15–0.8 turn too high, never too low → most likely the arc the hand already makes before the first circle, counted at lock-on.

Decision: E4 concluded. The count is accurate enough for the experience: grinding and stirring are about "keep going until it smells / thickens" (goal 6 turns), not exact numbers, so +0.5 turn doesn't change what the visitor sees. Still / chop / wave / wrong shape never count.
Possible later tweak (only if the prototype test shows it's needed): count at most the last ~1 s of the arc at lock-on.
Settings kept: radius ≥ 0.35 palms · CV ≤ 0.3 · flatness ≥ 0.25 · fist < 1.25 · lock-on 10 frames · max gap 0.3 s · too fast > 1.5 turns/s.

## experiment 5: can the visitor teach it their own hands, and can one pinch be one spice?
Approach: ml5.neuralNetwork (classification), 42 inputs (keypoints relative to the wrist ÷ palm size), classes open / fist / pinch, ≥ 15 samples each (2.5 s after 3-2-1), normalizeData, 40 epochs, batch 16. Classify every 70 ms. Pinch counts when pinch ≥ 0.75 for 3 results in a row; the next pinch only counts after another shape ≥ 0.6 (re-arm). Baseline to compare: thumb–index distance < 0.32 palms (no training).
Pass: ≥ 90% correct per class in the 5 s test · 3 pinches = 3 spices · holding a pinch = 1 · opening/closing a fist 10× = 0.
Samples can be saved/loaded as JSON (handy for the consultation demo).

| Test | Network | Distance rule | Verdict |
|------|---------|---------------|---------|
| open correct (%) |  | – |  |
| fist correct (%) |  | – |  |
| pinch correct (%) |  | – |  |
| 3 pinches → spices |  |  |  |
| hold pinch 5 s → spices |  |  |  |
| fist open/close 10× → spices |  |  |  |

## experiment 6: can FaceMesh tell "it's right" from "too spicy"?
Approach: 40 neutral frames → baseline (median). Smile = mouth width ÷ face width + 0.8 × corner lift → warmth = (ratio ÷ baseline − 1.04) ÷ 0.14, "right" when > 0.72 for 1.2 s. Too spicy = mouth opened (+0.06 of face height) AND eyes scrunched (−22% eye height ÷ width), held 0.6 s → mom laughs, yogurt arcs in (MotionPath). Spicy is damped while smiling, because a laugh also opens the mouth and scrunches the eyes.
Pass: 5/5 smiles → right · 5/5 spicy faces → spicy · neutral + talking 20 s → nothing · big laugh → not spicy.

| Time | Test | Right | Spicy | fps | Verdict |
|------|------|-------|-------|-----|---------|
|      | smile 5× |  |  |  |  |
|      | spicy face 5× |  |  |  |  |
|      | neutral + talking 20 s |  |  |  |  |
|      | big laugh |  |  |  |  |
|      | with glasses |  |  |  |  |

## experiment 7: the cooking animations (GSAP)
ScrollTrigger (pin + scrub, progress bar, active dot) · SplitText (title per letter with `autoSplit`, quote words fading in on scroll, finale line with masks) · MorphSVG (seeds → powder) · DrawSVG (steam drawn, recipe card wiped blank) · MotionPath (yogurt spoon along an arc) · ScrollTo (dot navigation, "begin again") · `gsap.matchMedia` for reduced motion.
Checked 14 Nov: scrolls through without console errors. Add `?markers` to see the trigger positions.
To decide: which scenes are scroll-driven (only the finale) and which are gesture-driven (the recipe steps).

## experiment 8: what makes a mapping feel like cooking?
Five kinds of mapping, each with its own range, curve and smoothing (editable live):
- direct: palm position → spoon position (smoothing 0.12 s) — feels like holding the spoon
- continuous: hand speed → steam (power2.out, 0.8 s) — rises and calms down with you
- accumulate: distance stirred → curry colour — never goes back, like real cooking
- event: thumb–index distance → one pinch of spice, with hysteresis (fire > 0.9, re-arm < 0.3)
- state: hand in view → lid off; lid only goes back on after 0.8 s without a hand (no flicker)
Pass (with the prototype test): testers can say what each movement does without being told; nothing jitters while the hand is still.

| Mapping | Settings that felt right | Notes |
|---------|--------------------------|-------|
| direct |  |  |
| continuous |  |  |
| accumulate |  |  |
| event |  |  |
| state |  |  |

## experiment 9: technical limitations
See `docs/TECHNICAL-LIMITATIONS.md` for the full list (34 items: detection + mitigation).
Checked 14 Nov in headless Chrome: file:// banner + static story · no camera → camera button disabled · software GPU detected · small screen notice · GSAP blocked → static story · model download blocked → "could not be downloaded" → mouse mode.

| Situation | What the page said | Mitigation worked? |
|-----------|--------------------|--------------------|
| file:// |  |  |
| http on local IP |  |  |
| camera blocked |  |  |
| camera busy (Photo Booth) |  |  |
| camera unplugged |  |  |
| dark room |  |  |
| window behind me |  |  |
| hand too close / far / edge |  |  |
| tab hidden 10 s |  |  |
| hardware acceleration off |  |  |
| wifi off |  |  |
| Firefox / Safari |  |  |
