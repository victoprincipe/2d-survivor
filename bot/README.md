# Bot de implementações — 2d-survivor

Bot de Discord que recebe ideias de melhoria, coloca em uma fila FIFO e executa uma por vez com o **OpenCode** em um worktree isolado. Se o build e o lint passarem, o worker faz o merge na `master`, roda a verificação de novo e faz **commit + push** para o remote configurado.

## Como funciona

```
/implementar → modal → SQLite (queued)
                            │
                            ▼
                  worker pega o menor id
                            │
                            ▼
            git worktree a partir da master
                            │
                            ▼
          opencode run --standalone --auto
                            │
                            ▼
                 npm run build && npm run lint
                            │
                    ┌───────┴────────┐
                  falhou           passou
                    │                │
               failed, master    diff check
               intacta              │
                             ┌─────┴─────┐
                          suspeito      ok
                             │           │
                       failed, branch  commit + FF na master
                       mantida            │
                                          ▼
                              build/lint de novo (verificação)
                                          │
                                   falhou ┴ passou
                                      │       │
                                  revert   push origin master
                                              │
                                            done
```

O worker e o bot são processos separados e compartilham o SQLite em WAL. O bot fica online; o worker pode ser reiniciado sem derrubar o bot.

## Pré-requisitos

- Node.js 22+ (testado com 23.9).
- `npm install` na raiz do jogo já feito.
- OpenCode autenticado (`opencode auth login`) e um modelo escolhido em `AGENT_MODEL` (rode `opencode models` para listar).
- Git disponível no PATH e um remote configurado (`origin`) com permissão de push.
- O `gh` CLI autenticado e `gh auth setup-git` executado, ou credenciais git já configuradas.

> O `HOME` do agente é isolado do seu config global, então o modelo padrão do OpenCode **não** é herdado. Defina `AGENT_MODEL` com um modelo bom para código; sem isso ele pode usar um modelo free/fraco.

## 1. Criar o app no Discord

1. Acesse <https://discord.com/developers/applications> → **New Application**.
2. Em **Bot**, copie o **Token**.
3. Em **Privileged Gateway Intents**, deixe apenas **Guilds** (Message Content não é necessário).
4. Em **OAuth2 → URL Generator**, marque:
   - Scopes: `bot`, `applications.commands`
   - Permissions: View Channels, Send Messages, Embed Links, Read Message History, Add Reactions, Create Public Threads, Send Messages in Threads
5. Abra a URL gerada e convide o bot para o servidor.

No Discord, copie o ID do canal onde as implementações serão publicadas (`SUGGESTIONS_CHANNEL_ID`).

## 2. Configurar o bot

```bash
cd bot
cp .env.example .env
```

Preencha o `.env`:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DISCORD_TOKEN` | sim | token do bot |
| `CLIENT_ID` | sim (deploy) | Application ID |
| `GUILD_ID` | sim (deploy) | ID do servidor |
| `SUGGESTIONS_CHANNEL_ID` | sim | canal onde os jobs são publicados |
| `SUBMITTER_ROLE_ID` | não | se preenchido, só esse cargo envia implementações |
| `REPO_PATH` | não | caminho do repo do jogo; padrão: pasta pai de `bot/` |
| `MAIN_BRANCH` | não | padrão `master` |
| `GIT_REMOTE` | não | padrão `origin` |
| `GIT_PUSH` | não | padrão `true`; se `false`, só faz merge local |
| `AGENT_MODEL` | não | formato `provider/model`; use um modelo forte para código |
| `LINT_STRICT` | não | `true` por padrão; use `false` se o repo já tiver lint quebrado |
| `POST_MERGE_VERIFY` | não | `true` por padrão; roda build/lint em worktree separado após o merge |

As demais variáveis têm padrões seguros e estão comentadas no `.env.example`.

## 3. Instalar, registrar comandos e rodar

```bash
cd bot
npm install
npm run deploy
npm run dev
```

`npm run dev` sobe o bot e o worker juntos (`concurrently`). Para rodar separado:

```bash
npm run dev:bot
npm run dev:worker
```

## Comandos

| Comando | Quem | O que faz |
|---|---|---|
| `/implementar` | membros com quota | abre o modal e enfileira |
| `/fila` | todos | estado da fila, repo, job atual e próximos |
| `/minhas-implementacoes` | todos | suas implementações e status |
| `/ultimas-implementacoes` | todos | últimas implementações do servidor |

## Quotas padrão

- Conta com pelo menos 7 dias.
- 1 job ativo por usuário (`queued` ou `running`).
- 3 jobs por dia por usuário.
- 20 jobs por dia no total.
- Fila máxima de 20.
- Prompt de 20 a 1500 caracteres.

Tudo ajustável no `.env`.

## Status dos jobs

| Status | Significado |
|---|---|
| `queued` | na fila |
| `running` | worker executando |
| `done` | aplicado na master e enviado para o remote |
| `failed` | agente, gate, diff ou push falhou; a branch `implementacao/<id>` é mantida |
| `interrupted` | worker caiu no meio; reenvie a implementação |

## Segurança

O worker roda o OpenCode com um `HOME` próprio (`bot/data/agent-home`):

- A config global do seu OpenCode, MCPs, skills e aprovações salvas **não** são carregadas.
- Só a `auth.json` do OpenCode é copiada para lá.
- A config do agente fica em `bot/agent/opencode.json` (copiada para o `HOME` isolado no startup).
- Leitura de `.env`, `.ssh`, `.aws`, `.config`, `.npmrc` e do próprio auth é negada.
- O agente não pode editar `bot/`, `.github/`, `AGENTS.md`, `package.json`, lockfiles ou configs.
- O agente não pode rodar `git commit/push/checkout/reset`, `rm`, `sudo`, `curl`, `wget`, `ssh` ou instalar dependências.
- O gate (`npm run build` / `npm run lint`) roda com outro `HOME` vazio e sem chaves de provedor, para que código do build não leia credenciais.
- Diff acima de 20 arquivos/800 linhas, arquivos removidos ou caminhos protegidos fazem o job falhar sem push.
- Antes do merge, o worker confere que a master continua no mesmo SHA e limpa; depois do merge, roda build/lint de novo e faz `git revert` automático se falhar.
- O push é feito depois da verificação; se falhar, o commit local é mantido e o job é reportado como falho.

**Risco residual:** sem Docker, o shell do agente roda com o seu usuário. As permissões são defesa em profundidade, não uma jaula de kernel. Para um servidor público, use Docker.

## Operação

- O worker precisa da `master` **checada e limpa**. Enquanto um job roda, não edite o repo principal; se editar, o merge falha e o job fica `failed`.
- O worker parte do **HEAD** da master. Commite o jogo e o bot antes de usar a fila; `git stash` não serve, porque o worktree não enxerga alterações não commitadas.
- Para trabalhar em paralelo, use outro clone.
- O worker faz push para `GIT_REMOTE`/`MAIN_BRANCH` depois de cada job verde.
- Para inspecionar: `npm run db:status`.
- Reinicie o worker depois de mudar `.env` ou `bot/agent/opencode.json`.

## Estrutura

```
bot/
  agent/opencode.json      # config restritiva do agente
  src/
    index.ts               # bot discord.js
    deploy-commands.ts     # registro dos slash commands
    commands/              # /implementar, /fila, /minhas, /ultimas
    events/                # interactionCreate
    handlers/              # modal de implementação
    services/              # quotas, moderação, permissões, notificações
    ui/                    # embeds
    worker/                # loop, opencode, gate, apply, rollback
    scripts/               # db-init, db:status, check:commands
  data/                    # SQLite, logs, agent-home (gitignored)
```

## Troubleshooting

- **`Variáveis ausentes no bot/.env`**: preencha `DISCORD_TOKEN` e `SUGGESTIONS_CHANNEL_ID`.
- **Bot não responde**: rode `npm run deploy` e confira se o bot foi convidado com `applications.commands`.
- **Fila parada**: `/fila` mostra o motivo. Normalmente é repo sujo ou branch diferente de `master`.
- **`auth.json do OpenCode não encontrado`**: rode `opencode auth login` e reinicie o worker.
- **Build falha em todo job**: o repo pode já estar quebrado na master; rode `npm run build` na raiz. Se for só lint antigo, use `LINT_STRICT=false`.
- **Push falha**: confira `git remote -v`, `gh auth status` e rode `gh auth setup-git`. O commit local fica na `master`; você pode fazer o push manualmente.
- **Modelo fraco**: defina `AGENT_MODEL` com um modelo bom para código.
