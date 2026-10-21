# Experiment log — What my hands remember

experiment 0: does the camera work?
experiment 1: what are the right conditions for handpose to work?
| Backend | Model | Light    | FPS  | ms per result | Worst gap | Hand found | Verdict     |
|---------|-------|----------|------|---------------|-----------|------------|-------------|
| webgpu  | full  | normal   | 51.6 | 19            | 128 ms    | 100%       | PASS        |
| webgpu  | lite  | normal   | 57.4 | 17            | 113 ms    | 100%       | PASS        |
| webgpu  | lite  | dim 0.35 | 39.0 | 26            | 139 ms    | 100%       | PASS        |
| webgpu  | lite  | dim 0.2  | 31.5 | 32            | 283 ms    | 100%       | PASS        |
| webgl   | full  | normal   | 22.0 | 46            | 74 ms     | 100%       | PASS (just) |
| cpu     | full  | normal   | 0.5  | 2061          | 4530 ms   | 70%        | FAIL        |
experiment 2: can I do a chopping motion that gets detected?
experiment 3: how can I make the scroll transitions fun?