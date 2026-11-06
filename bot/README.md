# Bot de implementações — 2d-survivor

Bot de Discord que recebe ideias de melhoria, coloca em uma fila FIFO e executa uma por vez com o **OpenCode**. Cada job roda em um clone isolado, passa por build/lint e, se estiver verde, é enviado para `origin/master` com commit automático.

## Como funciona

```
mensagem no canal de prompts → SQLite (queued)
                                         │
                                         ▼
                               worker pega o menor id
                                         │
                                         ▼
                     git clone origin/master → job-N
                                         │
                                         ▼
                       opencode run (HOME/DB isolados)
                                         │
                                         ▼
                              npm run build && npm run lint
                                         │
                                 ┌───────┴────────┐
                               falhou           passou
                                 │                │
                            failed, branch    commit
                            enviada pro          │
                            origin               ▼
                                      push implementacao/N
                                                 │
                                                 ▼
                                       push HEAD:master
                                                 │
                                               done
```

O bot e o worker são processos separados e compartilham o SQLite em WAL. O bot fica online; o worker pode ser reiniciado sem derrubar o bot.

## O que não bloqueia

O worker **não olha o estado do seu checkout local**. Ele clona `origin/master` para cada job. Portanto:

- arquivos não commitados no seu repo **não bloqueiam** a fila;
- eles também **não entram** no job (o job parte do que está publicado);
- para incluir seu WIP, commite e dê push antes de enfileirar.

O `/fila` mostra o estado do checkout local só como informação.

## Pré-requisitos

- Node.js 22+.
- `npm install` na raiz do jogo (o worker hardlinka o `node_modules`).
- OpenCode autenticado (`opencode auth login`) e um modelo em `AGENT_MODEL` (rode `opencode models`).
- Remote `origin` configurado no repo principal.
- `gh auth setup-git` ou credenciais git já configuradas para o push.

## 1. Criar o app no Discord

1. <https://discord.com/developers/applications> → **New Application**.
2. Em **Bot**, copie o **Token**.
3. Em **Privileged Gateway Intents**, habilite **Message Content** e mantenha **Guilds**. O bot também usa o intent normal **GuildMessages**.
4. Em **OAuth2 → URL Generator**, marque `bot` + `applications.commands` e as permissões: View Channels, Send Messages, Embed Links, Read Message History, Add Reactions, Create Public Threads, Send Messages in Threads.
5. Convide o bot e copie o ID do canal de implementações.

## 2. Configurar

```bash
cd bot
cp .env.example .env
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DISCORD_TOKEN` | sim | token do bot |
| `CLIENT_ID` | sim (deploy) | Application ID |
| `GUILD_ID` | sim (deploy) | ID do servidor |
| `SUGGESTIONS_CHANNEL_ID` | sim | canal onde os jobs são publicados |
| `PROMPT_CHANNEL_ID` | não | canal onde os usuários escrevem o prompt; se vazio, usa `SUGGESTIONS_CHANNEL_ID` |
| `SUBMITTER_ROLE_ID` | não | se preenchido, só esse cargo envia |
| `REPO_PATH` | não | caminho do repo; padrão: pasta pai de `bot/` |
| `MAIN_BRANCH` | não | padrão `master` |
| `GIT_AUTHOR_EMAIL` | não | e-mail verificado usado nos commits do worker (padrão: noreply do GitHub) |
| `AGENT_MODEL` | não | ex.: `opencode/deepseek-v4.1-flash-free` |
| `LINT_STRICT` | não | `true` por padrão |

## 3. Instalar, registrar e rodar

```bash
cd bot
npm install
npm run deploy
npm run dev
```

Separado: `npm run dev:bot` e `npm run dev:worker`.

## Como enviar

Escreva o prompt **diretamente no canal definido em `PROMPT_CHANNEL_ID`** (ou em `SUGGESTIONS_CHANNEL_ID`, se vazio). O bot lê a mensagem, cria o job e responde com o ID e a posição. A partir daí o fluxo é automático.

## Comandos

| Comando | Quem | O que faz |
|---|---|---|
| `/fila` | todos | estado da fila, worker e repo local |
| `/minhas-implementacoes` | todos | suas implementações |
| `/ultimas-implementacoes` | todos | últimas do servidor |
| `/reprocessar <id>` | autor ou `Manage Server` | recoloca uma falha na fila |

O título exibido é derivado da primeira linha do prompt; não há campo separado de título.

## Quotas padrão

- Conta com pelo menos 7 dias.
- 1 job ativo por usuário.
- 5 jobs por dia por usuário; 20 no total.
- Fila máxima de 20.
- Prompt de 20 a 1500 caracteres.

## Status

| Status | Significado |
|---|---|
| `queued` | na fila |
| `running` | worker executando |
| `done` | commit enviado para `origin/master` |
| `failed` | agente, gate, diff ou push falhou; a branch `implementacao/<id>` fica no origin |
| `interrupted` | worker caiu no meio; use `/reprocessar <id>` |

## O que o worker faz

1. Clona `origin/master` em `../.2d-survivor-worktrees/job-<id>`.
2. Cria a branch `implementacao/<id>`.
3. Roda o OpenCode com `HOME`, banco e `PWD` isolados (não herda config global, MCPs nem modelo).
4. Roda `npm run build` e depois `npm run lint`.
5. Commita e envia a branch `implementacao/<id>` para o origin.
6. Se o diff estiver dentro dos limites, envia `HEAD:master` para o origin.
7. Remove o clone. A branch permanece no origin para inspeção.

Diff acima de 20 arquivos/800 linhas, arquivos removidos ou caminhos protegidos fazem o job falhar sem push na master — a branch continua no origin. Se o push da master falhar (por exemplo, o origin avançou), o job falha e a branch também fica no origin.

## Segurança

O worker roda o OpenCode com um `HOME` próprio por job:

- só `auth.json` e a config do agente são copiados; config global, MCPs, skills e aprovações não são herdados;
- leitura de `.env`, `.ssh`, `.aws`, `.config`, `.npmrc` e do auth é negada;
- o agente não pode editar `bot/`, `.github/`, `AGENTS.md`, manifests/lockfiles ou configs;
- o agente não roda `git commit/push/checkout/reset`, `rm`, `sudo`, `curl`, `wget`, `ssh` nem instala dependências;
- o gate roda com outro `HOME` vazio e sem chaves de provedor;
- o agente nunca edita o seu checkout local; ele trabalha no clone.

**Risco residual:** sem Docker, o shell do agente roda com o seu usuário. As permissões são defesa em profundidade, não uma jaula de kernel.

## Operação

- O worker precisa de `origin` acessível; se o push falhar, veja `/fila` e os logs.
- O checkout local pode ficar sujo; isso não bloqueia.
- Se quiser incluir WIP, commite e faça push antes de enviar o prompt.
- O worker faz push para `origin`/`master` depois de cada job.
- Os commits do worker usam `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`. Mantenha o e-mail verificado no GitHub; o padrão é o noreply `6431486+victoprincipe@users.noreply.github.com`.
- Para inspecionar: `npm run db:status`; logs em `bot/data/logs/`.
- Reinicie o worker depois de mudar `.env` ou `bot/agent/opencode.json`.

## Estrutura

```
bot/
  agent/opencode.json      # config restritiva do agente
  src/
    index.ts               # bot discord.js
    deploy-commands.ts     # registro dos slash commands
    commands/              # fila, minhas, ultimas, reprocessar
    events/                # interactionCreate, messageCreate
    services/              # quotas, moderação, permissões, notificações
    ui/                    # embeds
    worker/                # loop, opencode, gate, apply
    scripts/               # db-init, db:status, check:commands
  data/                    # SQLite, logs, homes do agente (gitignored)
```

## Troubleshooting

- **`Variáveis ausentes no bot/.env`**: preencha token e canal.
- **Bot não responde**: rode `npm run deploy`; confira `applications.commands`.
- **`auth.json do OpenCode não encontrado`**: rode `opencode auth login` e reinicie o worker.
- **Mensagens não são lidas**: confira se o **Message Content Intent** está habilitado no Developer Portal e se `PROMPT_CHANNEL_ID` aponta para o canal certo.
- **Build falha em todo job**: rode `npm run build` na raiz. Se for só lint antigo, use `LINT_STRICT=false`.
- **Push falha**: confira `git remote -v`, `gh auth status` e `gh auth setup-git`.
- **Modelo fraco**: ajuste `AGENT_MODEL` (`opencode models`).
