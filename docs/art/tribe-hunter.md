# Caçador da Tribo

Built-in image generation created both transparent PNG assets from the supplied hunter reference. The campfire, spit and fish are Canvas drawings driven by simulation time.

- NPC: `public/sprites/tribe-hunter/seated.png`
- Helmet icon: `public/sprites/tribe-hunter/headdress.png`
- Mission: accept, collect 30 physical quest-fish drops from common aquatic river enemies, then deliver at the camp. Progress and unique helmet are saved per character. Lakes/elites/bosses/clones do not count.
- Reward: 5% damage reduction, 5% attack speed, +15 max HP, 15% projectile speed. Equip manually in the helmet slot.
- Regression check: `node scripts/check-hunter-quest.mjs` (uses isolated in-memory storage).



## Standing animation

Asset: `public/sprites/tribe-hunter/stand-up.png`, 4 × 2 frames normalized to 1024 × 512. Seated rendering is 42px tall; the standing pose approaches the same 60px cell scale as Kayru. Delivery triggers the 1.1-second animation once; completed saves initialize on frame 7. The HUD shows a numeric fish counter and progress bar.

Built-in image generation prompt:

Use case: stylized-concept. Transparent game sprite atlas, 8 consecutive frames of this EXACT Amazon hunter standing up from sitting cross-legged on a log. Reference1 current seated NPC identity, reference2 same hunter standing costume. Preserve detailed pixel-art look, brown skin, black long hair, face paint, blue/red/yellow headdress, beads, woven skirt, bracelets. Gentle friendly NPC, three-quarter facing RIGHT throughout.
EXACT 4 columns x 2 rows, eight equal square cells, canvas1024x512, cell256x256. Read frames left-to-right top-to-bottom. Same figure proportions and limb length in ALL cells; camera fixed, NOT zooming. Ground baseline y238. Standing figure head/headdress top y24; seated head lower aroundy90. Feet and log always anchored to same ground. Log stays behind him, bow rests to the right of log, neither moves. FULL headdress, feet and bow within each cell with padding.
Frame0 sitting cross-legged relaxed; frame1 lean forward and hands on knees; frame2 uncross legs and place feet; frame3 deep crouch hands pushing knees; frame4 half rising knees bent; frame5 almost upright; frame6 fully upright; frame7 relaxed STANDING still with arms down, forever idle final pose. This is actual articulated movement, NOT scaling seated sprite taller. Final frame fully standing on feet. No campfire, no fish, no environment, no text, no grid lines, no ground shadow, actual transparent background.

## NPC prompt

Use case: stylized-concept. Transparent game NPC sprite based on reference hunter: preserve long black hair, brown skin, red/black facial geometric paint, blue red yellow feather headdress, bead necklaces and patterned bracelets, woven skirt. Single friendly Amazon hunter sitting cross-legged on a small flat log, resting hands on knees, calm thoughtful face, three-quarter facing right. His wooden bow and quiver lean beside the log on his left, fully visible. Detailed clean pixel-art sprite similar to a classic 2D survival game. Full seated figure including entire headdress and bow, generous transparent padding on all sides. No campfire, no food, no environment, no ground shadow, no text, no grid, no other characters. Actual transparent alpha. Square canvas.

## Helmet prompt

Use case: stylized-concept. One isolated EQUIPMENT ICON of a feather headdress based on this reference. Preserve dark blue outer feathers, tall red central feathers, yellow inner feathers and woven tan/red geometric headband. No person, no head, no hair, no torso. Detailed crisp pixel-art RPG inventory item, front three-quarter view, entire item fits square composition with 12% transparent padding. Actual transparent alpha background, no text, no shadows, no additional objects.

