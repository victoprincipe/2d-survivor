# Lula pixel-art atlas

Generated with the built-in image generation tool from the original Lula SVG (rendered to PNG) and Kayru atlas. The original SVG assets remain the loading/error fallback.

- Runtime asset: `public/lula-animations-v2.png`, RGBA, 2048 × 1280.
- Grid: 8 columns × 5 rows, 256px cells. Rows: walk, jump, L attack, idle, dash.
- Layer seam: source y=184. Release: attack frame index 4, at 400ms of an 800ms cast.
- Technical packing: normalize the generated canvas to 2048 × 1280 with nearest-neighbor sampling; align the jump row upward by 26px within its cells (transparent padding at bottom). No character pixels are cut at the top.
- UI: idle breathing, 3-second demonstration cycle, static portrait in the HUD; reduced motion disables the selection animation.

## Generation prompt

Use case: stylized-concept. Production transparent PNG sprite atlas for Lula in a 2D survival game. Reference 1 is Lula identity/costume, reference 2 Kayru is pixel-art shading/style only. Redraw Lula as recognizable elderly Brazilian man with white hair and full white beard, navy blue suit, white shirt, red tie, green/yellow presidential sash with blue medal, black dress shoes. Detailed crisp pixel art like Kayru, three-quarter facing RIGHT in every pose. Same proportions, face, suit, sash each frame.
EXACT 8 columns x 5 rows = 40 full-body frames on a 2048x1280 transparent canvas. Every cell 256x256, no grid lines, no text, no shadows, no background. Consistent feet baseline y=240 within cell, head top y=28, hips anchored around x=128,y=184. Body center aligned. Legs animate below y=184; torso stays aligned at that seam to allow swapping upper/lower body. Full figure AND raised fingers inside each cell, at least 12px padding. No overlaps across cells.
ROW 1 (top): eight consecutive walking cycle poses alternating left/right steps with arm swing, complete loop.
ROW 2: eight sequential jumping poses, anticipation, extend, tuck knees, descend, land, recover. Engine supplies vertical elevation: do not move whole figure upwards in cells. Keep hips aligned.
ROW 3: eight attack poses. frame1 ready arms down, frame2 begin raising right arm, frame3 elbow rises, frame4 hand opens, frame5 first clear L gesture with index finger pointing UP and thumb to RIGHT, frame6 hold L with small red hand glow, frame7 lower hand, frame8 return ready. Hand must clearly show perpendicular extended index+thumb and folded remaining fingers. No giant magic wave baked into image.
ROW 4: eight quiet idle breathing poses, subtle chest expansion, fixed feet and hips.
ROW 5: eight dash poses, legs running fast, arms behind, dynamic attitude, torso stays upright in source because engine will tilt it. Preserve aligned hips.
Prioritize identical face, scale, pixel style and clothing throughout. All 40 figures face RIGHT. Actual transparent alpha.

## Padding revision

Edit this exact sprite atlas. Preserve all 40 poses, pixel style, face and costume. Fix ONLY sprite packing: EXACT grid 8 columns x 5 rows on 2048x1280 canvas with square 256x256 cells. All figures currently touch edges: SHRINK EACH individual figure by 15% around its own center, center it WITHIN its own cell. Full head and feet and dash arms must be visible inside EACH cell, with at least 20px transparent padding on ALL sides. No sprite can touch canvas edges. IMPORTANT consistent waist level y=184, feet around y=236; standing head around y=40. Jump figures keep hips at y184. The attack row (third row) MUST use identical hips/legs, torso position and sash size as idle row (fourth row), so they layer seamlessly at y184. Keep first row walk, second jump, third L gesture attack with L fully formed in fifth cell, fourth idle, fifth dash. No extra objects, no red or white detached marks above heads, no shadows, no text, no grid. Actual transparent background.

## Layer alignment revision

Fix the layered-animation alignment of this sprite sheet. Keep the exact 8x5 grid, pixel-art Lula identity, colors and first/third/fourth rows. MOST IMPORTANT: ROW TWO (jump) and ROW FIVE (dash) must have EXACTLY THE SAME UPRIGHT UPPER BODY, hips and pelvis placement as ROW FOUR idle IN EVERY COLUMN. Copy the same idle head, torso, sash, arms, pelvis into these two rows. NO leaning, no raised body, NO bent waist. The lower legs ONLY may change BELOW the identical hip seam. Every cell 256x256, hip seam y184, lower legs fit between y184 and y240. ALL FEET BELOW THE HIP SEAM even with tucked knees. Jump row bend knees and separate shoes but all hips remain fixed; dash row alternating running feet BELOW seam, no leaping figure. The game animates vertical trajectory and lean itself. Preserve row1 walking, row3 raising hand into L at fifth column, row4 idle. Transparent background. Entire character inside each cell with padding. No marks above heads. This is a strict technical layered animation atlas, invariant torso alignment across all rows.

