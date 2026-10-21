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

experiment 3: how can I make the scroll transitions fun?