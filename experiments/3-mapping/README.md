# 3 · Meaningful mapping

**Deliverable:** connect ML signals → animation parameters.

Demo: `e8-mapping` — stir over the pot, pinch, take your hand away; change a curve or smoothing value live.

| Kind | Signal | Animation | Also in |
|---|---|---|---|
| direct | palm position | spoon follows your hand | – |
| continuous | stirring speed | steam rises and calms down | `../1-ml5/e4-circles` |
| accumulate | turns / distance stirred | seeds crack, curry darkens, never goes back | `../1-ml5/e4-circles` |
| event | one pinch, one chop, one face | one spice, one slice, the yogurt spoon | `e2`, `e5`, `e6` in `../1-ml5/` |
| state | hand gone, too fast | lid goes on, mom slows you down | `e2`, `e4` |

Principle: the input is the real cooking motion, never a remote control. The same mapping code is in the app: `js/core/mapping.js`.
