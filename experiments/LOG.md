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
Approach: palm centre (wrist + 4 finger bases, in palms) over the last 1.5 s → centre = mean, radius = mean distance, roundness = CV of the distances. While CV ≤ 0.45 and radius ≥ 0.35 palms, the change in angle around the centre is added up → turns + turns/second. Fist vs open hand by "openness" (fingertips → wrist in palms, < 1.25 = fist).
Mapping: grind = turns → seeds crack one by one (accumulate); stir = turns → curry darker (accumulate), speed → steam (continuous), > 1.5 turns/s → "slowly" (state).
Pass: 5 slow circles = 5 ± 0.5 turns · still / chop / wave / wrong shape < 0.5 turns.
Mouse check (14 Nov): 5 drawn circles → 4.44 turns (the first ~8 points are needed to find the centre, so ~0.5 turn is lost at the start). Fine for "6 turns to finish", but keep in mind when tuning.

| Time | Mode | Test | Turns | Peak speed | Verdict |
|------|------|------|-------|------------|---------|
|      | grind | five slow circles |  |  |  |
|      | grind | hand still |  |  |  |
|      | grind | chop up and down |  |  |  |
|      | grind | wave side to side |  |  |  |
|      | grind | wrong shape (open) |  |  |  |
|      | stir | five slow circles |  |  |  |
|      | stir | wrong shape (fist) |  |  |  |
|      | stir | as fast as I can |  |  |  |

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
