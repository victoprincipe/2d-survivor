# Avaliação de desempenho — 12/11/2026

Esta é a avaliação inicial, com amostras curtas. A bateria ampliada posterior, incluindo CPU limitada, chefes, catálogo de armas e sessões contínuas, está em [resultados-desempenho.md](./resultados-desempenho.md).

O jogo já tem boas proteções, mas a floresta acumula custo de cenário, consultas de terreno e colisões. A média de FPS sozinha esconde frames lentos. A prioridade é medir e reduzir esses picos antes de mudar a tecnologia de renderização ou reduzir a quantidade de inimigos.

Esta avaliação não altera a lógica nem a qualidade visual do jogo. Os números são uma amostra local, não uma garantia de desempenho em outros aparelhos.

## Método

- Build de produção servido em `localhost:3010`, Microsoft Edge headless, viewport de 1280 × 720 CSS pixels.
- Renderizador WebGL informado pelo navegador: ANGLE / NVIDIA GeForce RTX 4070 Ti / D3D11. Isso identifica o ambiente; não mede o tempo de GPU do Canvas 2D.
- 2 segundos de aquecimento após instrumentação e 6 segundos de coleta por cenário.
- Mapa e aleatoriedade fixados com gerador LCG, seed 123456789. O mapa da floresta gerou 2.412 árvores regulares.
- Derson com arma inicial, som desligado, jogador parado e invulnerável. Spawns regulares congelados. 420 zumbis de teste com HP alto, sem recuo, distribuídos numa área de raio até 320 pixels. Primeiro parados; depois com velocidade 35. Não representa uma partida completa nem a mistura normal da fauna.
- DPR 1: Canvas de 1280 × 720. DPR 2: 2560 × 1440, quatro vezes mais pixels.
- Tempos de métodos coletados por `performance.now()`. Intervalos de frames coletados por outro RAF no mesmo navegador. A instrumentação introduz custo; tempos de métodos representam execução JavaScript e submissão ao Canvas, não todo o trabalho posterior de rasterização/composição.
- Amostras curtas, sem repetição estatística suficiente para estimar desempenho de longa duração. Os subtempos são inclusivos e não devem ser somados ao total que já os contém.

Dados completos: [performance-baseline.json](./performance-baseline.json). Harness local usado na avaliação: `C:/Temp/2d-survivor-perf-seeded.cjs` e variante `C:/Temp/2d-survivor-perf-moving.cjs`; usam o Playwright já disponível no ambiente, sem instalar dependências no projeto.

## Resultados controlados

| Cenário | FPS médio | Frame P95 | Frame P99 | Lógica média | Render média |
| --- | ---: | ---: | ---: | ---: | ---: |
| Floresta, sem monstros, DPR 1 | 140,0 | 7,0 ms | 13,9 ms | 0,06 ms | 2,42 ms |
| Floresta, 420 parados, DPR 1 | 112,4 | 13,9 ms | 20,8 ms | 2,31 ms | 3,72 ms |
| Planície, 420 parados, DPR 1 | 110,2 | 14,0 ms | 20,8 ms | 0,63 ms | 1,50 ms |
| Floresta, 420 parados, DPR 2 | 105,3 | 13,9 ms | 14,1 ms | 2,37 ms | 3,86 ms |
| Floresta, 420 em movimento, DPR 1 | 81,7 | 20,8 ms | 21,0 ms | 5,34 ms | 4,26 ms |

P95 significa que 95% dos intervalos medidos ficaram nesse valor ou abaixo. Para 60 FPS, o orçamento é 16,67 ms; para 120 FPS, 8,33 ms. A cena em movimento teve quatro intervalos acima de 25 ms, apesar da média de 81,7 FPS. Não houve erros de página nos cenários medidos.

Nos primeiros ensaios sem seed fixa, a floresta com 420 monstros variou de aproximadamente 47 a 76 FPS em DPR 1 e de 28 a 44 FPS em DPR 2. Esses ensaios tinham mapas diferentes e parte da instrumentação também diferia. Não permitem atribuir a queda isoladamente ao DPR. No ensaio controlado, a diferença entre DPR 1 e 2 foi muito menor. Variação de cenário precisa fazer parte dos testes futuros.

## Prioridades

### 1. Consultas espaciais e terreno na floresta

**Evidência:** lógica média de 2,31 ms com monstros parados e 5,34 ms com movimento. O código de `WorldProps.collidesWithDecorTree` percorre a lista inteira de árvores decorativas. `resolveLandMovement` pode consultá-la na origem e novamente por eixo e subpasso. `isWaterSurface` e `isMud` recalculam geometria de rios e lagos; o loop de inimigos consulta água mais de uma vez para a mesma posição.

**Melhoria:** índice espacial estático para troncos/obstáculos; consultar só as células alcançadas pelo raio e deslocamento. Calcular classificações de terreno uma vez por posição/fase do movimento, invalidando depois de deslocamentos e mudanças na enchente. Pré-calcular seno/cosseno e limites estáticos dos lagos. Reutilizar a grade para busca de presas onde for apropriado.

**Cuidado:** manter raios, subpassos, deslizamento, fuga de troncos e regras da água. O teste não isolou o custo de cada função de colisão; a atribuição individual ainda precisa de profiling.

### 2. Cenário estático e rio

**Evidência:** na floresta com 420 parados, `renderFloor` consumiu 1,08 ms em média por frame, contra 0,02 ms na planície. `renderAmazonWater` reconstrói listas e contornos do rio ao longo do mapa, apesar do recorte visual. O recorte do Canvas não elimina o trabalho JavaScript de construir os caminhos.

**Melhoria:** armazenar geometria estática em `Path2D`; separar margens/leito/rochas de ondas animadas; desenhar somente trechos ou blocos visíveis. Usar cache por blocos com orçamento de memória, em vez de criar uma imagem única do mapa inteiro. Indexar os elementos decorativos por região para reduzir também o custo de procurar o que está visível.

**Cuidado:** enchentes, paredes de arenas e terreno dinâmico precisam invalidar os blocos afetados. Há caches existentes de chão e árvores: expandir o que existe em vez de duplicar o sistema.

### 3. Minimap e copas

**Evidência:** minimapa de 0,38–0,40 ms/frame nos cenários densos da floresta; ele redesenha a paisagem a cada RAF. Copas consultam entidades em duas passagens, uma no cenário e outra no primeiro plano.

**Melhoria:** guardar o fundo estático do minimapa, redesenhar marcadores a 10–15 Hz e invalidar o fundo por movimento/alteração relevante. Calcular uma única lista de árvores visíveis e quais precisam de transparência; compartilhar esse resultado entre as duas passagens. Consultar entidades próximas da copa por grade espacial.

**Cuidado:** não atrasar indicadores de ataques. A economia do minimapa é modesta isoladamente, mas recorrente.

### 4. Resolução e efeitos com orçamento explícito

**Evidência:** `handleResize` aceita DPR até 2 automaticamente. VFX têm tempo de vida e compactação, mas não um teto global de partículas/números de dano. Armas criam e removem objetos e arrays temporários durante o combate.

**Melhoria:** oferecer resolução interna/qualidade configurável e, se necessário, escala adaptativa com janela de medição e histerese. Manter HUD React nítido. Definir limites apenas para cosméticos: partículas, brilhos e números de dano; agrupar números repetidos. Nunca descartar projéteis, colisões ou avisos de ataque para cumprir orçamento visual.

**Estado da evidência:** risco identificado no código; tempestades de partículas, arsenal máximo e aparelhos fracos não foram medidos. Não há base para prometer ganho específico com pooling ou com redução de DPR. A cena fixa não apresentou falhas de cache de árvores após o aquecimento; não há evidência de thrashing nela.

### 5. Medição contínua de estabilidade

**Evidência:** o FPS atual é atualizado em janela de cerca de 400 ms; `frameTimeMs` mostra o último intervalo, sem separar lógica/render ou manter percentis. O jogo continua renderizando durante pausa. O DevTools continua coletando e atualizando telemetria quando fechado.

**Melhoria:** amostragem leve com buffer circular para P50/P95/P99, frames acima de 16,67/33,33 ms, tempos de update/render e contadores de entidades/efeitos. Desligar a coleta detalhada do DevTools fechado. Reduzir redesenho durante pausa quando não houver animação necessária. Avaliar limite opcional de FPS para telas de alta frequência, sem confundir limitar a 60 com corrigir frames lentos.

## O que já está bem encaminhado

- Canvas opaco com `{ alpha: false }`.
- Grade espacial para combate e separação.
- Verificações de visibilidade em inimigos, efeitos e vários objetos do cenário.
- Cache LRU de árvores com limite de 16 MiB, padrão de chão e outras geometrias reaproveitadas.
- HUD com atualização reduzida e compactação dos arrays de VFX.
- Limite de 420 para os spawns regulares. É um limite do diretor de ondas, não necessariamente de todas as invocações possíveis.

## Validação antes de considerar otimizado

1. Criar uma sequência repetível de pelo menos 60 segundos, com várias seeds: câmera em movimento, rios, margens, floresta densa e áreas abertas; 100/250/420 inimigos.
2. Incluir todos os chefes, enchente, noite, armas no máximo, muitas mortes/drops e projéteis. Nada disso foi coberto integralmente pelas amostras atuais.
3. Repetir em janela visível e em hardware de entrada, integrado e celular, além de DPR 1/1,5/2. Registrar CPU, navegador, memória, viewport e energia.
4. Para uma meta inicial de 60 FPS, buscar P95 até 16,67 ms e P99 próximo desse orçamento; investigar separadamente picos acima de 33,33 ms. Reservar margem para navegador, composição e áudio.
5. Aplicar uma família de otimizações por vez e comparar a mesma seed, trajeto, carga e duração. Preservar os critérios de colisão, dano, arenas, transparência e progressão.

Ordem sugerida: instrumentação leve → consultas espaciais/terreno → cache e recorte do cenário → minimapa/copas → qualidade configurável e orçamento de cosméticos. Não há evidência suficiente para justificar uma migração imediata para WebGL ou uma reescrita do motor.
