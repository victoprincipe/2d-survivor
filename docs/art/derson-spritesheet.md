# Derson motorcycle animation atlas

Generated with the built-in image generation tool. Original Derson PNG is the identity and motorcycle reference; Kayru atlas is the pixel-art style reference.

- Asset: `public/derson-animations-v2.png`, RGBA, 2048 × 1280, 8 × 5 cells of 256px.
- Rows: drive, jump, throw attack, idle, dash. All frames face right and retain the motorcycle.
- Technical packing: resize generated output to the exact atlas grid with nearest-neighbor sampling.
- Combat: 400ms throwing animation on each Combo do Derson volley, including the evolved banquet. Derson also animates when throwing his existing Amazon starting tray; weapons, damage, cooldowns and map starting weapons are unchanged.
- UI: shared atlas portrait with Lula; breathing and an attack demonstration every 3 seconds, static HUD; original image remains loading/error fallback. Reduced motion stops menu animation.

## Generation prompt

Use case: stylized-concept. Production transparent pixel-art sprite atlas for Derson, a motorcycle delivery rider in a 2D survivor game. Image1 is mandatory identity/costume/vehicle reference: slim brown-skinned man with black mustache, straw cowboy hat, RED delivery T-shirt, blue jeans, brown boots, oversized RED insulated delivery backpack, riding the same compact RED motorcycle with headlight and two wheels. Image2 is pixel-art finish reference only (Kayru). KEEP THE MOTORCYCLE IN EVERY CELL. Never turn him into a pedestrian. Detailed crisp pixel art, readable at 60px, three-quarter view facing RIGHT consistently. Same rider, hat, backpack and bike proportions everywhere.
EXACT grid: 8 columns x 5 rows, 40 square cells, total canvas2048x1280, each cell256x256. Transparent alpha background, NO grid, NO text, NO ground shadows, NO motion blur, no detached flecks. Each full rider+bike must fit entirely WITHIN its cell with AT LEAST 20px padding on every side. Wheels baseline y236, hat top y30, bike center x128. No cropping at canvas edges. Uniform size and alignment.
Row1 top: 8 sequential driving loop frames. Wheels visibly change spoke angles, slight engine/rider vibration, jacket and backpack straps subtly move, hands steering. Same bike center in all frames.
Row2: 8 jump poses, compress suspension, frontwheel lift, airborne bike slightly noseup, suspension extended, descend, bothwheels landing, settle. Keep vehicle within cell; engine adds vertical arc, do not elevate whole figure in the cell.
Row3: 8 attack frames. Rider keeps one hand steering. Frame1 begins the forward throwing/release gesture, frame2 arm extended toward RIGHT, frames3/4 followthrough, frames5/6 retract arm, frame7 hand returns handlebar, frame8 riding stance. No projectile or food flying baked in: game supplies cheese bread/coffee/cake separately. Maintain motorcycle and rider base in same place.
Row4: 8 idle poses, quiet breathing, stationary motorcycle/wheels, both hands on bars, feet on pegs.
Row5: 8 dash poses, rider leans toward handlebars, backpack streams slightly back, fast sequential rotating wheels and suspension, no smoke or effects.
Prioritize consistent hat, mustache, red shirt/backpack/bike, blue jeans, actual transparent background, all40 full figures correctly aligned. Any shirt/bag lettering may be omitted rather than invented.

