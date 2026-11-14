// Hand helpers shared by every gesture. Everything is measured in "palms"
// (wrist → base of the middle finger), so it doesn't matter how far the hand is from the camera.

export const palmSize = kp => Math.hypot(kp[9].x - kp[0].x, kp[9].y - kp[0].y) || 1;

// Palm centre: average of the wrist and the four finger bases (steadier than a single point)
export function palmCentre(kp) {
  const ids = [0, 5, 9, 13, 17];
  return { x: ids.reduce((s, i) => s + kp[i].x, 0) / 5, y: ids.reduce((s, i) => s + kp[i].y, 0) / 5 };
}

// 42 inputs for the classifier: the 21 keypoints relative to the wrist, divided by palm size
export function handFeatures(kp) {
  const p = palmSize(kp), out = [];
  for (const k of kp) out.push((k.x - kp[0].x) / p, (k.y - kp[0].y) / p);
  return out;
}

// Average fingertip → wrist distance in palms: ~0.9 for a fist, ~1.9 for an open hand
export const openness = kp => [8, 12, 16, 20].reduce((s, i) => s + Math.hypot(kp[i].x - kp[0].x, kp[i].y - kp[0].y), 0) / 4 / palmSize(kp);

// Thumb tip ↔ index tip in palms
export const pinchDistance = kp => Math.hypot(kp[4].x - kp[8].x, kp[4].y - kp[8].y) / palmSize(kp);

// Shape without a trained model (fallback + until the classifier is ready)
export function heuristicShape(kp, { pinchBelow = 0.32, fistBelow = 1.25 } = {}) {
  const d = pinchDistance(kp);
  const pinch = Math.min(1, Math.max(0, 1 - (d - pinchBelow * 0.5) / pinchBelow));
  const open = openness(kp) > fistBelow ? 1 : 0;
  return { pinch, open: (1 - pinch) * open, fist: (1 - pinch) * (1 - open) };
}
