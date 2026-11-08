# Gorila — estudo de animação do chefe

Primeira versão visual, integrada à Floresta Amazônica como NPC decorativo em `(2100, -1900)`, no centro do platô nordeste, acessível pela rampa de terra. Usa somente o ciclo de espera, sem movimento, colisão, dano ou interação. A animação acompanha o tempo do jogo e pausa junto com ele.

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

Direção futura: chefe em local fixo da floresta, inicialmente em `idle`; a interação do jogador dispara `challenge` antes do combate. O comportamento de chefe ainda não foi implementado; a provocação permanece apenas como prévia.

## Geração

Ferramenta: geração de imagens integrada (`image_gen`), usando o conceito aprovado como referência de identidade.

Prompt final: preservar o gorila de pelagem carvão, costas prateadas, braços enormes e desenho 2D com contornos e cel shading; produzir folha de oito quadros em quatro colunas por duas linhas, fundo transparente, câmera frontal em três quartos voltada para a direita, corpo inteiro e escala consistente. Primeira linha: postura neutra apoiada nos nós dos dedos, inspiração, peito expandido com leve olhar lateral, retorno com piscada. Segunda linha: elevar punho direito ao peito, bater com a direita e abrir a boca, bater com a esquerda, retornar à postura neutra. Sem cenário, texto, interface, adereços ou partículas.
