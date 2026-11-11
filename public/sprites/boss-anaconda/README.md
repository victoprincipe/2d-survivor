# Sucuri gigante — prévias de animação

Boss integrado à Floresta Amazônica, no lago superior em `(-4000, -3600)`. Pressione E perto dela e confirme o duelo. Sair do lago cancela, restaura os monstros e reinicia a sucuri com vida cheia. A vitória faz cair Luvas da Sucuri; a coleta salva o item provisório, sem bônus, no inventário do personagem.

- `spritesheet.png`: folha RGBA de 1536 × 1024, quatro colunas por três linhas.
- `idle-0.png` a `idle-3.png`: quatro poses de espera e respiração, com língua e balanço da cabeça.
- `slither-0.png` a `slither-3.png`: quatro poses de ondulação do corpo para rastejamento.
- `bite-0.png` a `bite-3.png`: preparação, bote com boca aberta, fechamento e retorno.
- `idle-preview.gif`, `slither-preview.gif`, `bite-preview.gif`: prévias em loop com fundo verde para avaliação.
- `animations.json`: ordem, linhas e tempos dos quadros em milissegundos.

Os quadros individuais têm margem transparente e são decodificados separadamente para evitar amostragem de poses vizinhas. As três linhas da folha original têm alturas de 341, 341 e 342 pixels. O script normaliza os quadros para 416 × 374. São ciclos com quatro desenhos por estado; o rastejamento é uma ondulação compacta do corpo enrolado.

## Rig e combate

- `body.png`: corpo enrolado sem cabeça, imóvel durante o bote duplo.
- `neck.png`: textura pintada de pescoço, recortada em faixas e articulada em curva no Canvas.
- `head-open.png` e `head-closed.png`: cabeça e mandíbula independentes, sincronizadas à colisão varrida do bote.
- `rig-source.png` e `neck-source.png`: originais gerados, preservados para reconstrução dos recortes.

O pescoço usa uma curva cúbica cuja tangente final acompanha a cabeça, com a ligação na parte traseira do crânio. Faixas finas compartilham a mesma silhueta recortada e orientação, evitando emendas e inversões locais. A mira gira suavemente durante a preparação, permanecendo travada no alvo anunciado; as duas imagens da mandíbula mantêm a mesma escala do crânio e transitam gradualmente.

O boss tem 16.000 de vida e 60 de dano base, com escala de dificuldade/tempo. Os ataques são bote duplo de alcance 357,5, mergulho com agitação do lago, caudada e chuva ácida. Cabeça e pescoço são espelhados ao mirar para a esquerda, preservando o ventre e a mandíbula na orientação correta. A chuva marca raio 500, prepara por 1 segundo, cura 20% da vida máxima uma vez e chove por 5 segundos. O dano por segundo é metade do dano base e continua por 2 segundos após sair da área, sem acumular efeitos. Pausa congela a simulação; cancelamento, vitória ou morte removem o veneno.

O mergulho substitui os três pulos da sucuri, sem alterar os saltos do gorila. Após um aviso de 0,7 segundo, ela submerge e agita uma área de raio 700 por 5 segundos. Cada segundo causa 20 de dano antes do ajuste de dificuldade aos jogadores dentro do raio; cada tick que causa dano aplica 0,3 segundo de atordoamento, respeitando a resistência do jogador. Ela reaparece gradualmente em 0,5 segundo, causa um único impacto de 50 de dano base em raio 500 e inicia recarga de 6,75 segundos. Durante o efeito ativo, corpo e sombra ficam completamente invisíveis; ela continua podendo receber dano. Ondas e espuma são animadas pelo tempo da simulação, e todos os efeitos cessam ao cancelar ou encerrar o duelo.

Verificação: `node scripts/check-anaconda.mjs`. Prévia visual usando as classes reais: `node scripts/preview-anaconda.mjs`, disponível em `http://127.0.0.1:3018` enquanto o processo estiver aberto.

As camadas foram criadas com `image_gen` integrado e o desenho aprovado como referência. Prompt do rig: folha transparente de três células iguais; corpo enrolado sem cabeça nem pescoço erguido na primeira; cabeça horizontal olhando à direita, boca aberta na segunda; cabeça correspondente com boca fechada na terceira. Preservar verde-oliva, manchas pretas, ventre dourado, escamas pintadas e contornos, com margem transparente e sem sobreposição. Prompt do pescoço: segmento cilíndrico reto e horizontal, espessura constante, sem cabeça, cauda ou curvas, escamas verde-oliva e manchas escuras, ventre creme-dourado, fundo transparente e estilo idêntico ao desenho aprovado.

Regenerar os quadros e as prévias com `node public/sprites/boss-anaconda/build-previews.mjs`.

## Geração

Na espera e durante o combate, a linha da água passa pelo meio do corpo enrolado. A metade inferior aparece apenas como silhueta submersa, com ondulações na superfície; cabeça e pescoço permanecem acima da água. O mergulho continua ocultando completamente a sucuri durante sua fase ativa.

Ferramenta: `image_gen` integrada, com o conceito aprovado como referência de identidade.

Prompt final: preservar a sucuri gigante brasileira, corpo grosso verde-oliva com manchas pretas, ventre creme-dourado, cabeça larga e estilo 2D pintado com contornos e cel shading. Criar folha transparente com quatro colunas e três linhas, corpo inteiro em cada célula, escala e câmera frontal em três quartos constantes, voltada à direita e margens livres. Primeira linha: quatro poses de espera com respiração, pescoço erguendo, língua e retorno. Segunda: quatro poses de ondulação em S no lugar, alternando curvas e cauda. Terceira: cabeça recolhida preparando o bote, avanço com boca aberta, fechamento da mandíbula e retorno. Uma só cabeça e corpo contínuo, sem membros, capelo de naja, texto, cenário, interface ou partículas.
