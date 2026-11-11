# JOB 145 — Pajé xamã

## O que mudou

- Adicionado o personagem jogável **Pajé Aruanã** (“Xamã Ancestral”), com sprite/atlas próprios.
- Criado um spritesheet SVG 4×4 (16 frames) no mesmo enquadramento dos personagens com `animationSprite`, com as linhas:
  1. caminhada (4 frames);
  2. salto (4 frames);
  3. ataque com cajado (4 frames);
  4. idle (4 frames).
- O atlas inclui cocar colorido, cabelos e barba brancos longos, pintura corporal, tanga tribal e cajado de madeira com caveira de pássaro.
- Criado um retrato estático reutilizando o frame de idle do atlas para a seleção e o HUD.
- O Pajé começa com a arma `wand`, reaproveitando o comportamento existente de projéteis espirituais (sem nova arma/dependência).
- Disparos da `wand` agora acionam a animação de ataque de personagens que usam atlas (`animationSprite`), permitindo que a linha de ataque do Pajé apareça em jogo.

## Arquivos tocados

- `src/game/data/characters.ts`
- `src/game/weapons/WeaponSystem.ts`
- `public/paje-xaman-spritesheet.svg` (novo)
- `public/paje-xaman.svg` (novo)
- `JOB_SUMMARY.md` (novo)

## Como validar

1. `npm run dev` e abrir a tela inicial.
2. Selecionar **Pajé Aruanã** e confirmar o retrato no card e no HUD.
3. Iniciar a partida e verificar idle, caminhada, salto e a animação de ataque ao disparar a arma inicial.
4. Rodar `npm run build`, `npm run lint` e `npx tsc --noEmit`.

Não foram adicionadas dependências nem alterados arquivos de configuração.
