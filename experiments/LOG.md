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

### v1 results with the camera (16 Nov)

```
trained · {"open":148,"fist":149,"pinch":148} · 40 epochs · 3.5 s · loss 0.004
```

| Time     | Mom showed | Added | Model   | Settings                         | Verdict |
|----------|------------|-------|---------|----------------------------------|---------|
| 09:36:08 | 3          | 9     | network | conf ≥ 0.75 × 3 · re-arm ≥ 0.6   | FAIL    |
| 09:36:33 | 2          | 0     | network | conf ≥ 0.75 × 3 · re-arm ≥ 0.6   | FAIL    |
| 09:37:38 | 3          | 3     | network | conf ≥ 0.75 × 3 · re-arm ≥ 0.6   | PASS    |

Finding: training works (≈ 148 samples per shape in 2.5 s, loss 0.004 → it fits the recorded samples almost perfectly; the 5 s matrix test will show whether it also works on new frames). The counting is unreliable: once 3× too many, once nothing, once right.
Most likely cause of the 9: v1 re-armed after a *single* result where another shape was on top. While a pinch is held, the network sometimes flickers to fist or open for one result (thumb + index pinched with the other fingers curled looks a lot like a fist) → the same pinch counts again.
The 0 can't be explained from the log line (no data on what the network saw), and the rounds had no clear start (the counter wasn't reset between rounds).

### v2 (16 Nov)
- re-arming needs another shape ≥ 0.6 for **3 results in a row** (≈ 0.2 s), not 1
- at least **0.5 s** between two spices
- "Start pinch round" with 3-2-1: resets the counter, mom shows a new number
- timeline of the last 10 s: pinch confidence, threshold, a green dot per spice, a blue tick per re-arm, grey where the hand was lost
- "why" line per round: hand lost %, which shape was on top (%), max pinch confidence, re-arms, quick re-pinches (< 0.6 s after re-arming = probably a flicker), spices blocked by the 0.5 s gap
- same logic in the app: `js/gestures/pinch.js`
Simulated: 3 pinches of 1 s with a one-result flicker to "fist" every 5th result → v2 gives 3 spices.

### v2 with the camera — distance rule (16 Nov)
Note: after reloading E5 the network wasn't trained again, so these rounds all used the **distance rule** (thumb tip ↔ index tip < 0.32 palms). They're the baseline to compare the network with.

| Time     | Mom showed | Added | Hand lost | Top shape (open / fist / pinch) | Max pinch | Re-arms | Quick re-pinch | Verdict |
|----------|------------|-------|-----------|---------------------------------|-----------|---------|----------------|---------|
| 09:41:06 | 3          | 3     | 4%        | 81% / 8% / 11%                  | 1.00      | 2       | 0              | PASS    |
| 09:41:30 | 2          | 2     | 34%       | 59% / 20% / 20%                 | 1.00      | 2       | 0              | PASS    |
| 09:41:54 | 3          | 3     | 14%       | 39% / 22% / 38%                 | 1.00      | 2       | 2              | PASS    |
| 09:42:37 | 3          | 0     | 77%       | 100% / 0% / 0%                  | 0.00      | 0       | 0              | FAIL    |
| 09:42:52 | 1          | 0     | 26%       | 0% / 1% / 99%                   | 0.97      | 0       | 0              | FAIL    |
| 09:43:07 | 2          | 2     | 20%       | 4% / 0% / 96%                   | 1.00      | 2       | 1              | PASS    |

Finding: 4/6. No double counts any more, even with quick re-pinches (the v2 re-arm rule holds).
- 09:42:37: the hand was lost in 77% of the frames (out of view / too close) → nothing to count. A hint is needed when the hand is lost for long (E9 framing check).
- 09:42:52: pinch was on top 99% of the time, but the confidence never stayed ≥ 0.75 for 3 results in a row → the fingers were close, but not close enough for the distance rule. The network may handle this better (it learns *your* pinch); otherwise lower the threshold.
- The pinching hand is lost often (14–34%), probably because the fingers hide each other.

E5 now also logs "pinch ≥ threshold %" and says when the distance rule is used because the network isn't trained.

### v2 with the camera — network (16 Nov)

| Time     | Mom showed | Added | Duration | Hand lost | Top shape (open / fist / pinch) | Max pinch | Pinch ≥ 0.75 | Re-arms | Quick re-pinch | Verdict |
|----------|------------|-------|----------|-----------|---------------------------------|-----------|--------------|---------|----------------|---------|
| 09:48:01 | 3          | 3     | 218 s    | 17%       | 85% / 10% / 5%                  | 1.00      | 3%           | 3       | 0              | PASS    |

Finding: first network round with the v2 counter: 3 of 3, no flicker re-pinches. The round ran 218 s (no "Start pinch round"), which is why pinch was only on top 5% of the time — the 3 pinches are short moments in a long round.

5 s test per shape (network, trained on 445 samples in 1.3 s, final loss 0.005):

| shown ↓ / predicted → | open | fist | pinch | correct |
|-----------------------|------|------|-------|---------|
| open                  | 71   | 0    | 0     | 100%    |
| fist                  | 0    | 72   | 0     | 100%    |
| pinch                 | 0    | 1    | 71    | 99%     |

→ PASS (≥ 90% per class). The network recognises my own hand shapes almost perfectly on new frames.

One more round, but the network had been lost again in between:

| Time     | Mom showed | Added | Model         | Hand lost | Pinch on top | Pinch ≥ 0.75 | Re-arms | Quick re-pinch | Verdict |
|----------|------------|-------|---------------|-----------|--------------|--------------|---------|----------------|---------|
| 09:49:45 | 3          | 3     | distance rule | 27%       | 90%          | 87%          | 2       | 2              | PASS    |

Finding: the trained network disappears whenever the page reloads — also when the local server reloads it automatically because a file in the project was saved (live reload). Fix: E5 now keeps the last trained samples in the browser (localStorage) → "Restore last samples + train" retrains in a few seconds.
Bug found while testing that: training before HandPose has loaded fails ("backend 'webgpu' has not yet been initialized"). Fixed by `await ml5.tf.ready()` before `ml5.neuralNetwork()`, in E5 and in the app (`js/ml/classifier.js`).

Conclusion E5 (so far):
- Self-trained network: PASS (100 / 100 / 99%).
- One pinch = one spice with the v2 counter: network 1/1, distance rule 5/7 (the 2 fails: hand out of view, pinch not tight enough). No double counts since v2.

## experiment 6: can FaceMesh tell "it's right" from "too spicy"?
Approach: 40 neutral frames → baseline (median). Smile = mouth width ÷ face width + 0.8 × corner lift → warmth = (ratio ÷ baseline − 1.04) ÷ 0.14, "right" when > 0.72 for 1.2 s. Too spicy = mouth opened (+0.06 of face height) AND eyes scrunched (−22% eye height ÷ width), held 0.6 s → mom laughs, yogurt arcs in (MotionPath). Spicy is damped while smiling, because a laugh also opens the mouth and scrunches the eyes.
Pass: 5/5 smiles → right · 5/5 spicy faces → spicy · neutral + talking 20 s → nothing · big laugh → not spicy.

### v1 results with the camera (16 Nov)

| Time     | Test                   | Duration | Right | Spicy | fps  | Verdict    |
|----------|------------------------|----------|-------|-------|------|------------|
| 09:55:38 | smile (5×)             | 74 s     | 7     | 0     | 60.0 | PASS       |
| 09:55:57 | too spicy face (5×)    | 19 s     | 0     | 0     | 60.0 | FAIL       |
| 09:56:26 | neutral + talking 20 s | 29 s     | 0     | 0     | 60.0 | PASS       |
| 09:56:34 | big laugh              | 8 s      | 1     | 0     | 60.0 | PASS       |
| 09:56:59 | with glasses / other light | 25 s | 2     | 0     | 59.5 | no verdict |

Settings: warmth > 0.72 for 1.2 s · mouth open +0.06 (of face height) · eyes scrunched −22% · held 0.6 s · not "spicy" while smiling.

Finding: smiling works, talking and a neutral face never trigger anything, and a laugh never counts as spicy. But the too-spicy face **never** triggered (0/5). Two possible causes, which the log can't tell apart:
1. the thresholds are too strict (mouth open *and* eyes scrunched enough, both at once, for 0.6 s)
2. the laugh protection blocks it: a spicy grimace also stretches the mouth wide, which looks like a smile → spicy × 0.3
Also: 7 "right" for 5 smiles — a long smile counted again every 3 s (cooldown only).

### v2 (16 Nov)
- after "right" or "too spicy", the face has to go back to neutral (warmth and spicy < 0.3) before the next one counts → fixes the 7 for 5 (same in the app: `js/gestures/taste.js`)
- "why" line per round: how far the mouth opened and the eyes scrunched compared with what's needed (max), in how many frames each was enough, both at once, and how often "both" was blocked as a smile; max warmth

v2 with the camera (16 Nov):

| Time     | Test                | Duration | Right | Spicy | Mouth open enough | Eyes scrunched enough | Both | Blocked as smile | Max warmth | Verdict |
|----------|---------------------|----------|-------|-------|-------------------|-----------------------|------|------------------|------------|---------|
| 09:59:08 | smile (5×)          | 43 s     | 3     | 0     | 0%                | 47%                   | 0%   | 0%               | 1.00       | FAIL    |
| 09:59:27 | too spicy face (5×) | 19 s     | 1     | 0     | 1%                | 79%                   | 1%   | 1%               | 1.00       | FAIL    |

Max change: smile → mouth +0.014 (23% of needed), eyes −52% · spicy face → mouth +0.076 (just enough, but only 1% of frames), eyes −63%.

Finding: my "too spicy" face is **not** "mouth open + eyes scrunched":
- the mouth hardly opens (only 1% of frames)
- the eyes scrunch in **both** faces (47% of the smile frames, 79% of the spicy frames) → eyes alone can't tell them apart
- the spicy face reaches warmth 1.00 → it scores as a smile, because the smile score is mostly mouth *width*, and a grimace stretches the mouth wide too (1 "right" in the spicy round)
So the rule from the concept doesn't match a real reaction. What probably differs: the mouth corners (up in a smile, flat/down in a grimace) and the eyebrows (pulled down in a grimace).
Smile: 3 for 5 → the v2 "back to neutral" rule (warmth < 0.3) was too strict: between smiles the face doesn't fully relax.

### v2.1 (16 Nov)
- re-arm when warmth < 0.5 (was 0.3)
- measured separately, compared with the neutral face: mouth width, mouth-corner lift, eyebrow height (brow → upper eyelid), mouth opening, eye scrunch
- "profile" line per round: median and strongest change of each, over the frames where the face moved → compare the smile profile with the spicy profile and pick the feature(s) that differ most
- "Save recording": every frame of the last logged round as JSON

v2.1 with the camera (16 Nov) — face profiles (change compared with the neutral face, median / strongest, over the frames where the face moved):

| Time     | Test                | Right | Spicy | Mouth width   | Corners     | Brows         | Mouth open  | Eyes scrunched |
|----------|---------------------|-------|-------|---------------|-------------|---------------|-------------|----------------|
| 10:06:04 | smile (5×)          | 2     | 0     | +38.6 / +48.3% | +4.0 / +4.8 | +2.8 / +0.2%  | +4.1 / +6.4 | +43.8 / +48.2% |
| 10:06:19 | too spicy face (5×) | 1     | 0     | +7.0 / +14.4% | +0.2 / +0.9 | −5.6 / −9.3%  | 0.0 / +2.4  | +34.7 / +48.7% |
| 10:06:51 | too spicy face (5×) | 0     | 0     | +4.0 / +8.0%  | −0.2 / +0.6 | −7.8 / −9.5%  | −0.1 / +1.0 | +37.7 / +46.7% |

(corners and mouth open in % of the face height)

Finding — what tells my two faces apart:
- **smile** = wide mouth (+39%) with the corners up (+4); brows slightly up
- **too spicy** = brows pulled **down** (−6 to −8%) and eyes scrunched, mouth stays flat and closed
- eyes scrunch in **both** (+35–44%) → useless on their own
- mouth opening: hardly in the spicy face → the concept's rule was the wrong one

### v3 (16 Nov): new rule, thresholds halfway between the two faces
- smile ("right") = mouth width > **+25%** AND corners > **+2**, held 1.2 s (spicy strongest: width +14%, corners +0.9 · smile median: +39%, +4.0)
- too spicy = eyes scrunched > **22%** AND brows down > **4%**, held 0.6 s, not while smiling (smile brows: +0.2% at the lowest · spicy median: −5.6 / −7.8%)
- all thresholds are sliders in E6; same rule in the app (`js/gestures/taste.js`)
- checked by feeding the measured medians through E6: 5 smiles → 5 right · 5 spicy faces → 5 spicy · talking → nothing
- keyboard mode: held keys now reach full strength in ~0.5 s

Note for the documentation: the thresholds come from **my** face. Other people may pull a different "too spicy" face → part of the prototype test (5 people).

v3 with the camera (16 Nov):

| Time     | Test                   | Right | Spicy | Smile frames | Spicy frames | Blocked as smile | Width (med / max) | Corners (med / max) | Brows (med / strongest) | Verdict |
|----------|------------------------|-------|-------|--------------|--------------|------------------|-------------------|---------------------|-------------------------|---------|
| 10:14:50 | smile (5×)             | 1     | 0     | 30%          | 0%           | 0%               | +24.3 / +27.1%    | +2.7 / +3.3         | −1.2 / −2.4%            | FAIL    |
| 10:15:14 | too spicy face (5×)    | 0     | 5     | 0%           | 41%          | 1%               | −1.6 / +4.9%      | +0.5 / +1.0         | −7.2 / −10.9%           | PASS    |
| 10:15:43 | neutral + talking 20 s | 0     | 0     | 0%           | 0%           | 0%               | −5.7 / −0.9%      | +0.3 / +0.6         | −4.0 / −6.5%            | PASS    |
| 10:15:50 | big laugh              | 1     | 0     | 53%          | 50%          | 50%              | +40.4 / +44.3%    | +3.7 / +4.2         | −7.3 / −8.5%            | PASS    |

Finding: "too spicy" works now (5/5), talking triggers nothing, and the laugh is correctly kept from counting as spicy (the "not while smiling" rule blocked it in 50% of the frames — exactly the case it was made for).
Smile: only 1/5. This time my smiles were narrower (width +24% median, +27% max) → right on the +25% threshold, so the smile flickered in and out and never stayed "fully reached" for 1.2 s in one go.
→ Faces differ from round to round, even for the same person: thresholds shouldn't sit at someone's median.

### v3.1 (16 Nov)
- smile thresholds lowered: width > **+15%** (spicy max this round +4.9%, talking max −0.9%) · corners > **+1.5** (spicy max +1.0, talking max +0.6)
- hysteresis: a smile or spicy face starts counting at full strength, and keeps counting while it stays above 70% (instead of having to stay at 100% the whole time)
- same in the app (`js/gestures/taste.js`)
- checked by feeding this round's face profiles + random noise through E6, 3 runs: smile 5/5 right · spicy 5/5 · talking nothing

v3.1 with the camera (16 Nov, afternoon — page still open and calibrated since the morning):

| Time     | Test                | Right | Spicy | Smile frames | Spicy frames | Blocked as smile | Width (med / max) | Corners (med / max) | Brows (med / strongest) | Verdict |
|----------|---------------------|-------|-------|--------------|--------------|------------------|-------------------|---------------------|-------------------------|---------|
| 15:46:13 | smile (5×)          | 4     | 0     | 60%          | 0%           | 0%               | +27.1 / +29.1%    | +2.8 / +3.1         | +7.0 / +5.2%            | FAIL (4/5) |
| 15:46:38 | too spicy face (5×) | 0     | 1     | 6%           | 20%          | 13%              | +10.5 / +14.8%    | +0.4 / +1.4         | −1.6 / −8.5%            | FAIL    |
| 15:46:44 | big laugh           | 1     | 0     | 57%          | 3%           | 3%               | +43.8 / +51.0%    | +3.6 / +4.2         | −3.5 / −8.6%            | PASS    |

Finding: the smile improved (4/5), but "too spicy" dropped from 5/5 to 1/5. The calibration was about 4 hours old (smile round: 14107 s since the page was opened), from a different time of day, light and posture:
- brows read ~4–5% higher than in the morning in every face (smile +7.0% vs +2.8%, spicy −1.6% vs −7.2%) → the brow rule hardly triggered
- the spicy face also came very close to the smile thresholds (width max +14.8% vs 15, corners max +1.4 vs 1.5) → 13% of the spicy frames were blocked as a smile
→ a neutral calibration only holds for a short time. In the app that's fine: the tasting step calibrates right before you taste. In E6 the calibration has to be redone before each test.
Not tuning the thresholds on this data (it's off by the stale baseline).

### v3.2 (16 Nov)
- the log line says how old the calibration is ("STALE" after 5 min), and the "Calibrate again" button turns red with its age after 5 min

v3.2 with the camera, fresh calibration (16 Nov):

| Time     | Test                | Calibrated | Right | Spicy | Smile frames | Spicy frames | Blocked as smile | Width (med / max) | Corners (med / max) | Brows (med / strongest) | Verdict |
|----------|---------------------|------------|-------|-------|--------------|--------------|------------------|-------------------|---------------------|-------------------------|---------|
| 15:48:36 | smile (5×)          | 25 s ago   | 5     | 0     | 59%          | 0%           | 0%               | +41.9 / +44.5%    | +4.2 / +4.4         | +2.3 / +0.5%            | PASS    |
| 15:49:04 | too spicy face (5×) | 25 s ago   | 0     | 5     | 0%           | 29%          | 0%               | −2.0 / +0.6%      | +0.1 / +0.4         | −4.9 / −6.8%            | PASS    |
| 15:49:07 | (too spicy, 3 s)    | 28 s ago   | 0     | 0     | 0%           | 0%           | 0%               | −2.3 / −1.6%      | +0.3 / +0.3         | −5.1 / −6.8%            | not a real round (logged twice) |
| 15:49:15 | big laugh           | 35 s ago   | 1     | 0     | 54%          | 0%           | 0%               | +35.7 / +39.9%    | +3.6 / +4.2         | −1.4 / −5.2%            | PASS    |

Finding: with a fresh calibration everything passes. Smile and spicy are now far apart: width +41.9% vs −2.0%, corners +4.2 vs +0.1, brows +2.3% vs −4.9%. No spicy frame was blocked as a smile, and the laugh counts as "right", never as spicy.

**Conclusion E6:** FaceMesh can tell "it's right" from "too spicy" — but not with the rule from the concept. What worked:
- smile = mouth wider (> +15%) AND corners up (> +1.5% of face height), held 1.2 s
- too spicy = eyes scrunched (> 22%) AND brows pulled down (> 4%), held 0.6 s, not while smiling
- everything relative to a **fresh** neutral calibration (a 4-hour-old one broke the brow rule)
- hysteresis (start at 100%, keep going above 70%) and back-to-neutral before the next event
Open for the prototype test (5 people): do other people pull the same "too spicy" face? (eyes + brows, mouth closed)
Settings kept: see v3.1/v3.2 above; the same values are in `js/gestures/taste.js`.






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
