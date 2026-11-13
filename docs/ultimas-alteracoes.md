# Últimas alterações do projeto

Este documento resume os commits de 12/11/2026 presentes na `master`, do mais novo para o mais antigo. Ele é descritivo: não altera o jogo nem substitui os documentos de desempenho, que trazem os números e as ressalvas completas.

## Desempenho da floresta e instrumentação — `aa29b68`

Commit: *Otimiza consultas espaciais e efeitos visuais e documenta desempenho*.

- **Colisão com cenário:** novo `StaticSpatialIndex` (`src/game/engine/StaticSpatialIndex.ts`) indexa troncos e árvores decorativas por células de 128 px. `WorldSystem` consulta só os candidatos próximos e mantém o teste exato de colisão. Raios muito grandes continuam usando a varredura completa para não percorrer milhões de células vazias.
- **Separação de inimigos:** `SpatialGrid.applySeparation` percorre as células diretamente, na mesma ordem de antes, sem criar um array de vizinhos por inimigo a cada frame.
- **Terreno:** lagos e bocas de rio distantes são descartados por limites conservadores antes dos cálculos detalhados; a classificação de água na posição final do inimigo é reaproveitada pela caminhada e pelas ondulações.
- **Cenário:** contornos estáticos de rio, margem e lama são guardados em `Path2D`; métricas de copas ficam em cache e a lista de copas em primeiro plano é calculada uma vez por frame.
- **Efeitos cosméticos:** teto de 512 partículas e 160 números de dano. Acertos próximos (células de 32 px, janela de 100 ms) somam o valor exibido. O texto é desenhado a partir de sprites em cache com limite LRU de 256 imagens / 2 MiB.
- **Minimapa e pausa:** o minimapa passa a ser desenhado em um buffer a 12 Hz; a cena pausada é redesenhada no máximo a 15 Hz. O `DevTools` foi memoizado e recebe callbacks estáveis para não reiniciar a telemetria a cada atualização da HUD.
- **Documentação e ferramentas:** entraram `docs/avaliacao-desempenho.md`, `docs/resultados-desempenho.md`, `docs/otimizacoes-desempenho.md`, `docs/como-testar-desempenho.md`, os JSONs de amostras e os scripts `profile-performance.mjs`, `check-performance-optimizations.mjs` e `check-performance-rendering.mjs`.

Os documentos registram ganhos, por exemplo, de 51,4 para 63,6 FPS na floresta com 420 inimigos em CPU nativa e de 14,8 para 19,9 FPS com CPU limitada 4×. Eles deixam claro que os cenários densos ainda ficam abaixo de 60 FPS e que os resultados são amostras, não uma garantia para todos os aparelhos.

## Fim do brilho ao acertar inimigos — `c9e7847`

Commit: *Remove brilho dos inimigos ao receber dano*.

`Enemy.takeDamage` deixou de ativar `hitFlashTimer`. Com isso, inimigos comuns e chefes não piscam mais em branco ao levar dano; vida, dano, recuo e demais regras de combate permanecem iguais.

## Lula: animações, retrato e Poder do L — `2a82c7a`

Commit: *Atualiza animacoes e retrato do Lula e ajusta Poder do L*.

- **Novo atlas:** `public/lula-animations-v2.png` (2048 × 1280, 8 colunas × 5 linhas) com caminhada, salto, ataque do L, parado e investida. A documentação de geração e alinhamento está em `docs/art/lula-spritesheet.md`.
- **Animação em camadas:** `Player` desenha pernas e tronco separadamente no ponto de corte `y=184`, permitindo que o gesto do L aconteça sem interromper a caminhada. O novo `movementSprite` cobre salto e investida; a caminhada acompanha a velocidade efetiva.
- **Retrato e interface:** novo `LulaPortrait.tsx` e ajustes em `CharacterHUD`, `StartScreen` e `globals.css`.
- **Poder do L:** o tempo de recarga caiu de 5 s para 3,15 s (2,52 s evoluído e 2,646 s no nível 5); o efeito é liberado 400 ms depois do início da animação de 800 ms, no quadro em que o L está formado. O mapa de armas iniciais da Amazônia voltou a associar Lula a `lula_power`.
- **Progressão por nível:** a partir do nível 2, Lula ganha +0,8% de dano e +0,8% de velocidade de ataque por nível, além de +0,4% de velocidade de movimento. Os bônus são lineares, sem composição, e aplicados em `WeaponSystem`.

## Kopenawa: animações, XP e rerrolagem — `10a80dc`

Commit: *Adiciona animacoes do Kopenawa e ajusta progressao e interface*.

- **Animações:** novo `KopenawaAnimation.ts`, que lê `public/sprites/kopenawa/animations.json` e compartilha os atlas entre o chefe e os clones. As poses `idle`, `walk`, `cast`, `channel` e `slam` são escolhidas pelos eventos de combate; a caminhada avança pela distância percorrida. O impacto da entrada na arena agora coincide com a pose do golpe.
- **Recompensas:** o XP passou a ser creditado diretamente ao matar inimigos comuns, elites e chefes, em vez de gerar gemas no chão. Chefes continuam deixando baú; elites amazônicos mantêm o bônus de moedas. O açaí, antes um ímã de XP, agora atrai moedas.
- **Rerrolagem de upgrades:** cada escolha de nível oferece até duas rerrolagens. O botão foi adicionado ao `LevelUpModal`, e `GameEngine.rerollLevelUp` tenta até oito vezes evitar repetir exatamente as mesmas opções. Níveis acumulados continuam sendo resolvidos em sequência.
- **Interface:** textos do ímã e do açaí foram atualizados para refletir a mudança de XP para moedas.

## Ajustes do chefe Kopenawa — jobs #155 e #156

- **Job #155 (`3af80f2`):** além das correções de compilação, tipagem e lint indicadas no título, adicionou o projétil espiritual de Kopenawa. No impacto, ele causa dano proporcional ao chefe e embaralha temporariamente um dos quatro comandos de movimento do jogador; a HUD mostra o ícone da confusão.
- **Job #156 (`0ba1d48`):** clones de fumaça passaram a herdar 70% dos atributos do chefe e a usar sopro e projétil espiritual; o chefe ataca três vezes mais rápido; clones voltaram a causar dano de contato. A arena de raízes, o spawn inicial e a liberação da caverna foram preservados.

## Bot: vigia de saúde — `0ac044c`

Commit: *bot: vigia de saúde e reinício automático no Termux*.

O bot ganhou `health.ts`, que grava `heartbeat.json` e encerra o processo quando o gateway fica sem `isReady()`, o ping fica inválido por tempo demais ou há erros repetidos em `bot-errors.log`; `last-exit.json` registra o motivo. `alerts.ts` avisa no Discord via `ALERT_WEBHOOK_URL` quando o processo volta após uma saída forçada. O worker também grava heartbeat e encerra após cinco falhas seguidas ao buscar jobs. As novas variáveis estão em `bot/.env.example`; a documentação operacional continua em `bot/README.md`.

## Como validar

- `npx tsc --noEmit`, `npm run build` e `npm run lint` para a raiz (o lint mantém um aviso preexistente em `WeaponSystem.ts`).
- Desempenho: siga `docs/como-testar-desempenho.md` e compare com `docs/resultados-desempenho.md` e `docs/otimizacoes-desempenho.md`.
- Kopenawa: `node scripts/check-kopenawa.mjs`. O script tem uma divergência visual conhecida, registrada em `docs/resultados-desempenho.md` (o progresso da pose de conjuração começa em 2/3 por causa do multiplicador de velocidade).
- Sucuri: `node scripts/check-anaconda.mjs` também tem uma divergência conhecida com o duelo automático por proximidade, descrita no mesmo documento.
- Bot: `cd bot && npm run check` e, em execução, acompanhar `bot/data/heartbeat.json`, `bot/data/worker-heartbeat.json` e `bot/data/last-exit.json`.
