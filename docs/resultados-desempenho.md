# Resultados ampliados de desempenho — 12/11/2026

Esta bateria registra o desempenho anterior às alterações. As melhorias já implementadas e a comparação posterior estão em [otimizacoes-desempenho.md](./otimizacoes-desempenho.md).

A meta de 60 FPS estáveis **não foi atingida nos cenários densos**, inclusive em parte dos testes sem limitação de CPU. O perfil CDP 4× fica muito abaixo da meta. Há custo relevante tanto de lógica da floresta quanto de desenho, efeitos e texto; reduzir só a resolução não resolveu a carga densa.

Foram concluídos 43 cenários: 42 amostras comparáveis e uma janela sujeita a oclusão, mantida como evidência e excluída da comparação. As amostras comparáveis somam aproximadamente 20,8 minutos de coleta, além de inicialização/aquecimento. Há 0 erros de página/respostas HTTP de erro nessas amostras. Os scripts funcionais existentes não estão verdes; ver as divergências abaixo.

## Ambiente e reprodução

- Build de produção do commit `c9e78478829fd14890e743b8377c763414b4f043`; não houve mudança no código do jogo nesta bateria.
- AMD Ryzen 5 5600 6-Core Processor, 12 CPUs lógicas, 23.9 GiB informados pelo sistema; GPU reportada pelo navegador: RTX 4070 Ti / ANGLE D3D11. Navegador e dimensões exatos estão em cada caso do JSON.
- Perfis: CPU nativa, CDP 4× e 6×; backend SwiftShader com aceleração de Canvas 2D desativada; DPR 1/2; viewport 1280 × 720 e estreito 390 × 844; headless e janela visível controlada.
- CPU limitada não equivale a um modelo físico específico. SwiftShader é estresse por software, não emulação fiel de GPU integrada. RAM física não foi limitada.
- Cada caso usa processo novo e contexto temporário, seed fixa, áudio desligado e jogador invulnerável. A carga sintética fixa HP alto, desativa recuo e evita menus. O catálogo é percorrido em grupos de até quatro armas, não com todas equipadas simultaneamente. Os soaks mantêm o diretor de ondas real ativo.
- Escolhas de upgrade e baú são resolvidas automaticamente. Quatro amostras anteriores, que pararam em telas legítimas de recompensa, foram descartadas e repetidas. Estão preservadas em `invalidTrials`.
- Intervalos de RAF não medem diretamente apresentação física na tela. Tempos de métodos incluem JavaScript e submissão de comandos, não toda a rasterização/composição. Não somar subtempos ao total que já os contém.
- Os ensaios são finitos, com carga definida. Não cobrem todas as combinações de equipamento nem substituem ensaios prolongados em celulares e PCs físicos de entrada.

Procedimento e limites: [como-testar-desempenho.md](./como-testar-desempenho.md). Harness: [profile-performance.mjs](../scripts/profile-performance.mjs). Dados completos, contadores, estados, janelas e heap: [performance-expanded.json](./performance-expanded.json).

## Tabela completa

Referência: 60 FPS correspondem a 16,67 ms/frame. A classificação abaixo verifica P95 e P99 até 16,8 ms, tolerando arredondamento; não é certificação de ausência de qualquer pico. Mesmo uma média alta pode ter percentis fora desse orçamento.

| Cenário | CPU CDP | FPS médio | P95 ms | P99 ms | Referência 60 FPS |
| --- | ---: | ---: | ---: | ---: | --- |
| forest-100-cpu1 | 1× | 123,6 | 13,9 | 14,0 | Dentro nos percentis |
| forest-250-cpu1 | 1× | 76,4 | 20,9 | 20,9 | Fora do orçamento |
| forest-420-cpu1 | 1× | 51,4 | 27,8 | 27,9 | Fora do orçamento |
| forest-100-cpu4 | 4× | 37,3 | 34,9 | 55,6 | Fora do orçamento |
| forest-250-cpu4 | 4× | 20,2 | 62,6 | 76,4 | Fora do orçamento |
| forest-420-cpu4 | 4× | 14,8 | 83,3 | 97,3 | Fora do orçamento |
| plain-100-cpu1 | 1× | 127,3 | 13,9 | 14,0 | Dentro nos percentis |
| plain-420-cpu1 | 1× | 75,1 | 20,8 | 21,0 | Fora do orçamento |
| plain-100-cpu4 | 4× | 25,6 | 41,8 | 48,7 | Fora do orçamento |
| plain-250-cpu4 | 4× | 17,7 | 69,5 | 97,2 | Fora do orçamento |
| plain-420-cpu4 | 4× | 13,6 | 90,4 | 131,9 | Fora do orçamento |
| forest-420-cpu6 | 6× | 8,4 | 152,8 | 173,7 | Fora do orçamento |
| forest-420-seed42 | 4× | 14,6 | 90,3 | 104,3 | Fora do orçamento |
| forest-420-seed987654321 | 4× | 15,1 | 83,3 | 104,1 | Fora do orçamento |
| guardian-anaconda | 4× | 84,8 | 20,8 | 27,7 | Fora do orçamento |
| guardian-gorilla | 4× | 64,0 | 20,9 | 34,7 | Fora do orçamento |
| guardian-kopenawa | 4× | 64,8 | 20,9 | 34,8 | Fora do orçamento |
| combo-fire | 4× | 24,9 | 62,4 | 69,5 | Fora do orçamento |
| combo-water | 4× | 33,7 | 41,7 | 55,5 | Fora do orçamento |
| combo-earth | 4× | 33,0 | 41,7 | 55,6 | Fora do orçamento |
| arsenal-forest | 4× | 12,7 | 97,2 | 118,0 | Fora do orçamento |
| arsenal-plain | 4× | 8,2 | 152,7 | 201,4 | Fora do orçamento |
| forest-route-day-night | 4× | 38,4 | 34,8 | 41,8 | Fora do orçamento |
| forest-drops-particles | 4× | 12,7 | 104,2 | 132,0 | Fora do orçamento |
| forest-dpr2 | 4× | 14,7 | 83,4 | 111,1 | Fora do orçamento |
| forest-mobile-cpu6 | 6× | 14,0 | 90,4 | 111,1 | Fora do orçamento |
| forest-software-renderer | 1× | 23,9 | 55,5 | 62,6 | Fora do orçamento |
| forest-visible-window | 4× | 3,1 | 1000,1 | 1055,5 | Excluir: oclusão |
| weapon-catalog | 4× | 23,6 | 76,4 | 138,9 | Fora do orçamento |
| cave-cpu4 | 4× | 143,4 | 7,1 | 7,1 | Dentro nos percentis |
| plain-250-cpu1 | 1× | 100,8 | 14,0 | 14,1 | Dentro nos percentis |
| forest-420-cpu4-light-probe | 4× | 14,4 | 90,3 | 111,1 | Fora do orçamento |
| combo-wind | 4× | 26,8 | 55,6 | 69,5 | Fora do orçamento |
| arsenal-native-forest | 1× | 48,7 | 27,9 | 34,8 | Fora do orçamento |
| arsenal-native-plain | 1× | 45,7 | 27,9 | 34,8 | Fora do orçamento |
| arsenal-diagnostic-forest | 4× | 12,6 | 104,2 | 125,0 | Fora do orçamento |
| arsenal-diagnostic-plain | 4× | 8,5 | 145,9 | 152,9 | Fora do orçamento |
| guardian-transitions | 4× | 71,2 | 20,9 | 27,8 | Fora do orçamento |
| earth-trample | 4× | 56,2 | 21,0 | 27,8 | Fora do orçamento |
| forest-visible-foreground | 4× | 16,1 | 76,4 | 90,3 | Fora do orçamento |
| plain-vampire | 4× | 23,0 | 55,6 | 69,5 | Fora do orçamento |
| soak-forest | 4× | 36,6 | 34,8 | 48,6 | Fora do orçamento |
| soak-plain | 4× | 23,1 | 48,7 | 62,4 | Fora do orçamento |

## Cobertura confirmada

- 14 tipos de chefe registrados durante a coleta: `boss_anaconda`, `boss_boitata`, `boss_boto`, `boss_caipora`, `boss_cobra_grande`, `boss_curupira`, `boss_gorilla`, `boss_iara`, `boss_kopenawa`, `boss_mapinguari`, `boss_matinta`, `boss_saci`, `boss_vampire`, `boss_vitoria_regia`.
- 34 armas e 68 combinações de nível/forma observadas. O pico do catálogo chegou a 10620 VFX, incluindo partículas e números de dano.
- Sucuri: mordida, mergulho ativo, retorno, golpe e ácido. Kopenawa: fumaça e clones. Entrada e impacto das arenas observados em `guardian-transitions`.
- Combo terrestre: preparação e avanço com `comboChargeActive` confirmado no teste `earth-trample`, com atordoamento induzido pela fixture.
- Quatro grupos elementais amazônicos, incluindo enchente e noite; vampiro; regiões/iluminação; caverna; drops e partículas; ondas reais; diferentes seeds e resoluções.
- Sonda leve: remove medições detalhadas e varredura diagnóstica de entidades. Resultado próximo do cenário denso instrumentado: a baixa taxa não desapareceu ao retirar essa coleta.

## Gargalos e prioridades após a bateria

1. **Lógica e terreno da floresta.** Com 420 inimigos, o custo médio de update foi cerca de 4,9 ms nativo e 24,3 ms em CPU 4× na fixture base. Indexar troncos/obstáculos por região e evitar consultas repetidas de água/lama continua prioritário. Ainda é preciso medir cada função de colisão para atribuir sua participação individual.
2. **Desenho de entidades e cenário.** Render médio na floresta densa base foi cerca de 7,0 ms nativo e 33,8 ms em CPU 4×. Rio/chão, árvores decorativas e minimapa têm trabalho repetido. Separar geometria estática, cachear caminhos/blocos e desenhar só regiões visíveis.
3. **Orçamento de efeitos e texto.** No diagnóstico de arsenal CPU 4×, VFX.render consumiu cerca de 5,4 ms/frame na floresta e 7,8 ms na planície, só na execução/submissão. O restante de renderização e a composição também pesam. Agregar números de dano, reduzir contorno/texto redundante, limitar cosméticos e reaproveitar desenhos. Não remover colisões, dano ou avisos de ataque para cumprir orçamento.
4. **Resolução não basta.** A floresta base de 420 em CPU 4× ficou perto de 15 FPS tanto em DPR 1 quanto em DPR 2. Qualidade configurável ajuda como ferramenta complementar; neste cenário o custo não desaparece com menos pixels.
5. **Tempo de jogo sob carga.** O limite de dt em 100 ms faz o relógio das ondas perder tempo real quando frames excedem esse valor. Exemplo: CPU 6×/420 avançou cerca de 17,1 s de ondas em 20,6 s reais. Na planície de arsenal CPU 4×, cerca de 24,8 s em 30,6 s reais. Não aumentar esse limite sem revisar colisões e cadência; avaliar política de passos e recuperação separadamente.

As prioridades são hipóteses de otimização apoiadas pelas medições e pelo código; a economia de cada mudança deve ser validada com a mesma fixture. Não há aqui um resultado de A/B de otimizações, pois nenhuma foi aplicada ao jogo.

## Sessões contínuas e memória

Ambas as sessões abaixo mantiveram o diretor de ondas real ativo, com upgrades/recompensas tratados pela automação. São duas amostras de aproximadamente dois minutos, não uma prova de estabilidade por horas. O heap final é medido após pausa, descarte dos buffers de profiling e coleta explícita.

| Sessão | FPS médio | P95/P99 ms | Heap antes/depois, MiB | Pico inimigos | Pico VFX |
| --- | ---: | ---: | ---: | ---: | ---: |
| soak-forest | 36,6 | 34,8 / 48,6 | 8,8 / 10,0 | 262 | 411 |
| soak-plain | 23,1 | 48,7 / 62,4 | 6,1 / 6,8 | 40 | 276 |

A série temporal completa está no JSON. Crescimento de heap também pode refletir cache, mais entidades e estado de combate. Não declarar vazamento ou ausência dele apenas por esses dois pontos. O heap JavaScript não inclui toda a memória de Canvas/GPU/processo. Resultados antigos sem `samplesReleasedBeforeFinalGC: true` não servem para comparar retenção exclusiva do jogo.

## Divergências funcionais existentes

- `node scripts/check-anaconda.mjs`: falha na linha 187. O teste espera callback de conversa por E e jogo pausado, mas a implementação atual inicia o duelo automaticamente por proximidade. O teste de integração precisa ser alinhado à mecânica atual antes de validar seu restante. Não foi alterado para esconder a falha.
- `node scripts/check-kopenawa.mjs`: falha na linha 53. A animação de cast começa com progresso 2/3. O timer foi dividido pelo multiplicador de velocidade 3, mas `visualPose` divide pela duração original. É uma inconsistência visual concreta a corrigir; não uma explicação para as quedas gerais de FPS. O script também contém expectativas antigas de clones e precisa de revisão contra a mecânica atual.
- Build de produção e TypeScript passaram. Lint passou sem erros, com um aviso preexistente de parâmetro não utilizado em WeaponSystem.ts.

Não houve alteração das mecânicas nem correção desses defeitos nesta tarefa. Foram adicionados o harness, os dados e a documentação para tornar a comparação das próximas otimizações repetível.
