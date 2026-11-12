import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url);
const { chromium } = load(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.PERF_URL || 'http://localhost:3010');
  await page.getByRole('button', { name: /Floresta Amazônica/ }).click();
  await page.getByRole('button', { name: /INICIAR COM/ }).click();
  await page.waitForTimeout(700);
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    let fiber = canvas[Object.keys(canvas).find(k => k.startsWith('__reactFiber'))];
    while (fiber.return) fiber = fiber.return;
    function find(node) {
      if (node.memoizedProps?.getEngine) return node.memoizedProps.getEngine();
      for (let c = node.child; c; c = c.sibling) { const e = find(c); if (e) return e; }
    }
    const e = find(fiber); window.renderTestEngine = e;
    e.pause(); e.sound.setMuted(true);
    const a = document.createElement('canvas'), b = document.createElement('canvas');
    const camera = new e.camera.constructor(256, 256);
    const differences = [];
    const compare = (label, scale, paintA, paintB) => {
      a.width = a.height = b.width = b.height = 256 * scale;
      const ac = a.getContext('2d'), bc = b.getContext('2d');
      for (const ctx of [ac, bc]) { ctx.scale(scale, scale); ctx.fillStyle = '#14351d'; ctx.fillRect(0, 0, 256, 256); }
      paintA(ac); paintB(bc);
      const ap = ac.getImageData(0, 0, a.width, a.height).data, bp = bc.getImageData(0, 0, b.width, b.height).data;
      let difference = 0;
      for (let i = 0; i < ap.length; i++) difference += Math.abs(ap[i] - bp[i]);
      differences.push({ label, meanChannelDifference: difference / ap.length });
    };
    // Compare cached world-space paths with the original immediate contour at shorelines.
    const world = e.worldProps;
    for (const [key, path] of world.riverPaths) {
      if (!key.startsWith('water:')) continue;
      const halfWidth = Number(key.slice(6));
      for (const x of [-5000, 0, 5000]) for (const scale of [1, 2]) {
        const y = world.riverCenterY(x) + world.getRiverHalfWidth(x, halfWidth);
        const prepare = ctx => { ctx.translate(128 - x, 128 - y); ctx.fillStyle = '#1b6b82'; };
        compare(key + ':' + x + ':' + scale, scale, ctx => { prepare(ctx); ctx.fill(path); }, ctx => {
          prepare(ctx); ctx.beginPath(); const xs = [];
          for (let px = -8200; px <= 8200; px += 220) xs.push(px);
          xs.forEach((px, i) => { const py = world.riverCenterY(px) - world.getRiverHalfWidth(px, halfWidth); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
          for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], world.riverCenterY(xs[i]) + world.getRiverHalfWidth(xs[i], halfWidth));
          ctx.closePath(); ctx.fill();
        });
      }
    }
    // Labels retain the same baseline, colours, outline and critical font at each DPR.
    camera.x = camera.y = 0;
    for (const scale of [1, 2]) for (const crit of [false, true]) for (const heal of [false, true]) {
      e.vfx.clear(); e.vfx.addDamageNumber(0, 0, 123, crit, heal);
      const dn = e.vfx.damageNumbers[0];
      compare(`text:${scale}:${crit}:${heal}`, scale, ctx => e.vfx.render(ctx, camera), ctx => {
        const p = camera.worldToScreen(dn.x, dn.y);
        ctx.font = crit ? '900 17px sans-serif' : 'bold 13px sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = dn.color;
        ctx.strokeText(dn.text, p.x, p.y); ctx.fillText(dn.text, p.x, p.y);
      });
    }
    // The minimap must refresh on teleport, not wait for its normal 12 Hz tick.
    e.renderMinimap(); const initial = e.minimapUpdatedAt;
    e.renderMinimap(); const reused = e.minimapUpdatedAt === initial;
    e.player.x += 1000; e.renderMinimap(); const teleported = e.minimapPlayerX === e.player.x;
    e.player.x -= 1000;
    window.renderTestFrames = 0;
    const render = e.render;
    e.render = function() { window.renderTestFrames++; return render.call(this); };
    return { differences, reused, teleported, 
      textBytes: e.vfx.textSpriteBytes, simulationTime: e.waveDirector.survivalTime };
  });
  const worst = result.differences.reduce((a, b) => a.meanChannelDifference > b.meanChannelDifference ? a : b);
  assert.ok(worst.meanChannelDifference < 0.3, JSON.stringify(worst));
  assert.ok(result.reused); assert.ok(result.teleported); assert.ok(result.textBytes <= 2 * 1024 * 1024);
  await page.waitForTimeout(350);
  const pause = await page.evaluate(() => ({ renders: window.renderTestFrames, time: window.renderTestEngine.waveDirector.survivalTime }));
  assert.ok(pause.renders > 0 && pause.renders <= 7, JSON.stringify(pause));
  assert.equal(pause.time, result.simulationTime);
  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForTimeout(150);
  await page.evaluate(() => { const e = window.renderTestEngine; e.player.godMode = true; e.resume(); });
  await page.waitForTimeout(150);
  const resumed = await page.evaluate(() => ({ time: window.renderTestEngine.waveDirector.survivalTime, width: window.renderTestEngine.camera.viewportWidth }));
  assert.ok(resumed.time > pause.time); assert.equal(resumed.width, 900);
  assert.deepEqual(errors, []);
  if (process.env.PERF_SCREENSHOT) await page.screenshot({ path: process.env.PERF_SCREENSHOT });
  console.log(`PASS: ${result.differences.length} raster/vector comparisons; worst mean RGBA difference=${worst.meanChannelDifference.toFixed(4)}`);
  console.log('PASS: bounded text cache, minimap reuse/teleport, paused redraw budget, frozen clock, resize and resume');
} finally { await browser.close(); }
