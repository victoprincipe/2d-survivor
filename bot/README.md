# Bot de implementações — 2d-survivor

Bot de Discord que recebe ideias de melhoria, coloca em uma fila FIFO e executa uma por vez com o **OpenCode**. Cada job roda em um clone isolado, passa por build/lint e, se estiver verde, é enviado para `origin/master` com commit automático.

## Como funciona

```
/implementar → SQLite (queued)
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
3. Em **Privileged Gateway Intents**, não é necessário habilitar nenhum intent privilegiado. O bot usa apenas o intent **Guilds**.
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
| `SUBMITTER_ROLE_ID` | não | se preenchido, só esse cargo envia |
| `REPO_PATH` | não | caminho do repo; padrão: pasta pai de `bot/` |
| `MAIN_BRANCH` | não | padrão `master` |
| `GIT_AUTHOR_EMAIL` | não | e-mail verificado usado nos commits do worker (padrão: noreply do GitHub) |
| `AGENT_MODEL` | não | ex.: `opencode/deepseek-v4.1-flash-free` |
| `AGENT_VISION_MODEL` | não | modelo com visão para jobs com imagem (padrão: `opencode/nemotron-3.5-super-vl-free`) |
| `AGENT_PLANNER_MODEL` | não | modelo do planejador; vazio usa `AGENT_MODEL` |
| `MAX_PROMPT_IMAGES` | não | imagens por prompt (padrão: 3) |
| `MAX_IMAGE_MB` | não | tamanho máximo por imagem (padrão: 8) |
| `MAX_PROMPT_AUDIOS` | não | áudios por prompt (padrão: 3) |
| `MAX_AUDIO_MB` | não | tamanho máximo por áudio (padrão: 10) |
| `IMAGE_RETENTION_DAYS` | não | dias antes de apagar os anexos locais (padrão: 7) |
| `DAILY_PLAN_LIMIT` | não | planos por dia por usuário (padrão: 10) |
| `MAX_ACTIVE_PLANS_PER_USER` | não | planos em andamento por usuário (padrão: 1) |
| `PLAN_QUEUE_LIMIT` | não | planos na fila (padrão: 10) |
| `PLAN_TIMEOUT_MIN` | não | timeout do planejador em minutos (padrão: 10) |
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

Use **`/implementar`** para abrir o formulário de implementação. O formulário aceita várias linhas e até **4000 caracteres**, um select opcional de plano aprovado e upload de até 3 imagens e 3 áudios.

- Para uma implementação nova, deixe o select de plano vazio.
- Para implementar um plano aprovado, escolha o plano no select. O prompt vira um complemento opcional.
- Se não houver plano nem anexo, o prompt precisa ter pelo menos 1 caractere.

**Mensagens normais no chat são ignoradas.** O bot só cria jobs por slash command.

A partir daí o fluxo é automático.

## Imagens e áudios nos prompts

Você pode enviar no formulário até **3 imagens** (PNG, JPEG, GIF ou WebP) de até **8 MB** cada e até **3 áudios** (MP3, WAV, OGG/OPUS, M4A/AAC, FLAC ou WebM) de até **10 MB** cada. No `/implementar`, o texto é opcional quando há imagem/áudio ou um plano selecionado. No `/planejar`, o texto é obrigatório; imagem/áudio são complementos.

- O bot baixa os anexos para `bot/data/assets/message-<id>/` e guarda os metadados no SQLite.
- O worker copia as imagens para `.job-assets/` dentro do clone; a primeira imagem é anexada com `--file` e o agente lê as demais com a ferramenta `read`.
- Os áudios são copiados pelo worker para `public/audio/job-<id>-<arquivo>` antes do agente. O agente referencia a URL pública (ex.: `/audio/job-23-audio-1.mp3`) e não precisa copiar binários.
- Jobs com imagem usam automaticamente `AGENT_VISION_MODEL`, porque modelos text-only rejeitam imagens.
- **Referência visual** (mockup, print, estilo): o agente usa a imagem de `.job-assets/` como guia; ela não entra no commit.
- **Asset do jogo** (sprite, ícone, fundo, textura, música, efeito sonoro): áudios já são preparados em `public/audio/` e entram no commit; imagens em `.job-assets/` não entram — use-as como referência ou recrie o asset em texto/SVG.
- **Áudio como referência falada:** o modelo não ouve/transcreve áudio. Escreva no prompt o conteúdo ou a instrução; o arquivo fica disponível em `public/audio/` para uso como asset.
- `.job-assets/` é excluído do git e apagado depois do job. Áudios em `public/audio/` são commitados: envie apenas conteúdo que você tenha direito de publicar.
- As pastas em `bot/data/assets/` são removidas após `IMAGE_RETENTION_DAYS` dias; depois disso, `/reprocessar` pede que você reenvie os anexos.

## Planejamento (`/planejar`)

Use **`/planejar`** para abrir o formulário e gerar um plano antes de implementar. O formulário aceita várias linhas e até **4000 caracteres**. O worker roda um agente planejador somente leitura, que produz dois artefatos:

- **`PLAN.md`** — objetivo, escopo, arquivos afetados, passos, riscos e critérios de aceite;
- **`TASKS.md`** — checklist acionável para o implementador.

Os dois arquivos são anexados na mensagem do plano, que traz os botões **Aprovar** e **Rejeitar**:

- **Aprovar**: o plano fica disponível no select do `/implementar`;
- **Rejeitar**: o plano é arquivado; use `/planejar` de novo se quiser outra abordagem.

O planejador não altera o código: a única escrita permitida é em `.plan-artifacts/`. Planejamentos têm limites próprios (padrão: 10/dia, 1 ativo por usuário, fila de 10) e **não consomem** a quota de 50 implementações/dia.

## Comandos

| Comando | Quem | O que faz |
|---|---|---|
| `/implementar` | membros com quota | abre o formulário com select de plano aprovado, prompt e uploads de imagem/áudio |
| `/planejar` | membros com quota | abre o formulário com prompt e uploads e gera `PLAN.md`/`TASKS.md` para aprovação |
| `/fila` | todos | estado da fila (ativa/pausada), worker e repo local; pausar/retomar para quem gerencia o servidor |
| `/minhas-implementacoes` | todos | suas implementações, com preview do prompt |
| `/ultimas-implementacoes` | todos | últimas do servidor, com autor e preview do prompt |
| `/prompt <id>` | todos | mostra o prompt completo de uma implementação |
| `/reprocessar <id>` | autor ou `Manage Server` | recoloca uma falha na fila |

O título exibido é derivado da primeira linha do prompt; não há campo separado de título. As listagens mostram um preview do prompt; use `/prompt <id>` para ver o texto completo.

## Quotas padrão

- Conta com pelo menos 7 dias.
- 1 job ativo por usuário.
- 50 jobs por dia por usuário; 50 no total.
- Fila máxima de 20.
- Formulário de prompt: até 4000 caracteres. Não há mínimo além de 1 caractere; vazio só é permitido no `/implementar` com plano selecionado ou imagem/áudio.
- O select de planos do `/implementar` mostra até 25 planos aprovados.
- Planejamentos: 10 por dia, 1 ativo por usuário e fila de 10 (não contam nos 50 jobs).

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
3. Copia as imagens do job para `.job-assets/` (fora do git), prepara os áudios em `public/audio/` e escolhe o modelo de visão quando houver imagem.
4. Roda o OpenCode com `HOME`, banco e `PWD` isolados (não herda config global, MCPs nem modelo).
5. Roda `npm run build` e depois `npm run lint`.
6. Commita e envia a branch `implementacao/<id>` para o origin.
7. Se o diff estiver dentro dos limites, busca `origin/master` de novo: se a master avançou durante o job, faz rebase mantendo as alterações do job (conflitos são resolvidos a favor do job), roda o gate outra vez e, se a master tiver mudado dependências, roda `npm ci`.
8. Envia `HEAD:master` com `--force-with-lease`. Se alguém empurrar entre o fetch e o push, reintegra e tenta de novo (até 3 vezes); nunca sobrescreve um commit que não viu.
9. Remove o clone. A branch permanece no origin para inspeção.

Diff acima de 20 arquivos/800 linhas, arquivos removidos ou caminhos protegidos fazem o job falhar sem push na master — a branch continua no origin. Se o push da master falhar depois das tentativas, ou se o rebuild pós-rebase quebrar, o job falha e a branch também fica no origin. Se a própria master já falhava no gate antes do job, a mensagem aponta o log da master em vez de culpar o job.

### Planejamento

1. Clona `origin/master` em `../.2d-survivor-worktrees/plan-<id>` (sem branch).
2. Copia `bot/agent/planner.json` para um `HOME` isolado e roda o agente `planner` somente leitura.
3. Lê `.plan-artifacts/PLAN.md` e `.plan-artifacts/TASKS.md`.
4. Salva os artefatos em `bot/data/plans/plan-<id>/` e no SQLite.
5. Publica a mensagem com os dois anexos e os botões **Aprovar**/**Rejeitar**.
6. Remove o clone. Planejamento não faz commit nem push.

## Segurança

O worker roda o OpenCode com um `HOME` próprio por job:

- só `auth.json` e a config do agente são copiados; config global, MCPs, skills e aprovações não são herdados;
- leitura de `.env`, `.ssh`, `.aws`, `.config`, `.npmrc` e do auth é negada;
- o agente não pode editar `bot/`, `.github/`, `AGENTS.md`, manifests/lockfiles ou configs;
- o agente não roda `git commit/push/checkout/reset`, `rm`, `sudo`, `curl`, `wget`, `ssh` nem instala dependências;
- o planejador usa uma config separada (`agent/planner.json`), só lê o repositório e só pode escrever em `.plan-artifacts/`;
- o gate roda com outro `HOME` vazio e sem chaves de provedor;
- o agente nunca edita o seu checkout local; ele trabalha no clone.

**Risco residual:** sem Docker, o shell do agente roda com o seu usuário. As permissões são defesa em profundidade, não uma jaula de kernel.

## Operação

- O worker precisa de `origin` acessível; se o push falhar, veja `/fila` e os logs.
- Só pode existir **um worker** por bancada. Ele grava `bot/data/worker.lock` com o pid; um segundo worker recusa iniciar e um lock de processo morto é assumido automaticamente.
- `/fila` mostra se a fila está **Ativa** ou **Pausada**; quem tem `Gerenciar Servidor` pode pausar/retomar pelos botões. Pausada, o worker termina o job atual e não pega novos (jobs e planos).
- O checkout local pode ficar sujo; isso não bloqueia.
- Se quiser incluir WIP, commite e faça push antes de enviar o prompt.
- O worker faz push para `origin`/`master` depois de cada job, integrando com o que já estiver publicado.
- Depois de um job que mudou `package-lock.json` na master, rode `npm install` na raiz para o `node_modules` compartilhado ficar em dia.
- Os commits do worker usam `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`. Mantenha o e-mail verificado no GitHub; o padrão é o noreply `6431486+victoprincipe@users.noreply.github.com`.
- Para inspecionar: `npm run db:status`; logs em `bot/data/logs/`.
- Reinicie o worker depois de mudar `.env` ou `bot/agent/opencode.json`.

## Estrutura

```
bot/
  agent/opencode.json      # config restritiva do implementador
  agent/planner.json       # config somente leitura do planejador
  src/
    index.ts               # bot discord.js
    deploy-commands.ts     # registro dos slash commands
    commands/              # implementar, planejar, fila, minhas, ultimas, prompt, reprocessar
    events/                # interactionCreate
    handlers/              # modal de implementação/planejamento
    services/              # quotas, moderação, permissões, notificações
    ui/                    # embeds
    worker/                # loop, opencode, planner, gate, apply, assets, lock, review
    scripts/               # db-init, db:status, check:commands
  data/                    # SQLite, logs, homes do agente, assets, plans (gitignored)
```

## Troubleshooting

- **`Variáveis ausentes no bot/.env`**: preencha token e canal.
- **Bot não responde**: rode `npm run deploy`; confira `applications.commands`.
- **`auth.json do OpenCode não encontrado`**: rode `opencode auth login` e reinicie o worker.
- **Comandos não aparecem**: rode `npm run deploy` e confira `GUILD_ID`; o bot precisa do escopo `applications.commands`.
- **Erro genérico em interação**: veja o stack trace em `bot/data/logs/bot-errors.log`.
- **Formulário expirou**: o modal do Discord vale por 15 minutos. Rode o comando novamente; os dados vão na submissão do modal, então um restart do bot não os perde.
- **Imagem/áudio rejeitado**: confira formato, tamanho e quantidade nas descrições dos campos do modal.
- **Job com imagem falha no modelo**: confira `AGENT_VISION_MODEL` (`opencode models`); modelos text-only não aceitam imagem.
- **Plano falhou**: veja `bot/data/logs/plan-<id>-planner.log` e o erro na mensagem do plano. Ajuste `AGENT_PLANNER_MODEL` se o modelo não estiver gerando os artefatos.
- **Build falha em todo job**: rode `npm run build` na raiz. Se for só lint antigo, use `LINT_STRICT=false`.
- **Push falha**: confira `git remote -v`, `gh auth status` e `gh auth setup-git`.
- **Modelo fraco**: ajuste `AGENT_MODEL` (`opencode models`).
