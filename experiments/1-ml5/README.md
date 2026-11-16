# 1 · ml5.js

**Deliverable:** test at least 2 prebuilt models, or create and test 1 self-trained model. → Both done.

| Folder | Model | Demo | Result |
|---|---|---|---|
| `e0-camera` | – | turn the camera on, block it once | every camera error gets its own sentence |
| `e1-handpose` | HandPose | switch WebGPU / WebGL and full / lite, watch the fps | WebGPU 52–57 fps, WebGL 22, CPU 0.5 → mouse mode |
| `e2-chop` | HandPose | chop: one chop = one slice, too fast = mom slows you down | 8/8 slices; fast chopping fixed, retest |
| `e4-circles` | HandPose | grind with a fist, stir with an open hand | 5 slow circles → 5.15 / 5.60, still / chop / wave → 0 |
| `e5-pinch-classifier` | self-trained network | "Restore last samples + train", 5 s test, pinch round | 100 / 100 / 99% on new frames, no double counts since v2 |
| `e6-taste-facemesh` | FaceMesh | calibrate, smile, too-spicy face, laugh | smile 5/5, spicy 5/5, laugh never spicy |

Details and every round: `../LOG.md`.
