# Blinko Site V2 — direção aprovada e correções obrigatórias

> Este arquivo é a memória oficial do estado atual do site e do que precisa ser corrigido antes de continuar refinando a Home.
>
> **Fonte oficial:** repositório `leleca7/blinko`, branch `main`.
> A Vercel deve publicar a partir deste repositório. Não usar projetos paralelos como versão oficial.

## Direção visual que NÃO deve ser perdida

A Home deve continuar na direção **imersiva, editorial, cinematográfica e sofisticada** aprovada pela usuária.

Características obrigatórias:

- Verde escuro + papel/bege como base visual.
- Rosa e lilás como momentos de impacto, sem deixar tudo colorido ao mesmo tempo.
- Tipografia grande/editorial.
- Scroll com sensação de cenas, não blocos comuns de landing page.
- Movimento refinado e controlado.
- Uso das fotos da Blinko como momentos editoriais grandes, não como galeria comum.
- Uso da identidade real da Blinko (logos e flor), sem emojis como ícones.
- Experiência forte, mas sem sobrecarregar visualmente o usuário.

## Efeito do mouse — OBRIGATÓRIO

**Restaurar e preservar o efeito de sombra/glow rosa que acompanha o mouse.**

Esse efeito foi aprovado e descrito como um dos detalhes mais luxuosos da versão anterior.

Implementação desejada:

- glow/sombra rosa muito suave;
- acompanha o ponteiro com movimento fluido;
- grande e difuso, sem parecer bolinha sólida;
- mistura delicadamente com fundo e imagens;
- não deve atrapalhar leitura nem botões;
- `pointer-events: none`;
- desativado/reduzido em touch/mobile;
- respeitar `prefers-reduced-motion`;
- pode usar `mix-blend-mode` apenas se o contraste continuar elegante.

Referência técnica da primeira versão que funcionava bem:

```css
.cursor-glow {
  position: fixed;
  z-index: 30;
  top: 0;
  left: 0;
  width: 24rem;
  aspect-ratio: 1;
  pointer-events: none;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(239, 59, 127, 0.11), transparent 68%);
  transform: translate(calc(var(--mouse-x) - 50%), calc(var(--mouse-y) - 50%));
  mix-blend-mode: multiply;
}
```

A implementação final pode ser melhor que essa, mas a **sensação visual precisa permanecer**.

---

# Correções prioritárias

## P0 — corrigir antes de qualquer refinamento novo

### 1. Seção SUPERFÍCIE → CAMADAS → RAIZ

Problema atual:
- textos aparecem um em cima do outro;
- o fim da etapa RAIZ fica cortado/bugado;
- leitura fica impossível em alguns pontos do scroll.

Corrigir para que:
- apenas uma cena fique visualmente dominante por vez;
- transições sejam sequenciais;
- nenhuma cena ocupe o mesmo espaço com opacidade alta;
- o texto completo da etapa RAIZ apareça;
- desktop e mobile sejam testados separadamente.

Texto atual que deve permanecer como base:

**SUPERFÍCIE**  
“Precisamos postar mais.”  
Talvez. Mas isso é a causa ou só o lugar onde o problema aparece?

**CAMADAS**  
Comunicação. Atendimento. Operação.  
A leitura muda quando as áreas deixam de ser vistas isoladamente.

**RAIZ**  
Primeiro corrigimos o que sustenta tudo.  
Depois avançamos para as pontas com muito mais precisão.

### 2. Substituir a raiz feita de linhas

A raiz atual desenhada apenas com linhas foi rejeitada visualmente.

Nova direção:
- não usar desenho infantil/diagramático;
- preferir composição editorial/orgânica;
- pode ser uma forma abstrata botânica, recorte, máscara, textura, expansão radial ou camada animada;
- deve representar “ir até a causa” sem parecer ilustração didática simples.

### 3. Imagens em alta qualidade

Problema confirmado:
- imagens publicadas estão pixeladas/baixa resolução;
- uma das imagens aparece borrada;
- os arquivos enviados anteriormente para o repositório eram versões pequenas/comprimidas demais.

Corrigir:
- substituir pelos arquivos originais em alta resolução;
- não ampliar imagens pequenas;
- gerar WebP/AVIF apenas a partir do original e mantendo resolução suficiente;
- usar `object-fit`/`object-position` corretamente;
- conferir nitidez em monitor desktop e celular retina;
- não usar blur permanente em foto principal.

**Não considerar os pequenos arquivos atuais como assets finais.**

### 4. Hero — vídeo precisa realmente rodar

Problema atual:
- vídeo do hero não está reproduzindo corretamente.

Corrigir:
- usar o arquivo real do vídeo, não placeholder/miniversão;
- `autoPlay` + `muted` + `loop` + `playsInline`;
- poster adequado durante carregamento;
- fallback visual se autoplay for bloqueado;
- verificar formato/codec aceito em Chrome, Safari e celular;
- não deixar overlay verde tão forte que esconda o vídeo;
- vídeo precisa continuar legível como elemento cinematográfico de fundo.

### 5. Logos reais nos lugares corretos

Problemas atuais:
- logo não aparece onde deveria;
- em alguns lugares existe marca improvisada/digitada;
- existe uma logo/elemento girando com fundo branco, rejeitado pela usuária.

Corrigir:
- usar os arquivos oficiais de logo;
- fundo verde → logo clara/transparente;
- fundo papel → logo escura/transparente;
- header deve mostrar a marca real, não texto simulando `blinko*`;
- footer também deve usar logo real quando fizer sentido;
- remover qualquer imagem de logo com fundo branco aparente;
- nunca girar a logo completa da Blinko como decoração.

### 6. Flor/selo da Blinko

A flor pode ter movimento, mas:
- deve ser PNG/WebP com transparência real;
- nunca aparecer dentro de quadrado branco;
- não confundir flor decorativa com logo principal;
- rotação deve ser lenta e elegante;
- pode reagir ao scroll/cursor de modo discreto.

---

# P1 — refinamento visual depois dos bugs

### Hero

Manter conceito:
- vídeo fullscreen;
- frase principal: **“O problema raramente está onde parece.”**;
- narrativa cinematográfica;
- CTA de diagnóstico;
- transição do hero para o início da investigação deve parecer contínua.

### “Antes de propor, entramos”

Manter como uma das principais cenas da Home.

Direção:
- foto de caminhada em alta resolução;
- composição editorial;
- texto grande;
- sensação de que a Blinko está entrando na realidade da empresa antes de propor solução.

### Foto trabalhando / notebook

- usar foto boa em alta resolução;
- não borrar;
- aparecer como composição editorial, não como card padrão;
- pode usar sobreposição de texto, desde que texto e imagem nunca percam legibilidade.

### Movimento geral

- parallax e scroll com propósito;
- evitar excesso de animação simultânea;
- movimento deve conduzir narrativa;
- manter performance boa;
- mobile deve ter versão simplificada quando necessário.

---

# Regras de processo para não perder versão de novo

1. **GitHub `leleca7/blinko` / `main` é a fonte de verdade.**
2. Toda mudança importante deve virar commit com mensagem clara.
3. Antes de uma alteração visual grande, criar commit/snapshot recuperável.
4. Não substituir uma versão aprovada por um protótipo simplificado.
5. Experimentos grandes devem acontecer em branch/preview e só entrar no `main` depois de aprovados.
6. Vercel oficial deve continuar conectado ao repositório `blinko`.
7. Depois de cada deploy, verificar visualmente se vídeo, imagens, logos e scroll estão funcionando antes de considerar concluído.

---

# Estado ao encerrar esta sessão

A direção conceitual da V2 está aprovada, porém o deploy atual ainda possui bugs visuais e assets de qualidade insuficiente.

**Próxima sessão deve começar pelos itens P0 acima, nesta ordem:**

1. corrigir sobreposição da seção Superfície/Camadas/Raiz;
2. restaurar glow rosa seguindo o mouse;
3. trocar a raiz de linhas por visual mais sofisticado;
4. substituir imagens por versões de alta resolução;
5. corrigir logos e remover fundo branco;
6. corrigir vídeo real do hero e confirmar autoplay;
7. publicar e testar na Vercel;
8. só depois continuar refinando novas seções.
