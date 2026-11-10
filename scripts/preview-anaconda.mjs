import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Local visual QA harness using the actual simulation and renderer, no app route.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = {};
function bundle(filename) {
  const id = path.relative(root, filename).replaceAll('\\', '/');
  if (modules[id]) return id;
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  modules[id] = output.replace(/require\("(\.[^"]+)"\)/g, (_, specifier) => {
    const target = path.resolve(path.dirname(filename), specifier + '.ts');
    return `require(${JSON.stringify(bundle(target))})`;
  });
  return id;
}
const entry = bundle(path.join(root, 'src/game/entities/AnacondaBoss.ts'));
const camera = bundle(path.join(root, 'src/game/engine/Camera.ts'));
const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Prévia da sucuri</title>
<style>body{margin:0;background:#081a1a;color:#ecfccb;font:16px system-ui}main{max-width:1200px;margin:auto;padding:16px}h1{font-size:22px;margin:0 0 12px}button{padding:10px 20px;margin:0 8px 12px 0;border:1px solid #84cc16;background:#173b32;color:#fff;border-radius:8px;cursor:pointer}canvas{width:100%;display:block;border:1px solid #2b6766;border-radius:12px}p{font-size:13px;color:#a7c5ba}</style>
<main><h1>Sucuri Gigante · teste do renderizador</h1><button id="bite">Bote duplo</button><button id="acid">Chuva ácida</button><button id="dive">Mergulho</button><button id="pause">Pausar</button><canvas width="1200" height="600"></canvas><p>Mesmas classes usadas no jogo. A cena isola os visuais para conferência; os testes de combate estão em scripts/check-anaconda.mjs.</p></main>
<script>const sources=${JSON.stringify(modules)},cache={};function require(id){if(cache[id])return cache[id].exports;const module={exports:{}};cache[id]=module;new Function('require','module','exports',sources[id])(require,module,module.exports);return module.exports;}
const {AnacondaBoss}=require(${JSON.stringify(entry)}),{Camera}=require(${JSON.stringify(camera)});
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),camera=new Camera(1600,800);camera.x=-3800;camera.y=-3600;
const world={isInUpperLake(){return true},resolveUpperLakeMovement(x,y,tx,ty){return {x:tx,y:ty}}};
let boss,mode='bite',paused=false;
const player={x:-3750,y:-3600,radius:14,isJumping:false,godMode:false,invulnerableTimer:0};
function reset(next){mode=next;boss=new AnacondaBoss(1,-4000,-3600,1,world);boss.biteCooldown=next==='bite'?0:999;boss.diveCooldown=next==='dive'?0:999;boss.slamCooldown=999;boss.acidCooldown=next==='acid'?0:999;boss.hp=8000;}
document.querySelector('#bite').onclick=()=>{reset('bite');paused=false;document.querySelector('#pause').textContent='Pausar'};document.querySelector('#acid').onclick=()=>{reset('acid');boss.update(0,player,{vx:0,vy:0});boss.update(1,player,{vx:0,vy:0});boss.update(2,player,{vx:0,vy:0});paused=true;document.querySelector('#pause').textContent='Continuar'};document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'Continuar':'Pausar'};reset('bite');
document.querySelector('#dive').onclick=()=>{reset('dive');boss.update(0,player,{vx:0,vy:0});boss.update(.7,player,{vx:0,vy:0});boss.update(2,player,{vx:0,vy:0});paused=true;document.querySelector('#pause').textContent='Continuar'};
let previous=performance.now();function frame(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;if(!paused){boss.update(dt,player,{vx:0,vy:0});if(mode==='bite'&&boss.action==='idle')boss.biteCooldown=0;if(mode==='acid'&&!boss.acid.casting&&boss.action==='idle')boss.acidCooldown=0;}
ctx.setTransform(.75,0,0,.75,0,0);ctx.fillStyle='#164b52';ctx.fillRect(0,0,1600,800);ctx.strokeStyle='#24646b';ctx.lineWidth=2;for(let y=20;y<800;y+=32){ctx.beginPath();for(let x=0;x<1600;x+=8){const wave=y+Math.sin(x/60+y)*3;if(x===0)ctx.moveTo(x,wave);else ctx.lineTo(x,wave);}ctx.stroke();}
boss.acid.renderGround(ctx,camera);boss.dive.render(ctx,camera);boss.render(ctx,camera);const p=camera.worldToScreen(player.x,player.y);ctx.fillStyle='#fef3c7';ctx.beginPath();ctx.arc(p.x,p.y,14,0,Math.PI*2);ctx.fill();ctx.font='16px system-ui';ctx.fillText('Jogador',p.x-30,p.y+34);boss.acid.renderAir(ctx,camera,player);ctx.fillStyle='#ecfccb';ctx.font='bold 22px system-ui';ctx.fillText(mode==='bite'?'Corpo fixo · dois botes consecutivos':mode==='dive'?'Mergulho · agitação do lago · raio 700':'Chuva ácida · raio 500 · veneno persistente',35,45);requestAnimationFrame(frame);}requestAnimationFrame(frame);
</script></html>`;

const mime = { '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif' };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (pathname === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); return; }
  const file = path.resolve(root, 'public', '.' + pathname);
  const publicRoot = path.resolve(root, 'public') + path.sep;
  if (!file.startsWith(publicRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(response);
});
server.listen(3018, '127.0.0.1', () => console.log('Visual QA: http://127.0.0.1:3018'));
