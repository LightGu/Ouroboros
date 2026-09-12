# Ouroboros

Ferramenta de mestre para **Ordem Paranormal RPG**. Fichas de agente, cards de mesa com
controle de vida, mapa com fog of war, rolador de dados, trilha sonora, caderno de campanha
com grafo, cenas de interlúdio e um celular com mensagens privadas.

Mestre e jogadores entram na mesma mesa. O que é do mestre, o jogador não recebe — e isso é
decidido no banco, não na interface.

> **Para quem vai editar** (pessoa ou IA): leia a seção **5 — Pegadinhas** antes de mexer.
> Quase todo bug difícil deste projeto está catalogado lá, com a causa. Vários custaram
> horas porque o sintoma não apontava para a causa.

---

## 1. Rodar

```bash
python3 dev-server.py 5599     # http://localhost:5599
```

**Use o `dev-server.py`, nunca `python -m http.server`.** Ele manda `no-store` e ainda carimba
`?v=<mtime>` nas tags do `index.html`. Sem isso o Chrome serve `.js` velho sem nem perguntar,
e você depura um código que não está rodando. Aconteceu duas vezes aqui.

**Publicar:** o Cloudflare Pages está ligado ao GitHub e publica a cada push (~40s).

```bash
git add -A && git commit -m "o que mudou" && git push
```

Produção: https://ouroboros.gustavo952500.workers.dev

### Configuração (uma vez)

1. **Banco** — cole [`sql/schema.sql`](sql/schema.sql) no SQL Editor do Supabase. É idempotente.
2. **Auth** — *Authentication → Sign In / Providers → Email* → desmarque **Confirm email**.
   O SMTP grátis limita a ~2 emails/hora e trava a mesa inteira no primeiro dia.
   Depois que os jogadores se cadastrarem, desmarque também **Allow new users to sign up**.
3. **URL** — *Authentication → URL Configuration* → Site URL = a URL de produção.
4. **Chaves** — em [`js/config.js`](js/config.js). Só chave **publicável**. A `service_role`
   ignora todo o RLS e este arquivo vai pro navegador de todo mundo.

---

## 2. Arquitetura

**Sem build, sem framework, sem npm.** `<script>` clássicos em ordem no `index.html`. Cada
arquivo declara um objeto global. Não são módulos ES — `import`/`export` quebram, e um `const`
de topo de arquivo **não** vira propriedade de `window` (só é acessível pelo nome).

Ordem de carga (há dependências):

```
config → dados → ui → ajuda → nuvem → store → mesa → ficha → criacao → rolagem → mapa
→ sons → campanha → interludio → celular → logs → contas → telas → app
```

`app.js` é o último: ele chama `App.iniciar()` na última linha.

| Arquivo | Responsabilidade |
|---|---|
| `js/config.js` | URL e chave publicável do Supabase |
| `js/dados.js` | Constantes: atributos, 28 perícias, classes, origens, progressão, cores de jogador |
| `js/ui.js` | `$`/`$$`, `esc`, modal, toast, `get/setPath`, redimensionar imagem |
| `js/ajuda.js` | Textos de regra das dicas (`AJUDA`, `dica()`) e a tooltip de hover (`Dica`) |
| `js/nuvem.js` | **Única** camada que fala com o Supabase. Ninguém mais usa `cliente` direto |
| `js/store.js` | Modelo da ficha, estado em memória, gravação agrupada, permissões, cache offline |
| `js/mesa.js` | Cards, barras, munição, condições, turnos, personagem rápido, reivindicar, drag |
| `js/ficha.js` | Ficha completa, binding genérico, subir NEX, calcular status |
| `js/criacao.js` | Criação de personagem: escolha guiado/livre e o passo a passo em 7 telas |
| `js/rolagem.js` | Motor de dados e painel compartilhado |
| `js/mapa.js` | Mapa de batalha, fog of war, tokens |
| `js/sons.js` | Acervo de áudio (só do mestre, toca só na máquina dele) |
| `js/campanha.js` | Caderno com `[[links]]` e grafo. Serve mestre **e** jogadores |
| `js/interludio.js` | Cena de interlúdio: calcula e aplica recuperação |
| `js/celular.js` | Mensagens privadas, personas do mestre, aba de interceptação |
| `js/logs.js` | Aba de logs e pop-up de aviso |
| `js/contas.js` | Várias contas logadas, alternando sem deslogar |
| `js/telas.js` | Login, cadastro, escolha de mesa, menu da conta, lista de quem está na mesa |
| `js/app.js` | Sessão, navegação, assinatura do realtime |

### Telas

Cada tela é um `<main id="view-XXX">`. `App.mostrar('xxx')` esconde todas e mostra uma.
Para adicionar:

1. `<button class="aba" data-aba="nova">` na `<nav class="abas">`
2. `<main id="view-nova" class="view" hidden>`
3. o nome na lista dentro de `App.mostrar()`
4. se for só do mestre: `id="aba-nova" hidden` e libere em `App.entrarNaMesa()`

Abas hoje: **Mesa · Mapa · Sons¹ · Campanha/Anotações² · Interlúdio¹ · Mensagens¹ · Logs¹**
(¹ só mestre · ² todos, com nome diferente por papel)

---

## 3. Dados

### A ficha

O personagem inteiro é **um JSON** na coluna `personagens.dados`. Campo novo na ficha não
exige migração.

```js
{
  id, nome, jogador, imagem, origem, classe, patente, nex, desl, peRodada, cor,
  atributos: { AGI, FOR, INT, PRE, VIG },
  pv/pe/san: {atual, max},
  defesa: {equip, outros}, protecao, resistencias,
  pericias: { acrobacia: {treino, outros}, … },   // 28, chave em slug sem acento
  ataques[], habilidades[], municoes[], inventario{}, descricao{},
  bonus: {corpo, mente},                          // +1d6 do interlúdio
  condicoes[], prestigio, dtRituais,
  rapido, oculto, donoId, ordem                   // espelhados em colunas, para RLS e ordenação
}
```

`Store.normalizar()` preenche o que faltar, e **toda ficha passa por ela** — do banco e de
importação. Campo novo vai em `fichaVazia()` **e** em `normalizar()`, senão ficha antiga quebra.

`notas` (do mestre) **não** fica em `dados`: vive em `notas_mestre`. Motivo na seção 4.

### Binding da ficha

`data-bind="caminho.aninhado"` + um listener de `input` que grava com `setPath()`.
Repetidores usam índice: `data-bind="ataques.0.dano"`. Campo novo só precisa do atributo.

---

## 4. Banco e segurança

### Tabelas

| Tabela | Para quê |
|---|---|
| `perfis` | nome de cada usuário (criado por trigger no cadastro) |
| `mesas` | mesa, mestre, código de convite, estado do combate (`jsonb`) |
| `membros` | quem está em qual mesa, com qual papel |
| `personagens` | fichas: `dados jsonb` + colunas espelho |
| `notas_mestre` | anotações do mestre sobre um personagem |
| `logs` | escrito por trigger, nunca pelo cliente |
| `rolagens` | histórico de dados, com flag `secreta` |
| `mapas` / `tokens` | mapa de batalha. `fog` é string de `0`/`1`, uma por célula |
| `sons` | acervo de áudio |
| `anotacoes` | caderno — do mestre e dos jogadores, com flag `compartilhada` |
| `personas` | "outros números" que o mestre usa no celular |
| `mensagens` | conversas privadas |
| `contatos_liberados` | quem enxerga qual persona |
| `leituras` | até onde cada um leu cada conversa |

### O modelo de permissão

Tudo passa por **RLS no Postgres**. A interface esconde botões por conveniência; quem decide
é o banco. O navegador do jogador **não recebe as linhas** — não adianta abrir o DevTools.

- `eh_membro(mesa)` / `eh_mestre(mesa)` são `SECURITY DEFINER` **de propósito**: se a policy de
  `membros` consultasse `membros`, o Postgres entraria em recursão infinita.
- Jogador edita só a ficha com `dono_id = auth.uid()`. Mestre edita tudo.
- `oculto = true` some para jogador. NPC criado pelo mestre nasce oculto.
- `rapido` e `oculto` só o mestre consegue criar.
- `logs`, `sons` e `notas_mestre`: leitura só do mestre.
- `rolagens` com `secreta`: só o mestre.
- `anotacoes`: minhas + as compartilhadas; mestre vê todas.
- `mensagens`: quem enviou, quem recebeu, e o mestre (inclusive conversa entre dois jogadores —
  **sem aviso para eles**).
- `leituras`: só as próprias linhas. **Nem o mestre vê** quem leu o quê.
- `personas`: todos leem nome e foto (precisam, para ver quem está falando), mas só aparecem no
  celular de quem tem o contato.

**RLS é por linha, não por coluna.** É por isso que existem `notas_mestre` e `leituras`
separadas: se fossem campos dentro da linha principal, quem lê a linha leria o campo junto.

**A exceção é o Storage.** Retrato, mapa e áudio ficam em URL pública. O fog of war esconde da
vista, não do navegador. Não use fog para guardar segredo de campanha.

### Funções

`criar_mesa`, `entrar_na_mesa`, `minhas_mesas`, `reivindicar_personagem`, `liberar_personagem`,
`liberar_contato`. Existem porque a operação precisa de uma checagem que RLS sozinho não faz —
tipicamente "só se ainda não tiver dono" ou "só se você mesmo já tiver esse contato".

### Migração

`sql/schema.sql` é a fonte da verdade e roda por cima de si mesmo. Cada mudança também vira um
arquivo próprio (`v4`…`v9`) — **cole o arquivo pequeno, não as 700 linhas**: paste cortado no
editor do Supabase gera erro de sintaxe fantasma difícil de diagnosticar.

- `create table if not exists`, `drop policy if exists` antes de `create policy`
- **`drop function` antes de `create or replace` se a assinatura mudou.** O Postgres recusa
  trocar o tipo de retorno. Já quebrou aqui com `minhas_mesas()`
- tabela nova que precisa de realtime: `alter publication supabase_realtime add table …`

### Realtime

Um canal por mesa (`mesa-<id>`), aberto em `Nuvem.assinar()`. Escuta `postgres_changes` de
`personagens`, `logs`, `rolagens`, `mapas`, `tokens`, `mesas`, `anotacoes`, `mensagens`, mais um
`broadcast` para arrastar token.

**Espere a confirmação.** `subscribe()` retorna antes de o Postgres instalar o filtro; mudanças
nessa janela somem caladas. Por isso existe `aoLigar`, que dispara no evento `system` com
`status: 'ok'` e recarrega a mesa — inclusive depois de reconexão. A bolinha na topbar mostra o
estado (verde = ao vivo, âmbar = reconectando). **Se ela ficar âmbar, a inscrição falhou** —
veja a pegadinha do canal único na seção 5.

---

## 5. Pegadinhas

Cada item aqui custou pelo menos uma rodada de depuração.

**Uma inscrição recusada derruba o canal inteiro.** Todas as tabelas dividem um canal. Se o
Realtime recusar UMA — porque a tabela não existe, ou porque aquele usuário não pode lê-la —
**todas as outras morrem junto** e a pessoa fica sem nada ao vivo. Aconteceu com `sons`, e o
sintoma (jogadores sem PV ao vivo, sem mapa, sem mensagem) não apontava em nada para a causa.
Hoje `sons` está fora do canal. **Ao restringir ou criar tabela, confira o canal de quem não a lê.**

**Migração que aborta no meio deixa rastro silencioso.** O `schema.sql` é um script só: um erro
no meio (foi um `create or replace function` com assinatura mudada) interrompe tudo que vem
depois, sem aviso. A tabela `sons` e o bucket de áudio ficaram faltando por semanas assim, e só
apareceram quando alguém tentou subir um arquivo. Pior: **listar um bucket inexistente não dá
erro** — devolve lista vazia. Depois de rodar migração, confira o que foi criado.

**Trocar de canal precisa de `await`.** O canal usa sempre o mesmo nome (o broadcast exige
tópico comum). Se o novo entrar antes de o antigo sair, o servidor ignora o segundo: ele fica
`joined` mas nunca confirma, e nada chega. `assinar()` é `async` e dá `await desassinar()`.
O `desassinar()` zera `this.canal` **antes** do await, senão um `assinar()` concorrente já
colocou o canal novo ali e ele é apagado.

**`signOut` mata as outras contas.** Mesmo com `scope: 'local'`, ele invalida os refresh tokens
guardados em `Contas` — voltar para outra conta passa a dar "Auth session missing". Por isso
`Contas.novaConta()` **não** desloga: o `signInWithPassword` seguinte já substitui a sessão.

**`[hidden]` perde para `display` de classe.** `.modal{display:flex}` vence o `display:none` do
atributo. Existe `[hidden]{display:none!important}` no topo do CSS. Não remova.

**Listener em container que você re-renderiza.** `Ficha.abrir()` troca o `innerHTML`, mas o
listener delegado fica no container. Sem a trava `_ligado`, cada abertura empilha mais um e um
clique vira dois. Mesmo padrão em `Rolagem`, `Sons` e `Celular`.

**PostgREST não inventa relação.** `membros.user_id` e `perfis.id` apontam para `auth.users`,
mas não há FK entre as duas — `select('…, perfis(nome)')` falha com "Could not find a
relationship". São duas consultas e junção no cliente.

**Estado de interface que precisa sobreviver ao F5 tem que ir pro banco.** A bolinha de mensagem
nova vivia num `Set` em memória: sumia ao recarregar e não existia para quem abrisse o app
depois. Virou a tabela `leituras`.

**SVG em `data:` URI precisa de `%3C`/`%3E`.** Com `<` e `>` crus o Chrome tolera e o Firefox
recusa — a máscara não aplica e não há erro nenhum.

**Nada de `var()` dentro de `@keyframes`.** Resolve de forma imprevisível. Pior: `--h` já é o
matiz em `.nota` e `.retrato-vazio`; reusar o nome fez um `translateY(calc(var(--h) * -1))`
virar `translateY(12px)`. Use frações da própria caixa e keyframes com nome próprio.

**Camada transparente por cima come o clique.** `.mapa-tokens` tem `inset:0` e cobria o mapa,
então nenhum clique chegava ao canvas do fog. Hoje é `pointer-events:none` e só os tokens são
clicáveis.

**Coordenada de SVG: use a matriz dele.** Calcular com `getBoundingClientRect` erra sempre que a
proporção do elemento difere da do `viewBox`. Dava 36px de erro no meio do grafo e 219px na
borda. Use `pt.matrixTransform(el.getScreenCTM().inverse())`.

**Clique vira arrasto com 1px de tremida.** Marcar "arrastou" no primeiro `pointermove` faz o
clique falhar quase sempre. Conte como arrasto só acima de ~4px.

**IDs duplicados entre modal e painel.** `#an-titulo` existia nos dois; com ambos abertos,
`$('#an-titulo')` pegava o errado. Modais usam prefixo próprio (`nn-`, `pers-`).

**Presença do Supabase não funciona neste projeto.** `track()` retorna "ok" e `presenceState()`
fica vazio; o evento `sync` nunca dispara. Está desligado — a lista de jogadores usa a data de
entrada. Não é regressão: nunca funcionou aqui.

---

## 6. Testar

Não há suíte. O que funciona é dirigir o app pelo console do navegador, montando estado falso:

```js
App.sessao = {user:{id:'u1'}}; App.ehMestre = true;
Store.mesaId = 'm1'; Store.ehMestre = true;
Store.salvar = function(){};            // não grava durante o teste
Store.estado.personagens = [Store.normalizar({id:'c1', nome:'Teste'})];
Mesa.render();
```

Para regras de acesso, crie clientes Supabase paralelos e teste de verdade:

```js
const mk = k => window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
  { auth: { storageKey: k, persistSession: false } });
```

Quatro lições que valeram:

**Meça visibilidade, não só geometria.** `getBoundingClientRect()` devolve caixa para elemento
escondido por CSS. Confira `getComputedStyle(el).display !== 'none'`.

**Dispare o evento em quem está no ponto.** `el.dispatchEvent()` pula a detecção de quem está
por cima; o mouse não pula. Use `document.elementFromPoint(x,y).dispatchEvent(...)`.

**Teste as regras com a conta de menor privilégio.** Vários furos só apareceram logado como
jogador. Como mestre, tudo passa — e não é isso que você quer provar.

**Transições e animações não avançam em aba oculta.** Se o ambiente de teste não estiver
renderizando, `getBoundingClientRect` devolve sempre o quadro inicial e parece que a animação
não existe. Para verificar, force `transition: none` ou mexa em `animation.currentTime`.
Dois "bugs" foram alarme falso por isso.

Para conferir desenho (SVG, ícone) sem screenshot: renderize num `<canvas>` e devolva uma grade
de caracteres lendo o alfa dos pixels. Foi assim que o ouroboros foi ajustado.

---

## 7. Catálogo de itens

`catalogo/itens.json` (fora do git) tem **178 itens**, 45 armas com dano/crítico/alcance/tipo,
extraídos dos PDFs com um script de duas passadas: página inteira (tabelas largas, como a de
armas) e coluna por coluna (tabelas estreitas encostadas em texto corrido).

**Pendências:** a tela de *Equipar* não existe ainda; 8 nomes saíram com texto colado; colete e
mochila não apareceram; `AS_07` é quadrinho sem camada de texto.

Quando a tela existir, o catálogo **não** pode virar arquivo público do site — é conteúdo dos
livros. Ele vai pro Supabase, atrás do login.

---

## 8. Convenções

- **Código e comentários em português**, nomes de variável inclusive
- Comentário explica **por quê**. Se o porquê é uma armadilha, documente na seção 5
- CSS por seção, com cabeçalho de bloco. Cores no `:root`
- `--roxo` é a marca; `--perigo` é o vermelho e só aparece onde significa dano, risco ou falha
  (excluir, dano, dado 1 natural, munição zerada, barra de PV). Não troque um pelo outro
- Animação só com `transform` e `opacity`. Respeite `prefers-reduced-motion`
- Todo texto de usuário passa por `esc()` antes de entrar em `innerHTML`
- `.gitignore` barra os PDFs dos livros e o `catalogo/`. **Confira antes de publicar**

### `repeat(auto-fill, minmax(400px, 1fr))` estoura tela estreita

`auto-fill` com um mínimo em pixels **nunca** encolhe abaixo desse mínimo: num
celular de 375px uma grade `minmax(432px, 1fr)` força 432px, estica a página
inteira e tudo que usa `100%` (o celular flutuante, por exemplo) herda a
largura errada. A forma correta é `minmax(min(432px, 100%), 1fr)`.

### Item flex com `overflow-x: auto` ainda estica o pai

A faixa de abas rolava de lado e mesmo assim empurrava a largura do documento.
Um item flex tem `min-width: auto` por padrão e se recusa a encolher abaixo do
conteúdo. Toda faixa que rola precisa de `min-width: 0` explícito.

### Campo com fonte abaixo de 16px dá zoom sozinho no iOS

E o iOS não desfaz o zoom depois. Por isso o bloco
`@media (pointer: coarse) and (max-width: 860px)` força 16px em todo
`input`/`select`/`textarea`. O `max-width` ali não é decoração: sem ele um
notebook com tela sensível cairia na regra e a ficha inteira incharia.

### Os botões da topbar no celular

`+ Personagem`, `+ Rápido`, `Exportar` e `Importar` vivem dentro de
`#acoes-extra`. No desktop esse invólucro é `display: contents` — ele some do
layout e os botões ficam soltos como sempre foram. Abaixo de 860px ele vira um
menu suspenso atrás do `⋯`. Não existe botão duplicado: é o mesmo elemento nos
dois casos, então os `id` e os listeners continuam únicos.


### Rituais e habilidades são listas separadas

`dados.habilidades` guarda poder de classe, de origem e de trilha — tabela
simples de quatro colunas. `dados.rituais` é uma lista própria, com os campos
do bloco impresso no livro: elemento, círculo, custo, execução, alcance, alvo,
duração, resistência, página e descrição. O vocabulário fechado dessas colunas
(`ELEMENTOS`, `CIRCULOS`, `EXECUCOES`, `ALCANCES`, `DURACOES`) está em
`js/dados.js`; `CIRCULOS` também carrega o custo em PE e o NEX mínimo de cada
círculo (1º→5%, 2º→45%, 3º→75%, 4º→99%), conferidos nos Arquivos Secretos.

Ficha gravada antes dessa mudança não tem a chave `rituais`; `Store.normalizar`
cria a lista vazia, então nada quebra e nada precisa de migração no banco. O
botão `⇩` em cada linha de habilidade move a linha inteira para Rituais,
preservando nome, custo, página e descrição.

### A seção TOQUE precisa ser a última do style.css

Ela existe para vencer o `font-size` que cada componente declara (o iOS dá zoom
sozinho em campo com menos de 16px). Como quase toda regra ali empata em
especificidade com a do componente, quem vence é a que vier depois no arquivo.
Blocos novos entram **antes** dela, nunca depois.

