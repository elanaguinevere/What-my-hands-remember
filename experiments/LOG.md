# Experiment log — What my hands remember

Each experiment is a standalone page in this folder. Open it over https (or localhost), test, press "Copy log" and paste the result under the right heading. This log becomes the research report.

For every experiment, write down:
- **Question**: what you wanted to find out
- **Approach**: what you built and how you tested it
- **Result**: numbers, screenshots, what failed
- **Decision**: what you'll keep, change or drop for the final app

---

## E1 · HandPose basics
**Question:** can ml5 HandPose track one hand fast and steadily enough to drive the cooking steps?
**Pass:** stable tracking at about 20 fps or more.

Test plan:
1. Automatic backend, full model, normal light: 10-second measurement.
2. Same, but lite model.
3. Force webgl, then cpu: what changes?
4. Dim light at 0.35 and 0.2: is the hand still found?
5. flipped off vs on: does left/right feel natural?
6. Another laptop, if you can borrow one.

| # | backend | model | light | fps | worst gap | hand found | jitter | pass? |
|---|---------|-------|-------|-----|-----------|------------|--------|-------|
| 1 |         |       |       |     |           |            |        |       |

Result:

Decision:

---

## E2 · Chop the onion
**Question:** can a fast down-and-up movement of the wrist become one slice per chop, and can it tell when you chop too fast?
**Pass:** 8 chops give 8 slices, and resting or slowly moving hands give no slices.

Test plan:
1. Chop 8 times at a normal speed (3×).
2. Hold your hand still for 10 seconds: no slices should fall.
3. Move your hand slowly up and down: no slices should fall.
4. Chop as fast as you can: "too fast" should appear and chops should be ignored.
5. Repeat close to and far from the camera.
6. Let 2 other people try without explanation.

| round | slices | false | missed | ignored (too fast) | thresholds (down / up / drop / fast) |
|-------|--------|-------|--------|--------------------|--------------------------------------|
| 1     |   / 8  |       |        |                    |                                      |

Result:

Decision (final thresholds):
