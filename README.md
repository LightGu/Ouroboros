# Ouroboros

Ferramenta de mestre para **Ordem Paranormal RPG**. Fichas de agente, cards de mesa com
controle de vida, mapa com fog of war, rolador de dados, trilha sonora, caderno de campanha
com grafo e cenas de interlúdio. Mestre e jogadores entram na mesma mesa; o que é do mestre
o jogador não recebe.

> **Este README é para quem vai editar o projeto** (pessoa ou IA). Ele explica a arquitetura,
> as convenções e — principalmente — as **armadilhas que já custaram tempo aqui**.
> Leia a seção *Pegadinhas* antes de mexer: quase todo bug difícil deste projeto está lá.

---

## 1. Rodar

```bash
python3 dev-server.py 5599
```

E abra `http://localhost:5599`.

**Use o `dev-server.py`, não o `python -m http.server`.** Ele manda `Cache-Control: no-store`.
Com o servidor padrão o navegador cacheia os `.js` e suas edições não aparecem — você vai achar
que o código está quebrado quando só está velho. Isso já aconteceu aqui mais de uma vez.

Para os jogadores entrarem de fora, publique a pasta em qualquer host estático
(Vercel, Netlify, GitHub Pages). É HTML puro, não tem build.

### Configuração inicial (uma vez)

1. **Banco**: cole [`sql/schema.sql`](sql/schema.sql) no SQL Editor do Supabase e rode.
   É idempotente — pode rodar quantas vezes quiser.
2. **Auth**: Supabase → *Authentication* → *Sign In / Providers* → *Email* → **desmarque
   "Confirm email"**. Sem isso o SMTP grátis limita a ~2 emails/hora e trava a mesa inteira.
3. **Chaves**: já estão em [`js/config.js`](js/config.js). Só entra chave **publicável**
   (`sb_publishable_…` ou `anon`). A `service_role` ignora todas as regras de RLS e este
   arquivo vai para o navegador de todo mundo — nunca a coloque aqui.

---

## 2. Como o projeto é montado

**Sem build, sem framework, sem npm.** São `<script>` clássicos carregados em ordem no
`index.html`. Cada arquivo declara um objeto global (`Mesa`, `Ficha`, `Mapa`…) e os outros
usam direto. Não são módulos ES — `import`/`export` quebram, e um `const` no topo do arquivo
**não** vira propriedade de `window` (só é acessível pelo nome).

Ordem de carga (importa, há dependências):

```
config.js → dados.js → ui.js → nuvem.js → store.js → mesa.js → ficha.js
→ rolagem.js → mapa.js → sons.js → campanha.js → interludio.js → logs.js
→ telas.js → app.js
```

`app.js` é o último porque ele chama `App.iniciar()` na última linha.

### Mapa dos arquivos

| Arquivo | Responsabilidade |
|---|---|
| `js/config.js` | URL e chave publicável do Supabase |
| `js/dados.js` | Constantes do sistema: atributos, 28 perícias, classes, origens, progressão de PV/PE/SAN |
| `js/ui.js` | `$`/`$$`, `esc`, modal, toast, `get/setPath`, redimensionamento de imagem |
| `js/nuvem.js` | **Única** camada que fala com o Supabase. Nada mais importa `cliente` direto |
| `js/store.js` | Modelo da ficha, estado em memória, gravação agrupada, permissões, cache offline |
| `js/mesa.js` | Cards, barras de status, munição, condições, turnos, personagem rápido, drag & drop |
| `js/ficha.js` | Ficha de agente completa, binding genérico, subir NEX, calcular status |
| `js/rolagem.js` | Motor de dados e painel lateral compartilhado |
| `js/mapa.js` | Mapa de batalha, fog of war, tokens |
| `js/sons.js` | Acervo de áudio (só do mestre, toca só na máquina dele) |
| `js/campanha.js` | Caderno do mestre, links `[[wiki]]`, grafo de força, importar/exportar |
| `js/interludio.js` | Cena de interlúdio: calcula e aplica a recuperação |
| `js/logs.js` | Aba de logs e o pop-up de aviso |
| `js/telas.js` | Login, cadastro, escolha de mesa, menu da conta |
| `js/app.js` | Sessão, navegação entre telas, assinatura do realtime |
| `css/style.css` | Tudo. Organizado por seção, com comentários de bloco |
| `sql/schema.sql` | Fonte da verdade do banco. Roda do zero ou por cima |

### Navegação

Cada tela é um `<main id="view-XXX">` no `index.html`. `App.mostrar('xxx')` esconde todas e
mostra uma, e dispara o `render()` da tela quando precisa. Para adicionar uma tela:

1. `<button class="aba" data-aba="nova">` na `<nav class="abas">` do `index.html`
2. `<main id="view-nova" class="view" hidden>`
3. O nome `'nova'` na lista dentro de `App.mostrar()`
4. Se for só do mestre: `id="aba-nova" hidden` e libere em `App.entrarNaMesa()`

---

## 3. Dados

### A ficha

O personagem inteiro é **um objeto JSON** guardado na coluna `personagens.dados`. Isso é
proposital: adicionar campo na ficha não exige migração de banco.

```js
{
  id, nome, jogador, imagem, origem, classe, patente, nex, desl, peRodada,
  atributos: { AGI, FOR, INT, PRE, VIG },
  pv: {atual, max}, pe: {atual, max}, san: {atual, max},
  defesa: { equip, outros }, protecao, resistencias,
  pericias: { acrobacia: {treino, outros}, … },   // 28, chave em slug sem acento
  ataques: [{nome, teste, dano, especial}],
  habilidades: [{nome, custo, pagina, desc}],
  municoes: [{nome, atual, max}],
  inventario: { limites:{I,II,III,IV}, credito, cargaMax, itens:[{nome,categoria,espacos}] },
  descricao: { aparencia, personalidade, historico, objetivo },
  bonus: { corpo, mente },      // +1d6 acumulados do interlúdio
  condicoes: [], prestigio, dtRituais,
  rapido, oculto, donoId, ordem  // espelhados em colunas do banco para RLS e ordenação
}
```

`Store.normalizar()` preenche o que faltar. **Toda ficha que entra no app passa por ela** —
inclusive as vindas do banco e de importação. Ao adicionar campo novo, coloque em
`Store.fichaVazia()` **e** em `Store.normalizar()`, senão fichas antigas quebram.

`notas` (anotações do mestre) **não** fica em `dados`: vive na tabela `notas_mestre`.
Motivo na seção de segurança.

### Binding da ficha

`ficha.js` usa `data-bind="caminho.aninhado"` e um único listener de `input` que grava com
`setPath()`. Repetidores usam índice: `data-bind="ataques.0.dano"`. Para adicionar campo,
basta o `data-bind` — não precisa escrever handler.

---

## 4. Banco e segurança

### Tabelas

| Tabela | Para quê |
|---|---|
| `perfis` | nome do usuário (criado por trigger no cadastro) |
| `mesas` | mesa, mestre, código de convite, estado do combate (`jsonb`) |
| `membros` | quem está em qual mesa e com qual papel |
| `personagens` | fichas. `dados jsonb` + colunas espelho para RLS |
| `notas_mestre` | anotações do mestre, separadas de propósito |
| `logs` | gerado por trigger, não pelo cliente |
| `rolagens` | histórico de dados, com flag `secreta` |
| `mapas` / `tokens` | mapa de batalha. `fog` é string de `0`/`1`, uma por célula |
| `sons` | acervo de áudio |
| `anotacoes` | caderno de campanha |

### O modelo de permissão

Tudo passa por **RLS no Postgres**. A interface esconde botões por conveniência, mas quem
manda é o banco: o navegador do jogador simplesmente **não recebe as linhas**. Não adianta
abrir o DevTools.

- `eh_membro(mesa)` / `eh_mestre(mesa)` são `SECURITY DEFINER` **de propósito**. Se a policy
  de `membros` consultasse `membros` diretamente, o Postgres entraria em recursão infinita.
- Jogador edita só a ficha onde `dono_id = auth.uid()`. Mestre edita tudo.
- `personagens` com `oculto = true` não aparecem para jogador. NPC criado pelo mestre nasce oculto.
- `logs`, `sons`, `anotacoes` e `notas_mestre`: leitura só do mestre.
- `rolagens` com `secreta = true`: só o mestre lê.
- Log é escrito por **trigger** (`registrar_log`), não pelo cliente — o jogador não tem como
  "esquecer" de registrar.

**RLS é por linha, não por coluna.** É por isso que as anotações do mestre estão em outra
tabela: se fossem uma chave dentro de `personagens.dados`, o jogador receberia o texto no
mesmo JSON da ficha.

**A exceção é o Storage.** Imagem de retrato, de mapa e áudio ficam em URL pública. O fog of
war esconde da vista, não do navegador — quem pegar a URL vê o mapa inteiro. Não use fog para
guardar segredo de campanha.

### Migração

`sql/schema.sql` é a fonte da verdade e roda por cima de si mesmo. Ao mudar o banco:

- `create table if not exists`, `drop policy if exists` antes de `create policy`
- **`drop function` antes de `create or replace` se a assinatura mudou** — o Postgres recusa
  trocar o tipo de retorno. Já quebrou aqui com `minhas_mesas()`
- Para mudanças grandes, gere também um arquivo só com o bloco novo (ex.: `sql/v4-campanha.sql`).
  Colar 600 linhas no editor do Supabase dá paste cortado e erro de sintaxe fantasma

### Realtime

Um canal por mesa, aberto em `Nuvem.assinar()`. Escuta `postgres_changes` de `personagens`,
`logs`, `rolagens`, `mapas`, `tokens`, `sons`, `anotacoes`, `mesas`, e um `broadcast` para
arrastar token (posição ao vivo sem tocar no banco).

**Espere a confirmação antes de confiar no canal.** O `subscribe()` retorna antes de o
Postgres instalar o filtro de replicação; mudanças nessa janela somem caladas. Por isso existe
`aoLigar`, que dispara no evento `system` com `status: 'ok'` e recarrega a mesa — inclusive
depois de reconexão. A bolinha na topbar mostra o estado (verde = ao vivo, âmbar = reconectando).

---

## 5. Pegadinhas

Cada item aqui custou pelo menos uma rodada de depuração.

**`[hidden]` perde para `display` de classe.** `.modal{display:flex}` vence o `display:none`
que o navegador dá ao atributo `hidden` — o elemento fica visível e o botão de fechar parece
quebrado. Existe `[hidden]{display:none!important}` no topo do CSS. Não remova.

**Listener em elemento que você re-renderiza.** `Ficha.abrir()` troca o `innerHTML` de
`#view-ficha`, mas o listener delegado fica no container. Sem a trava `_ligado`, cada abertura
empilha mais um — e um clique em "+ Ataque" adiciona 2, 3, 4 linhas. Mesmo padrão em
`Rolagem.ligar()` e `Sons.ligar()`.

**Cache do dev server.** Descrito na seção 1. Se uma edição "não fez efeito", confirme que o
servidor é o `dev-server.py`.

**SVG em `data:` URI precisa de `%3C`/`%3E`.** Com `<` e `>` crus o Chrome tolera e o Firefox
recusa — a máscara simplesmente não aplica e você não vê erro nenhum.

**Não use `var()` dentro de `@keyframes`.** Resolve de forma imprevisível. Pior: `--h` já é o
matiz em `.nota` e `.retrato-vazio`; reusar esse nome para outra coisa fez um
`translateY(calc(var(--h) * -1))` virar `translateY(12px)`. Use frações da própria caixa
(`translateY(-33.333%)` com `background-size: … 33.333%`) e keyframes com nome próprio.

**Camada transparente por cima come o clique.** `.mapa-tokens` tem `inset:0` e cobria o mapa
inteiro, então nenhum clique chegava ao canvas do fog. Hoje ela é `pointer-events:none` e só
os tokens são clicáveis. Ao adicionar camada sobreposta, pense em quem precisa receber o ponteiro.

**Coordenada de SVG: use a matriz dele.** Calcular à mão com `getBoundingClientRect` erra
sempre que a proporção do elemento difere da do `viewBox` (o SVG cria faixas vazias). Dava 36px
de erro no meio do grafo e 219px na borda. Use
`pt.matrixTransform(el.getScreenCTM().inverse())`.

**Clique vira arrasto com 1px de tremida.** Marcar "arrastou" no primeiro `pointermove` faz o
clique falhar quase sempre. Só conte como arrasto acima de ~4px de deslocamento.

**Barra cheia corta o efeito da ponta.** Decoração posicionada em `left:100%` do preenchimento
cai fora quando ele chega a 100%, e o `overflow:hidden` da barra a elimina — o efeito some
justamente quando o personagem está com a vida cheia, que é o estado que você mais olha.
Ancore pela direita e encavale para dentro. A barra atual resolve isso com o fio aceso em
`.barrao-fill::after { right: 0 }`, que fica sempre dentro do preenchimento.

**IDs duplicados entre modal e painel.** `#an-titulo` existia no painel da anotação e no modal
de criar; com os dois abertos, `$('#an-titulo')` pegava o errado e criava a anotação com o
título errado. Modais usam prefixo próprio (`nn-`).

---

## 6. Testar

Não há suíte automatizada. O que funciona bem aqui é dirigir o app pelo console do navegador
(via a ferramenta de preview), montando estado falso e conferindo o DOM:

```js
App.sessao = {user:{id:'u1'}}; App.ehMestre = true;
Store.mesaId = 'm1'; Store.ehMestre = true;
Store.salvar = function(){};            // não grava no banco durante o teste
Store.estado.personagens = [Store.normalizar({id:'c1', nome:'Teste'})];
Mesa.render();
```

Duas lições sobre isso:

**Meça visibilidade, não só geometria.** `getBoundingClientRect()` devolve caixa para elemento
escondido por CSS. Confira `getComputedStyle(el).display !== 'none'` — foi o que deixou passar
o bug do `[hidden]`.

**Dispare o evento em quem está no ponto, não no elemento que você quer.** `el.dispatchEvent()`
pula a detecção de quem está por cima; o mouse de verdade não pula. Use
`document.elementFromPoint(x, y).dispatchEvent(...)` — foi assim que o clique engolido pelo
`.mapa-tokens` apareceu.

Para conferir desenho (SVG, ícone) sem screenshot: renderize num `<canvas>` e devolva uma
grade de caracteres lendo o alfa dos pixels. Foi assim que o ouroboros foi ajustado.

---

## 7. Catálogo de itens

`catalogo/itens.json` tem **178 itens** (45 armas com dano/crítico/alcance/tipo) extraídos dos
PDFs. O extrator (`extrai2.py`, no diretório de trabalho temporário) lida com dois formatos:

- **Ficha em caixa** (Arquivos Secretos): âncora `CATEGORIA X | N ESPAÇOS`
- **Tabela alinhada** (Livro Básico, Sobrevivendo ao Horror): colunas por espaço

Ele faz **duas passadas** — página inteira (tabelas largas, como a de armas) e coluna por
coluna (tabelas estreitas encostadas em texto corrido) — e junta. Uma passada só perde metade.

**Pendências conhecidas:**

- A interface de *Equipar* na ficha **ainda não existe**. O JSON está pronto, falta a tela
- 8 nomes saíram com texto colado (`"dano mental. Paçoca"`) — corrigir à mão
- Colete e mochila não apareceram; devem estar em tabela de proteções com outro formato
- `AS_07_hq_vampyre.pdf` é quadrinho, sem camada de texto — não há item a extrair

---

## 8. Convenções

- **Código e comentários em português.** Nomes de variável também (`personagem`, `rolagem`)
- Comentário explica **por quê**, não o quê. Se o porquê é uma armadilho, documente na seção 5
- CSS organizado por seção com cabeçalho de bloco. Variáveis de cor no `:root`
- `--roxo` é a cor da marca; `--perigo` é o vermelho e só aparece onde significa dano, risco
  ou falha (excluir, dano, dado 1 natural, munição zerada, barra de PV). Não troque um pelo outro
- Animação só com `transform` e `opacity` (a GPU compõe sozinha). Respeite
  `prefers-reduced-motion`
- Todo texto que vem do usuário passa por `esc()` antes de entrar em `innerHTML`
