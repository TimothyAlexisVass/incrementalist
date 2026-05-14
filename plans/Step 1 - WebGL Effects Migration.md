# Step 1: WebGL Effects Migration

## Status: Splitting into sub-steps

The migration of the effects layer to the main `#incrementalist` WebGL canvas is split into the following sub-steps to ensure stability and visual parity:

1.  [Step 1a: Progress Bar Particle Burst](file:///Users/timothy/incrementalist/plans/Step%201a%20-%20Progress%20Bar%20Particle%20Burst.md)
2.  [Step 1b: Progress Bar Laser Collection Effect](file:///Users/timothy/incrementalist/plans/Step%201b%20-%20Progress%20Bar%20Laser%20Collection.md)
3.  [Step 1c: Progress Bar Liquid Bubbles and Glow](file:///Users/timothy/incrementalist/plans/Step%201c%20-%20Progress%20Bar%20Liquid%20Bubbles%20and%20Glow.md)
4.  [Step 1d: Exp Bar Level Up Burst](file:///Users/timothy/incrementalist/plans/Step%201d%20-%20Exp%20Bar%20Level%20Up%20Burst.md)
5.  [Step 1e: Click Burst Particles](file:///Users/timothy/incrementalist/plans/Step%201e%20-%20Click%20Burst%20Particles.md)

## CRITICAL!!!!
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!!

## Final goal
- Entire game renders on one canvas: `#incrementalist`.
- Stop initializing `#effects-canvas` (See Step 2).
- Remove `#effects-canvas` from DOM/CSS (See Step 3).
