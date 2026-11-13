/* Production-only performance fixtures. No changes to game source or saved games.
 * PLAYWRIGHT_MODULE may point to an existing Playwright installation.
 * node scripts/profile-performance.mjs --output docs/performance-expanded.json
 * --only REGEXP filters cases; completed cases in the output are resumed.
 */
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url);
const { chromium } = load(process.env.PLAYWRIGHT_MODULE || 'playwright');
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const output = arg('--output') || 'docs/performance-expanded.json';
const baseURL = process.env.PERF_URL || 'http://localhost:3010';
const only = new RegExp(arg('--only') || '');
const cases = [];
const add = (id, opts = {}) => cases.push({ id, map: 'forest', cpu: 4, count: 250, seconds: 20,
  seed: 123456789, dpr: 1, width: 1280, height: 720, ...opts });
for (const map of ['forest', 'plain']) for (const cpu of [1, 4]) for (const count of [100, 250, 420])
  add(`${map}-${count}-cpu${cpu}`, { map, cpu, count, seconds: 15 });
add('forest-420-cpu6', { count: 420, cpu: 6 });
add('forest-420-cpu4-light-probe', { count: 420, lightProbe: true, seconds: 15 });
for (const seed of [42, 987654321]) add(`forest-420-seed${seed}`, { count: 420, seed });
for (const boss of ['anaconda', 'gorilla', 'kopenawa']) add(`guardian-${boss}`, { kind: 'guardian', boss, count: 0, seconds: 35 });
const combos = {
  fire: ['boss_curupira', 'boss_boitata', 'boss_caipora'],
  water: ['boss_boto', 'boss_iara', 'boss_vitoria_regia'],
  wind: ['boss_saci', 'boss_matinta'], earth: ['boss_mapinguari', 'boss_cobra_grande'],
};
for (const [combo, bosses] of Object.entries(combos)) add(`combo-${combo}`, { kind: 'combo', combo, bosses, seconds: 30 });
for (const map of ['forest', 'plain']) add(`arsenal-${map}`, { map, kind: 'arsenal', count: 420, seconds: 30 });
for (const map of ['forest', 'plain']) add(`arsenal-native-${map}`, { map, kind: 'arsenal', cpu: 1, count: 420, seconds: 30 });
for (const map of ['forest', 'plain']) add(`arsenal-diagnostic-${map}`, { map, kind: 'arsenal', count: 420, seconds: 20 });
add('guardian-transitions', { kind: 'transitions', count: 0, seconds: 32 });
add('earth-trample', { kind: 'combo', combo: 'earth', bosses: combos.earth, forceStun: true, count: 100, seconds: 20 });
add('forest-route-day-night', { kind: 'route', count: 250, seconds: 60 });
add('forest-drops-particles', { kind: 'effects', count: 420, seconds: 30 });
add('forest-dpr2', { count: 420, dpr: 2 });
add('forest-mobile-cpu6', { count: 250, cpu: 6, width: 390, height: 844, dpr: 2 });
add('forest-software-renderer', { count: 250, software: true, cpu: 1 });
add('forest-visible-window', { count: 420, headed: true });
add('forest-visible-foreground', { count: 420, headed: true, foreground: true });
add('plain-vampire', { map: 'plain', kind: 'combo', bosses: ['boss_vampire'], seconds: 30 });
const registry = fs.readFileSync('src/game/data/upgrades.ts', 'utf8');
const weaponIds = [...registry.slice(registry.indexOf('export const WEAPON_REGISTRY'), registry.indexOf('export const PASSIVE_REGISTRY')).matchAll(/id: '([^']+)'/g)].map(m => m[1]);
add('weapon-catalog', { kind: 'catalog', weaponIds, count: 250, seconds: Math.ceil(weaponIds.length / 4) * 8 });
add('cave-cpu4', { kind: 'cave', count: 0, seconds: 30 });
for (const map of ['forest', 'plain']) add(`soak-${map}`, { map, kind: 'soak', seconds: 120, count: 0 });

function browserFixture(s) {
  const canvas = document.querySelector('canvas');
  let fiber = canvas[Object.keys(canvas).find(k => k.startsWith('__reactFiber'))];
  while (fiber.return) fiber = fiber.return;
  function find(n) {
    if (n.memoizedProps?.getEngine) return n.memoizedProps.getEngine();
    for (let c = n.child; c; c = c.sibling) { const e = find(c); if (e) return e; }
  }
  const e = find(fiber);
  if (!e) throw Error('GameEngine not found');
  window.perfEngine = e;
  e.sound.setMuted(true); e.player.godMode = true;
  // Performance tests must not wait at upgrade/reward UI or change fixture HP.
  e.player.addXp = () => false;
  e.player.xpToNextLevel = 1e12;
  e.callbacks.onLevelUp = options => options[0] ? e.applyUpgrade(options[0]) : e.resume();
  e.callbacks.onTreasureChest = (_gold, upgrade) => upgrade ? e.applyUpgrade(upgrade) : e.resume();
  e.callbacks.onEquipmentReward = () => e.resume();
  e.callbacks.onVictory = () => e.continueEndless();
  e.enemies = []; e.drops = []; e.spatialGrid.clear();
  if (s.kind !== 'soak') e.waveDirector.update = function(dt) { this.survivalTime += dt; };
  const pin = enemy => { enemy.maxHp = 1e8; enemy.hp = 1e8; enemy.knockbackResistance = 0; };
  const forestTypes = ['bullet_ant', 'leafcutter_ant', 'poison_dart_frog', 'capybara', 'sloth',
    'rhino_beetle', 'sawyer_beetle', 'elite_tapir', 'elite_jaguar', 'sucuri'];
  const plainTypes = ['zombie', 'skeleton', 'bat', 'ghost', 'elite_minotaur'];
  for (let i = 0; i < s.count; i++) {
    const types = s.map === 'forest' ? forestTypes : plainTypes;
    e.devSpawnEnemy(types[i % types.length]);
    const enemy = e.enemies.at(-1), a = i * 2.39996, r = 120 + Math.sqrt((i + 1) / s.count) * 400;
    enemy.x = e.player.x + Math.cos(a) * r; enemy.y = e.player.y + Math.sin(a) * r;
    pin(enemy);
  }
  if (s.kind === 'guardian') {
    const npc = e[`${s.boss}Npc`];
    e.player.x = npc.x + 150; e.player.y = npc.y;
    const method = `start${s.boss[0].toUpperCase() + s.boss.slice(1)}Combat`;
    if (!e[method]()) throw Error(`Cannot start ${s.boss}`);
    const boss = e.bossEncounter.boss; pin(boss);
    if (s.boss === 'kopenawa') boss.hp = boss.maxHp * 0.45;
  }
  if (s.kind === 'combo') {
    e.waveDirector.survivalTime = 650;
    if (s.combo === 'water' || s.combo === 'earth') {
      e.player.x = 0; e.player.y = e.worldProps.riverCenterY(0);
    }
    for (let i = 0; i < s.bosses.length; i++) {
      e.devSpawnEnemy(s.bosses[i]); const boss = e.enemies.at(-1); pin(boss);
      boss.x = e.player.x + 200 + i * 55; boss.y = e.player.y + 30;
    }
  }
  const arm = () => {
    const ids = s.map === 'forest'
      ? ['metralha_floresta', 'nuvem_biologica', 'tempestade_lendaria']
      : ['lightning', 'bible', 'fire_flask', 'bottle_51', 'executioner_axe'];
    for (const id of ids) e.weaponSystem.addWeapon(id);
    e.devMaximizeAllEquipped(); e.devEvolveAllEquipped();
  };
  if (s.kind === 'arsenal' || s.kind === 'effects' || s.kind === 'soak') arm();
  if (s.kind === 'soak') e.waveDirector.survivalTime = s.map === 'forest' ? 570 : 180;
  if (s.kind === 'cave') {
    e.insideCave = true; e.player.x = e.caveInterior.spawn.x; e.player.y = e.caveInterior.spawn.y;
    e.caveInterior.updateCamera(e.camera, e.player);
  }
  e.camera.x = e.player.x; e.camera.y = e.player.y;
  const stats = window.perfStats = { times: {}, frames: [], windows: [], longTasks: [],
    peak: {}, states: {}, weaponsSeen: {}, heap: [], lastFrame: null, active: false, updates: 0 };
  const wrap = (object, key, label) => {
    if (s.lightProbe && label !== 'render') return;
    const fn = object[key]; if (typeof fn !== 'function') return;
    object[key] = function(...args) {
      const t = performance.now();
      try { return fn.apply(this, args); }
      finally { if (stats.active) (stats.times[label] ??= []).push(performance.now() - t); }
    };
  };
  for (const key of ['update', 'render', 'renderMinimap']) wrap(e, key, key);
  for (const key of ['renderFloor', 'renderTrees', 'renderDecorTrees', 'renderDecorCanopyOverlay', 'renderMinimapScenery'])
    wrap(e.worldProps, key, key);
  wrap(e.weaponSystem, 'update', 'weaponsUpdate'); wrap(e.weaponSystem, 'render', 'weaponsRender');
  wrap(e.vfx, 'render', 'vfxRender'); wrap(e.vfx, 'update', 'vfxUpdate');
  const update = e.update;
  let elapsed = 0;
  const origin = { x: e.player.x, y: e.player.y };
  e.update = function(dt) {
    elapsed += dt;
    if (s.kind === 'transitions') {
      const segment = Math.floor((performance.now() - (stats.startedAt || performance.now())) / 10000);
      if (stats.active && e.__guardianSegment !== segment && segment < 3) {
        e.__guardianSegment = segment;
        e.restoreBossEncounter();
        const kind = ['anaconda', 'gorilla', 'kopenawa'][segment], npc = e[`${kind}Npc`];
        e.player.x = npc.x + 150; e.player.y = npc.y;
        e.camera.x = e.player.x; e.camera.y = e.player.y;
        if (!e[`start${kind[0].toUpperCase() + kind.slice(1)}Combat`]()) throw Error(`Transition failed: ${kind}`);
        pin(e.bossEncounter.boss);
      }
      if (stats.active && segment === 2 && performance.now() - stats.startedAt > 25000 && e.bossEncounter?.kind === 'kopenawa') e.bossEncounter.boss.hp = e.bossEncounter.boss.maxHp * 0.45;
    }
    if (s.forceStun && Math.floor(elapsed / 6) !== e.__stunSegment) {
      e.__stunSegment = Math.floor(elapsed / 6); e.player.stunTimer = 1.5;
    }
    if (s.kind === 'catalog') {
      const phase = Math.floor(elapsed / 4) % (Math.ceil(s.weaponIds.length / 4) * 2);
      if (e.__weaponPhase !== phase) {
        e.__weaponPhase = phase; e.weaponSystem.weapons.clear();
        for (const id of s.weaponIds.slice(Math.floor(phase / 2) * 4, Math.floor(phase / 2) * 4 + 4)) e.weaponSystem.addWeapon(id);
        e.devMaximizeAllEquipped(); if (phase % 2) e.devEvolveAllEquipped();
      }
    }
    // Real movement inputs; avoids teleporting through the collision system.
    if (!s.kind || ['arsenal', 'effects', 'soak'].includes(s.kind)) {
      e.input.dx = Math.cos(elapsed * 0.6) * 0.8;
      e.input.dy = Math.sin(elapsed * 0.6) * 0.8;
    }
    // Region/lighting coverage fixture, not a natural traversal benchmark.
    if (s.kind === 'route') {
      const segment = Math.floor(elapsed / 10) % 6;
      const positions = [[0, 0], [0, e.worldProps.riverCenterY(0)], [3000, 3000], [-5500, -4500], [5000, 5000], [-1000, -1000]];
      if (e.__segment !== segment) { e.__segment = segment; [e.player.x, e.player.y] = positions[segment]; }
      e.input.dx = Math.cos(elapsed) * 0.8; e.input.dy = Math.sin(elapsed) * 0.8;
      e.waveDirector.survivalTime = [100, 520, 650, 1100, 1250, 1400][segment];
    }
    if (s.kind === 'effects' && Math.floor(elapsed * 2) !== e.__burst) {
      e.__burst = Math.floor(elapsed * 2);
      e.vfx.addDeathBurst(e.player.x, e.player.y, '#f97316', 200);
      for (let i = 0; i < 50; i++) e.vfx.addDamageNumber(e.player.x + i * 3, e.player.y, i * 19, i % 2 === 0);
      if (e.drops.length < 1200) e.devSpawnDrop('gem_blue', 40);
    }
    const ret = update.call(this, dt);
    if (stats.active && !s.lightProbe) {
      stats.updates++;
      for (const w of e.weaponSystem.weapons.values()) stats.weaponsSeen[`${w.id}:${w.level}:${w.evolved}`] = true;
      const counts = { enemies: e.enemies.length, projectiles: e.weaponSystem.projectiles.length,
        zones: e.weaponSystem.groundZones.length, drops: e.drops.length, vfx: e.vfx.count,
        particles: e.vfx.particles.length, damageNumbers: e.vfx.damageNumbers.length,
        bossProjectiles: e.bossProjectiles.length, hazards: e.bossHazards.length };
      for (const [k, v] of Object.entries(counts)) stats.peak[k] = Math.max(stats.peak[k] || 0, v);
      for (const enemy of e.enemies) if (enemy.isBoss || enemy.type === 'boss_kopenawa_clone') {
        const key = `${enemy.type}:${enemy.action || enemy.skillState}:${enemy.dive?.phase || ''}:${enemy.acid?.phase || ''}:${enemy.breathPhase || ''}:${enemy.entrancePhase || ''}:${enemy.smokeTimer > 0 ? 'smoke' : ''}:${enemy.comboChargeActive ? 'trample' : ''}`;
        stats.states[key] = (stats.states[key] || 0) + 1;
      }
    }
    return ret;
  };
  try { new PerformanceObserver(list => { if (stats.active) for (const t of list.getEntries()) stats.longTasks.push(t.duration); }).observe({ type: 'longtask', buffered: false }); } catch { /* unsupported browser */ }
  const tick = t => {
    if (stats.active && stats.lastFrame !== null) stats.frames.push(t - stats.lastFrame);
    stats.lastFrame = t; requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.beginPerf = () => { stats.active = true; stats.lastFrame = null; stats.startedAt = performance.now(); stats.startSimulation = e.waveDirector.survivalTime; };
  window.readPerfWindow = () => {
    const end = stats.frames.length;
    const start = stats.windows.at(-1)?.end || 0;
    const frames = stats.frames.slice(start, end);
    const renderCount = stats.times.render?.length || 0;
    const entry = { end, renderCount, renderedFrames: renderCount - (stats.windows.at(-1)?.renderCount || 0), elapsedMs: performance.now() - stats.startedAt, frames: frames.length,
      fps: frames.length * 1000 / frames.reduce((a, b) => a + b, 0), paused: e.isPaused,
      gameOver: e.isGameOver, enemies: e.enemies.length, vfx: e.vfx.count,
      heapUsed: performance.memory?.usedJSHeapSize ?? null };
    stats.windows.push(entry); return entry;
  };
  window.finishPerf = () => {
    stats.active = false;
    const summarize = a => {
      a.sort((x, y) => x - y); const n = a.length;
      return { samples: n, mean: a.reduce((x, y) => x + y, 0) / n,
        p50: a[Math.floor(n * .5)], p95: a[Math.floor(n * .95)], p99: a[Math.floor(n * .99)], max: a.at(-1) };
    };
    const frames = summarize(stats.frames);
    const finite = e.enemies.every(n => Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.hp));
    const webgl = document.createElement('canvas').getContext('webgl');
    const debug = webgl?.getExtension('WEBGL_debug_renderer_info');
    return { frames: { ...frames, fps: 1000 / frames.mean, over16_67: stats.frames.filter(t => t > 16.8).length,
      over33_33: stats.frames.filter(t => t > 33.5).length, over50: stats.frames.filter(t => t > 50).length },
      methods: Object.fromEntries(Object.entries(stats.times).map(([k, v]) => [k, summarize(v)])),
      windows: stats.windows, longTasks: summarize(stats.longTasks), peak: stats.peak, states: stats.states,
      weaponsSeen: Object.keys(stats.weaponsSeen),
      updates: stats.updates, wallMs: performance.now() - stats.startedAt, waveClockDeltaSeconds: e.waveDirector.survivalTime - stats.startSimulation,
      finite, paused: e.isPaused, gameOver: e.isGameOver, encounter: e.bossEncounter?.kind,
      finalPosition: { x: e.player.x, y: e.player.y }, fixtureOrigin: origin,
      canvas: { width: canvas.width, height: canvas.height },
      renderer: debug ? webgl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      visibility: document.visibilityState, userAgent: navigator.userAgent };
  };
}

(async () => {
  const report = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : {
    startedAt: new Date().toISOString(), baseURL, host: { platform: os.platform(), cpus: os.cpus()[0]?.model,
      logicalCPUs: os.cpus().length, totalMemoryGB: +(os.totalmem() / 2 ** 30).toFixed(1) }, cases: [] };
  const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  for (const test of cases.filter(t => only.test(t.id))) {
    if (report.cases.some(t => t.id === test.id && t.result)) continue;
    const errors = [], resources = [];
    const start = Date.now(); let browser;
    console.log(`START ${test.id} (${test.seconds}s, CPU ${test.cpu}x)`);
    try {
      const args = test.software ? ['--disable-accelerated-2d-canvas', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];
      if (test.foreground) args.push('--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion');
      browser = await chromium.launch({ channel: 'msedge', headless: !test.headed, args });
      const context = await browser.newContext({ viewport: { width: test.width, height: test.height }, deviceScaleFactor: test.dpr });
      const page = await context.newPage(); page.setDefaultTimeout(90000);
      page.on('pageerror', err => errors.push(err.stack || err.message));
      page.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === baseURL) resources.push({ status: r.status(), url: r.url() }); });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: test.cpu });
      await cdp.send('Performance.enable');
      await page.addInitScript(seed => { let s = seed; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }, test.seed);
      await page.goto(baseURL);
      if (test.foreground) await page.bringToFront();
      if (test.map === 'forest') await page.getByRole('button', { name: /Floresta Amazônica/ }).click();
      await page.getByRole('button', { name: /INICIAR COM/ }).click();
      await page.locator('canvas').waitFor(); await page.waitForTimeout(1500);
      await page.evaluate(browserFixture, test);
      await page.waitForTimeout(2500);
      await cdp.send('HeapProfiler.collectGarbage');
      const heapBefore = await cdp.send('Runtime.getHeapUsage');
      await page.evaluate(() => window.beginPerf());
      for (let elapsed = 0; elapsed < test.seconds; elapsed += 5) {
        await page.waitForTimeout(Math.min(5, test.seconds - elapsed) * 1000);
        const windowResult = await page.evaluate(() => window.readPerfWindow());
        if (windowResult.frames === 0) throw Error('RAF stopped during sample');
        if (windowResult.renderedFrames === 0) throw Error('Game rendering stopped during sample');
        if (windowResult.paused || windowResult.gameOver) throw Error('Gameplay paused or ended during performance sample');
      }
      const result = await page.evaluate(() => window.finishPerf());
      if (!result.finite || result.paused || result.gameOver || !result.frames.samples) throw Error('Invalid gameplay sample');
      if (test.kind === 'catalog') {
        const forms = new Set(result.weaponsSeen.map(key => `${key.split(':')[0]}:${key.endsWith(':true')}`));
        const missing = test.weaponIds.flatMap(id => [false, true].filter(evolved => !forms.has(`${id}:${evolved}`)).map(evolved => `${id}:${evolved}`));
        if (missing.length) throw Error(`Weapon coverage incomplete: ${missing.join(', ')}`);
      }
      if (errors.length) throw Error(`Browser execution errors: ${errors.length}`);
      // Pause before GC so final retained heap is not racing new gameplay allocations.
      await page.evaluate(() => {
        window.perfEngine.pause();
        // Do not mistake retained profiling buffers for game memory growth.
        const stats = window.perfStats;
        stats.times = {}; stats.frames = []; stats.windows = []; stats.longTasks = []; stats.states = {};
      });
      await cdp.send('HeapProfiler.collectGarbage');
      const heapAfter = await cdp.send('Runtime.getHeapUsage');
      const row = { ...test, samplesReleasedBeforeFinalGC: true, result, heapBefore, heapAfter, errors, resources, elapsedMs: Date.now() - start };
      report.cases = report.cases.filter(c => c.id !== test.id); report.cases.push(row); save();
      console.log(`DONE ${test.id}: ${result.frames.fps.toFixed(1)} FPS, P95 ${result.frames.p95.toFixed(1)}ms, P99 ${result.frames.p99.toFixed(1)}ms, errors=${errors.length}, finite=${result.finite}`);
    } catch (error) {
      report.cases.push({ ...test, failure: String(error.stack || error), errors, resources, elapsedMs: Date.now() - start }); save();
      console.log(`FAIL ${test.id}: ${error.message}`);
    } finally { await browser?.close(); }
  }
  report.finishedAt = new Date().toISOString(); save();
  if (report.cases.some(c => only.test(c.id) && c.failure)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
