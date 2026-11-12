# Otimizações implementadas — 12/11/2026

As otimizações estão implementadas no checkout local. Os cenários selecionados mostraram ganho, especialmente na floresta, mas os perfis severos de CPU continuam abaixo de 60 FPS. Não há promessa de 60 FPS em todos os aparelhos.

## Alterações

- **Colisão com árvores:** índice espacial estático de troncos e árvores decorativas, usando o mesmo teste exato de colisão. A geração do mapa mantém as varreduras enquanto as árvores estão sendo criadas. Predadores com raio muito grande voltam à varredura finita para não percorrer milhões de células vazias.
- **Terreno:** limites conservadores descartam lagos e bocas de rio distantes antes dos cálculos detalhados. O teste completo de navegabilidade da lama da foz só ocorre perto de uma foz. A classificação de água na posição final de um inimigo é reutilizada para a caminhada e as ondulações.
- **Separação:** percorre as mesmas células/entidades, na mesma ordem, sem criar um array de vizinhos por inimigo por frame.
- **Rio:** os 13 contornos estáticos de água e margem são guardados em Path2D, mantendo os pontos e a ordem de pintura. Enchente e superfícies animadas continuam atualizadas.
- **Copas:** métricas fixas são reutilizadas; a lista de copas transparentes calculada na primeira passagem também serve à passagem de primeiro plano.
- **Efeitos cosméticos:** no máximo 512 partículas e 160 números simultâneos. Hits próximos, em células de 32 pixels e janelas de 100 ms, somam seus valores visuais. Críticos e curas ficam em grupos separados. Dano, vida, projéteis, colisão e avisos de ataque não são descartados.
- **Texto de dano:** desenho reutilizado por texto/cor/fonte/DPR, com LRU de até 256 imagens e orçamento de 2 MiB RGBA. Os números mantêm fonte, contorno e linha de base.
- **Minimapa:** painel em buffer atualizado a 12 Hz e copiado no restante dos frames. Redimensionamento, mudança de DPR e teleporte invalidam o cache; os marcadores podem ter até cerca de 83 ms de atraso. O combate principal mantém sua atualização normal.
- **Pausa:** cena congelada redesenhada a até 15 Hz, para manter resize e comandos de desenvolvimento responsivos sem pintar a floresta a cada RAF atrás dos modais.
- **React/DevTools:** callback e props estáveis, componente memoizado. Atualizações do HUD deixam de reiniciar o efeito de telemetria e redesenhar o painel fechado continuamente; a leitura periódica e seus indicadores são mantidos.

Uma tentativa adicional de cache de poses dos monstros foi excluída porque regrediu o desempenho da planície. O desenho e a animação das criaturas permanecem no caminho original.

## Comparação de produção

Mesma máquina, build de produção, seed, resolução, fixtures e duração da bateria anterior. Cada linha é uma amostra, não uma média estatística de várias repetições; diferenças pequenas podem ser ruído. Caps cosméticos também alteram o consumo de aleatoriedade dos efeitos, então não há equivalência exata de todas as trajetórias posteriores.

| Cenário | FPS antes | FPS depois | Variação observada | Frame P99 antes → depois, ms |
| --- | ---: | ---: | ---: | ---: |
| forest-420-cpu1 | 51,4 | 63,6 | 23,8% | 27,9 → 27,8 |
| forest-420-cpu4 | 14,8 | 19,9 | 34,8% | 97,3 → 76,5 |
| plain-420-cpu1 | 75,1 | 78,6 | 4,7% | 21,0 → 20,9 |
| plain-420-cpu4 | 13,6 | 14,3 | 5,2% | 131,9 → 104,1 |
| forest-420-cpu6 | 8,4 | 12,4 | 48,0% | 173,7 → 125,1 |
| forest-mobile-cpu6 | 14,0 | 19,6 | 40,2% | 111,1 → 76,4 |
| forest-software-renderer | 23,9 | 26,7 | 11,5% | 62,6 → 55,6 |
| weapon-catalog | 23,6 | 37,3 | 57,9% | 138,9 → 55,6 |
| arsenal-native-forest | 48,7 | 66,0 | 35,5% | 34,8 → 27,8 |
| arsenal-native-plain | 45,7 | 56,1 | 22,7% | 34,8 → 27,9 |
| arsenal-diagnostic-forest | 12,6 | 19,2 | 53,0% | 125,0 → 83,4 |
| arsenal-diagnostic-plain | 8,5 | 9,2 | 7,9% | 152,9 → 132,0 |
| soak-forest | 36,6 | 49,9 | 36,4% | 48,6 → 34,8 |

CPU1 é a CPU nativa; CPU4/CPU6 são limites pedidos por CDP. O caso de software usa SwiftShader e desativa aceleração de Canvas 2D. Isso simula restrições, não um dispositivo físico específico. Nenhuma configuração de qualidade foi adicionada para reduzir o número de inimigos ou alterar o equilíbrio do jogo.

O catálogo percorreu novamente as 34 armas nas formas máximas/evoluídas (68 combinações). O pico de VFX passou de 10.620 para 672. Todos os 13 cenários finais terminaram sem exceções de página, respostas HTTP de erro ou pausa inesperada.

## Sessão contínua

O soak da floresta manteve o diretor de ondas real por aproximadamente dois minutos, com recompensas resolvidas automaticamente: 49,9 FPS médios, P95 27,8 ms, P99 34,8 ms, pico de 208 inimigos e 395 VFX. Heap após coleta: 9,2 → 10,0 MiB.

Essa amostra não prova ausência de vazamento por horas. A memória de Canvas/GPU não está toda no heap JavaScript. O crescimento de entidades/cache e os contadores precisam ser considerados ao comparar retenção.

## Validação

- Build de produção, TypeScript sem emissão e ESLint passaram. O lint mantém um aviso preexistente em WeaponSystem.ts.
- Mais de 14 mil consultas de colisão e mil resoluções completas de movimento comparadas com varreduras integrais, incluindo raios grandes. Resultado idêntico.
- Geometria de água/lama da foz validada contra a formulação integral, incluindo insets positivos/negativos; separação idêntica à soma anterior.
- Testes de limite de partículas/números, somas, críticos, curas, expiração e limpeza.
- 74 comparações de pixels do rio e texto em DPR 1/2. Maior diferença média por canal RGBA: 0,0354 na escala de 0 a 255.
- Cache de texto dentro do orçamento; minimapa reutiliza/atualiza em teleporte; pausa congela relógio e respeita limite de desenho; resize e retomada funcionam.
- Os dois scripts funcionais antigos continuam com as divergências registradas em [resultados-desempenho.md](./resultados-desempenho.md); não foram alterados para mascarar falhas.

Novas verificações: [check-performance-optimizations.mjs](../scripts/check-performance-optimizations.mjs) e [check-performance-rendering.mjs](../scripts/check-performance-rendering.mjs). O teste de renderização usa a mesma instalação de Playwright e servidor de produção descritos em [como-testar-desempenho.md](./como-testar-desempenho.md).

```powershell
node scripts/check-performance-optimizations.mjs
node scripts/check-performance-rendering.mjs
# Com o servidor de produção ativo; use um novo arquivo para uma coleta nova.
node scripts/profile-performance.mjs --output docs/minha-comparacao.json --only '^forest-420-cpu4$'
```

Dados antes: [performance-expanded.json](./performance-expanded.json). Dados depois, hashes dos arquivos e configuração de cada amostra: [performance-after.json](./performance-after.json). As otimizações não foram publicadas nem commitadas nesta tarefa.
