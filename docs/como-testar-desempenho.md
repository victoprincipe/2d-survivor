# Bateria de desempenho reproduzível

O arquivo `scripts/profile-performance.mjs` executa cenários de produção em contextos novos de navegador. Precisa de uma instalação de Playwright disponível no ambiente, sem exigir alteração no manifesto do jogo.

```powershell
# Em um terminal: compile e sirva a versão que será avaliada.
node node_modules/next/dist/bin/next build
node node_modules/next/dist/bin/next start -p 3010

# Em outro terminal, indique uma instalação existente de Playwright se necessário.
$env:PLAYWRIGHT_MODULE = 'CAMINHO/para/node_modules/playwright'
node scripts/profile-performance.mjs --output docs/performance-expanded.json

# Seleção por expressão regular, por exemplo:
node scripts/profile-performance.mjs --only 'guardian-|combo-'
```

`PERF_URL` altera a origem de teste. Casos com resultado no JSON são pulados para permitir retomada; para repetir a mesma bateria, use outro caminho em `--output`. Há uma comparação que abre uma janela visível e depois a fecha; os outros casos usam Edge headless. Não execute baterias em paralelo: isso contamina a comparação de CPU/GPU.

## Cobertura

- Planície e floresta com 100, 250 e 420 inimigos mistos em movimento, CPU normal e limitação CDP 4×.
- Floresta com CPU 6× e duas seeds adicionais de mapa na carga de 420.
- Três guardiões opcionais: sucuri, gorila e Kopenawa, incluindo a fase de clones.
- Os quatro grupos elementais de chefes amazônicos e o vampiro da planície.
- Arsenais no máximo/evoluídos; teste separado passa pelo catálogo completo de armas em grupos, nas versões máximas e evoluídas.
- Mudanças de região e iluminação, enchente no grupo aquático, caverna, carga sintética de partículas/números de dano/drops.
- DPR 2, viewport estreito de 390 × 844 com CPU 6×, janela visível e backend de software com Canvas 2D acelerado desativado.
- Sessões com o diretor de ondas real ativo para observar evolução de carga e memória.
- Sonda leve para comparar a influência da instrumentação, medição separada de VFX, entradas das três arenas e atropelamento com atordoamento induzido.

## O que significa hardware mais fraco

`Emulation.setCPUThrottlingRate` pede ao navegador limitação de CPU 4×/6×. Não transforma o Ryzen da máquina em um modelo específico, não limita a RAM física e não emula instruções/cache de um celular. O backend de software é um cenário adicional de estresse; também não corresponde a uma placa integrada específica. Viewport estreito é teste de resolução/layout, não certificação em um telefone real.

## Isolamento e métricas

O harness usa armazenamento temporário por contexto, não o perfil pessoal do usuário. Fixa a seed, desliga áudio e torna o jogador invulnerável. Desativa ganho de XP para evitar parar em telas de escolha, e permite continuar após vitória. Nos cenários sintéticos, dá HP alto aos inimigos, elimina recuo e substitui o diretor de ondas por avanço simples do relógio. Os cenários `soak-*` mantêm o diretor de ondas real. O teste de rota muda regiões por teleporte e depois usa movimento normal; não mede uma caminhada contínua pelo mapa.

Os custos registrados de `update` e `render` medem JavaScript e submissão de comandos, não toda a rasterização/composição. O RAF observador registra intervalos; não prova que cada frame foi apresentado fisicamente na tela. São guardados percentis, máximos, quantidade de frames acima de aproximadamente 16,67/33,33/50 ms, tarefas longas, contagens máximas, estados de chefes, armas observadas, erros de execução e respostas HTTP de erro.

`waveClockDeltaSeconds` mede o avanço do relógio do diretor de ondas; ele fica parado durante duelos exclusivos e é ajustado artificialmente na fixture de regiões/iluminação. Não interpretar esse campo como tempo total de simulação em todos os casos. O harness rejeita pausas inesperadas, erros de execução, coordenadas não finitas de inimigos e cobertura incompleta das formas de armas no caso de catálogo. Falhas de execução retornam exit code diferente de zero; a meta de FPS é analisada separadamente.

CPU throttling é aplicado antes da navegação; após criar o cenário há 2,5 segundos de aquecimento. A amostra é subdividida em janelas de 5 segundos, com verificação de que o jogo ainda renderiza. Cada caso usa processo novo de navegador. O cenário de software usa `--disable-accelerated-2d-canvas`, `--use-angle=swiftshader` e `--enable-unsafe-swiftshader`; o renderizador informado é armazenado para conferência.

O heap é medido por CDP antes e depois, com coleta explícita. As versões recentes do harness descartam seus buffers antes da coleta final (`samplesReleasedBeforeFinalGC: true`). Não compare valores antigos sem essa marca como se fossem retenção exclusiva do jogo. Heap JavaScript não mede toda a memória da GPU, Canvas ou processo. Crescimento em uma amostra não comprova vazamento; os contadores e a série temporal precisam ser analisados em conjunto.

## Aprovação

Execução funcional e estabilidade de FPS são resultados separados. Um caso sem exceções pode reprovar a meta de FPS. Para uma meta inicial de 60 FPS, verificar P95 próximo de 16,67 ms, P99, proporção de frames lentos e ausência de janelas com renderização interrompida. Usar tolerância de arredondamento nos limiares (o JSON conta frames acima de 16,8 e 33,5 ms).

Não usar um resultado isolado para declarar suporte universal. Comparar a mesma seed, resolução, trajeto, carga e perfil, e repetir em dispositivos físicos antes de publicar uma configuração mínima de hardware.

Resultados desta bateria: [resultados-desempenho.md](./resultados-desempenho.md). O caso original de janela visível sofreu limitação de oclusão e foi excluído da comparação; a repetição `forest-visible-foreground` usa foco explícito e flags para desativar esse comportamento do navegador.
