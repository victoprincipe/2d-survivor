# 2d-survivor

Jogo roguelite de sobrevivência no estilo *Vampire Survivors*, feito para rodar no navegador com **Next.js 16 (App Router)**, **React 19** e **HTML5 Canvas**. Enfrente hordas, colete experiência, evolua armas e passivas e tente sobreviver o máximo possível.

Também inclui um bot independente de implementações para Discord em [`bot/`](bot/README.md).

## Requisitos

- Node.js 22+
- npm

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Scripts

```bash
npm run dev          # servidor de desenvolvimento
npm run build        # build de produção
npm run start        # serve o build de produção
npm run lint         # ESLint (ignora bot/)
npx tsc --noEmit     # typecheck da raiz
npm run bot:check    # typecheck do bot
npm run bot:dev      # bot + worker juntos
npm run bot:deploy   # registra os slash commands do Discord
```

## Estrutura

- `src/app/` — rotas do Next.js; `page.tsx` renderiza o `GameContainer`.
- `src/components/` — componentes React que ligam a UI ao motor do jogo.
- `src/game/` — motor, entidades, sistemas, armas e tipos, sem dependência de React.
- `src/game/data/` — conteúdo data-driven: personagens, armas/passivas, mapas, dificuldades, missões e persistência.
- `public/` — sprites, imagens e áudios.
- `bot/` — bot de Discord e worker de implementações (documentação própria em [`bot/README.md`](bot/README.md)).

## O jogo

O `GameContainer` controla os estados `menu | playing | paused | level_up | chest | game_over | victory`. Durante a partida, o `GameEngine` roda o loop de animação e atualiza a HUD via callbacks; eventos de level up e baú pausam o jogo.

O progresso permanente é salvo no `localStorage` com a chave `vampire_survivors_2d_save`.

## Bot de implementações (Discord)

O bot em `bot/` transforma ideias dos membros em uma fila FIFO executada pelo OpenCode em worktrees isolados, com commit e push automático na `master`. Veja [`bot/README.md`](bot/README.md) para setup, comandos e modelo de segurança.

```bash
cd bot
cp .env.example .env
npm install
npm run deploy
npm run dev
```
