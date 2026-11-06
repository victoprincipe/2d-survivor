<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 2d-survivor

Vampire Survivors–style browser game (Next.js 16 App Router, React 19, HTML5 Canvas) plus an independent Discord implementation bot in `bot/`.

## Commands

```bash
npm run dev          # Next dev server
npm run build        # production build (also the bot gate's first step)
npm run lint         # ESLint (ignores bot/)
npx tsc --noEmit     # root typecheck; there is no npm script for it
npm run bot:check    # bot typecheck
npm run bot:dev      # bot + worker together
npm run bot:deploy   # register Discord slash commands
```

- There is no test suite and no CI. Verify with `npx tsc --noEmit`, `npm run build`, and `npm run lint`; all pass on a clean `master`.
- Lint one file with `npx eslint src/path/file.tsx`. Do not assume `npm test` or a root `npm run typecheck` exists.
- The root `README.md` is mostly create-next-app boilerplate (it references a nonexistent `app/page.tsx`); `bot/README.md` is the detailed, current bot doc.

## Game code

- `src/app/page.tsx` renders client component `GameContainer`, which owns the `menu | playing | paused | level_up | chest | game_over | victory` state machine and is the only bridge between React and the engine.
- Everything under `src/game/**` is framework-free. `GameEngine` owns the requestAnimationFrame loop; React is updated through callbacks (`onHUDUpdate` throttled to ~10 Hz, `onLevelUp`, `onTreasureChest`, `onGameOver`, `onVictory`). Do not import React into `src/game/**`.
- The canvas mounts only after leaving `menu`; the engine starts after a 50 ms timeout and is destroyed on unmount. Level-up and chest events pause the engine.
- Content is data-driven: `src/game/data/upgrades.ts` holds the weapon/passive registries, `characters.ts` the playable characters, and `persistence.ts` the permanent upgrades. Saves use localStorage key `vampire_survivors_2d_save` with no schema version (handle missing fields defensively).
- A new weapon or passive also needs its ID union in `src/game/types/index.ts` and its behavior in `src/game/weapons/WeaponSystem.ts`.
- `src/components/game/GameCanvas.tsx` is unused; `GameContainer` renders and wires its canvas inline.
- UI copy is Brazilian Portuguese; keep new strings consistent.

## Next.js / Tailwind quirks

- `next.config.ts` enables `cacheComponents` and `partialPrefetching`. Keep the generated Next.js block above; it is rewritten by `next dev`.
- Tailwind v4 has no `tailwind.config.*` or `postcss.config.*`: `next.config.ts` wires `@tailwindcss/turbopack` and `src/app/globals.css` does `@import "tailwindcss"`. Do not add those configs.
- Import alias is `@/*` -> `src/*`. Components using hooks or browser APIs need `'use client'`; `layout.tsx` is a server component.

## Bot (`bot/`)

- Separate Node >=22 package with its own lockfile, CommonJS `tsconfig`, and toolchain; root ESLint and `tsconfig.json` exclude it. Install with `cd bot && npm install` (there is no root install script for it).
- First run: `cp .env.example .env`, fill `DISCORD_TOKEN` and `SUGGESTIONS_CHANNEL_ID` (plus `CLIENT_ID`/`GUILD_ID` for deploy), run `npm run deploy` once, then `npm run dev`. Re-run `deploy` after changing commands; restart the worker after changing `.env` or `bot/agent/opencode.json`.
- The worker copies only `~/.local/share/opencode/auth.json` into an isolated HOME and does not inherit your global OpenCode model: set `AGENT_MODEL` explicitly, otherwise a weak free model may be used.
- Jobs are FIFO in SQLite at `bot/data/bot.db`, one at a time. Each job clones `origin/master` under `../.2d-survivor-worktrees/job-N` on branch `implementacao/N`, with the root `node_modules` hardlinked in (root `npm install` must have run first).
- The gate is `npm run build` then `npm run lint` (lint is skipped if build fails). On green it pushes `implementacao/N` and then `HEAD:master` to `origin` automatically; it never touches your local checkout.
- The worker does not require a clean local checkout. Uncommitted changes and stashes are not included in jobs (jobs start from `origin/master`); commit and push WIP to include it. You can keep editing locally while the worker runs.
- Slash commands: `/implementar` (the modal asks only for the prompt; the title is derived from its first line), `/fila`, `/minhas-implementacoes`, `/ultimas-implementacoes`, and `/reprocessar <id>` (author or `Manage Server`). `needs_review` is legacy; blocked diffs fail and keep the branch on the origin.
- The bot's OpenCode implementer reads this file and is denied edits to `bot/`, `.github/`, `AGENTS.md`, `.env*`, manifests/lockfiles, and Next/TS/ESLint/PostCSS/Tailwind/opencode configs. It must write `JOB_SUMMARY.md`, cannot install dependencies, and cannot run git writes. Keep instructions here compatible with those limits.
- Inspect the queue from `bot/` with `npm run db:status`; job logs live in `bot/data/logs/`.
