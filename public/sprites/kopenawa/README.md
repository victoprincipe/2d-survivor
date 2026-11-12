# Kopenawa — animações de combate

Arte derivada de `quiz-keeper/idle.png`, com fundo transparente. O NPC fora
do combate continua usando essa imagem; chefe e clones compartilham os atlas.

`animations.json` define retângulos de origem em pixels, apoio dos pés
(`anchorX`, `anchorY`) e escala para manter a figura próxima das 108 unidades
do desenho original. As margens de cada célula não contam como altura do corpo.

- `walk.png`: 8 quadros; um ciclo por 56 unidades realmente percorridas.
- `cast.png`: 6 quadros; preparação do sopro em 0,7 s ou ataque ilusório em 0,45 s.
- `channel.png`: 6 quadros; ciclo de 0,45 s durante os 0,9 s de sopro ativo.
- `slam.png`: 6 quadros; os quatro primeiros preparam por 0,6 s, o quinto
  coincide com o impacto e o sexto conclui os 0,35 s de recuperação.

Os eventos de combate pertencem à simulação, nunca ao renderizador. Pausar
congela as poses; falha ou atraso no carregamento usa a imagem original.

Verificação: `node scripts/check-kopenawa.mjs`.
