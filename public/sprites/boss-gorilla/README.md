# Gorila — estudo de animação do chefe

Integrado à Floresta Amazônica em `(2100, -1900)`, no centro do platô nordeste, acessível pela rampa de terra. Inicialmente usa o ciclo de espera, sem movimento ou dano. A até 150 unidades, a tecla E abre a conversa. O jogo pausa durante o diálogo; encerrar ou Esc retorna à partida. **Iniciar combate** transforma o NPC em chefe com barra de vida, investida e golpe em área anunciados. Os outros monstros ficam suspensos, os efeitos hostis são limpos e o relógio das ondas pausa durante o duelo. Após derrotá-lo, os monstros sobreviventes reaparecem e as ondas retomam. Há recompensa de chefe e o gorila não reaparece nessa partida.

- `spritesheet.png`: folha RGBA de 1536 × 1024, quatro colunas e duas linhas.
- `frame-0.png` a `frame-7.png`: quadros individuais de 384 × 512.
- `idle-preview.gif`: ciclo de espera com respiração, mudança sutil da cabeça e piscada.
- `challenge-preview.gif`: sequência de provocação com batidas no peito e boca aberta; sem áudio.
- `animations.json`: índices dos quadros, dimensões e durações em milissegundos.

Os GIFs usam fundo verde escuro para facilitar a avaliação. Os PNGs preservam o canal alfa gerado. São estudos com quatro poses por estado; a suavização adicional e a validação na escala final do jogo ficam para a integração.

Para regenerar as prévias com a dependência `sharp` já presente no projeto:

```sh
node public/sprites/boss-gorilla/build-previews.mjs
```

O chefe preserva o visual aprovado do NPC e usa animações próprias de locomoção e golpe. A animação e o combate pausam junto com a partida.

O salto tem recarga de 3 segundos a partir da aterrissagem e aguarda o ataque atual terminar. Marca a posição do jogador por 0,65 segundo e salta até esse ponto em 0,7 segundo, com trajetória visual em arco. O impacto tem raio de 95 unidades, causa o dano base do chefe e atordoa por 1 segundo se retirar vida. É possível sair da marca ou pular para evitar o impacto. Não há dano de contato durante o voo; morte e pausa interrompem a execução normalmente.

## Animações de combate

`combat-spritesheet.png` contém 18 quadros, em seis colunas e três linhas: caminhada, corrida e golpe com dois punhos no chão. `combat-animations.json` define os recortes e as linhas de apoio dos pés. Cada linha tem seis poses. Os quadros do NPC continuam sendo usados em repouso.

O jogo carrega `combat-atlas.png`, com células isoladas de 320 × 406 e margem transparente. A folha gerada originalmente tem membros que atravessam algumas divisões; `build-isolated-sprites.mjs` identifica cada silhueta inteira e a reposiciona em sua própria célula, preservando a suavização da borda. Isso impede fragmentos de poses vizinhas e vazamento na interpolação do Canvas. Para reconstruir os arquivos, execute primeiro `node public/sprites/boss-gorilla/build-isolated-sprites.mjs` e depois o script de prévias.

O chefe alterna os passos pela distância efetivamente percorrida, após a resolução do terreno. A investida usa a corrida. A preparação do golpe usa os quatro primeiros quadros; o quinto acompanha o evento de dano e o sexto encerra a recuperação de 0,4 segundo. A posição permanece fixa durante a preparação e recuperação; a direção do desenho acompanha o alvo e fica travada durante o golpe.

Prévias: `walk-preview.gif`, `run-preview.gif`, `slam-preview.gif`. Regenerar com `node public/sprites/boss-gorilla/build-combat-previews.mjs`.

Prompt de geração integrado (`image_gen`), usando o gorila aprovado como referência: preservar identidade, costas prateadas e traço 2D; criar folha transparente de seis colunas e três linhas com corpo inteiro, câmera em três quartos à direita e escala constante. Primeira linha: seis poses alternadas de caminhada sobre os nós dos dedos. Segunda: seis poses de corrida quadrúpede com impulsão e compressão. Terceira: preparação agachada, elevação, punhos acima da cabeça, descida, impacto dos dois punhos e recuperação. Sem texto, cenário ou partículas.

## Geração

Ferramenta: geração de imagens integrada (`image_gen`), usando o conceito aprovado como referência de identidade.

Prompt final: preservar o gorila de pelagem carvão, costas prateadas, braços enormes e desenho 2D com contornos e cel shading; produzir folha de oito quadros em quatro colunas por duas linhas, fundo transparente, câmera frontal em três quartos voltada para a direita, corpo inteiro e escala consistente. Primeira linha: postura neutra apoiada nos nós dos dedos, inspiração, peito expandido com leve olhar lateral, retorno com piscada. Segunda linha: elevar punho direito ao peito, bater com a direita e abrir a boca, bater com a esquerda, retornar à postura neutra. Sem cenário, texto, interface, adereços ou partículas.
