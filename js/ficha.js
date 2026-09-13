/* Tela da ficha de agente completa */

const Ficha = {
  atual: null,
  ordenacao: {},
  filtroItem: '',   // categoria escolhida no inventário; só de tela, não salva

  /* `abrir` serve para dois casos diferentes: entrar na ficha (deve ir pro
     topo) e redesenhar a que já está aberta depois de adicionar ou remover
     uma linha (tem que ficar exatamente onde estava). Só rola pro topo
     quando a ficha muda. Também devolve o foco e a posição do cursor ao
     campo que estava sendo digitado, senão uma gravação no meio da digitação
     joga o cursor pra fora. */
  abrir(id) {
    const mesma = this.atual && this.atual.id === id;
    const y = window.scrollY;
    const ativo = document.activeElement;
    const foco = mesma && ativo ? ativo.dataset?.bind : null;
    const pos = foco && typeof ativo.selectionStart === 'number' ? ativo.selectionStart : null;

    this.atual = Store.obter(id);
    if (!this.atual) return;
    if (!mesma) { this.filtroItem = ''; this.ordenacao = {}; }
    App.mostrar('ficha');
    this.aplicarCor($('#view-ficha'), this.atual.cor);
    $('#view-ficha').innerHTML = this.html(this.atual);
    Paineis.montar(this.atual);

    if (mesma) {
      window.scrollTo(0, y);
      if (foco) {
        const el = $(`[data-bind="${foco}"]`);
        if (el) { el.focus(); if (pos !== null && el.setSelectionRange) el.setSelectionRange(pos, pos); }
      }
    } else {
      window.scrollTo(0, 0);
    }

    this.ligar();
    if (!Store.podeEditar(this.atual)) this.travar();
    this.carregarDescricoesInventario(this.atual);
  },

  aplicarCor(raiz, cor) {
    const hex = hexDaCor(cor);
    for (const chave of ['--roxo', '--roxo-cl']) raiz.style.removeProperty(chave);
    if (hex) {
      raiz.style.setProperty('--roxo', hex);
      raiz.style.setProperty('--roxo-cl', `color-mix(in srgb, ${hex}, white 30%)`);
    }
  },

  /* Jogador abrindo ficha que não é dele: dá pra consultar, não dá pra mexer. */
  travar() {
    const raiz = $('#view-ficha');
    $$('input, select, textarea', raiz).forEach(el => { el.disabled = true; });
    $$('[data-add], [data-del], [data-attr], [data-excluir], [data-calcular], [data-catalogo], [data-catalogo-rituais], [data-subirnex], [data-aliado-pronto], [data-virar-ritual], [data-add-bonus], [data-add-hab], [data-foto-aliado]', raiz)
      .forEach(el => el.remove());
    $('[data-trocar-img]', raiz)?.removeAttribute('data-trocar-img');
    const ind = $('#indicador-salvo', raiz);
    if (ind) ind.textContent = 'somente leitura';
  },

  async voltar() {
    const p = this.atual;
    this.atual = null;
    $('#view-ficha').innerHTML = '';
    App.mostrar('mesa');
    Mesa.render();
    /* garante que a última tecla digitada chegou na nuvem */
    if (p) { try { await Store.salvarAgora(p); } catch (e) { toast('Falhou salvar: ' + (e.message || e), 'erro'); } }
  },

  /* ---------------- markup ---------------- */

  html(p) {
    return `
    <div class="ficha">

      <div class="ficha-topo">
        <button class="btn btn-ghost" data-voltar>‹ Voltar pra mesa</button>
        <div class="cresce"></div>
        <span class="salvo" id="indicador-salvo">salvo automaticamente</span>
        <button class="btn btn-ghost btn-perigo-texto" data-excluir>Excluir agente</button>
      </div>

      <!-- IDENTIDADE -->
      <section class="bloco bloco-identidade">
        <div class="retrato-ficha" data-trocar-img title="Clique para trocar a imagem">
          ${imagemPorVida(p) ? `<img src="${esc(imagemPorVida(p))}" alt="">`
                     : `<div class="retrato-vazio" style="--h:${corDoNome(p.nome)}">${esc(iniciais(p.nome))}</div>`}
          <span class="retrato-acao">trocar imagem</span>
        </div>

        <div class="identidade-campos">
          <label class="campo campo-destaque"><span>Personagem</span>
            <input data-bind="nome" value="${esc(p.nome)}" placeholder="Nome do agente"></label>
          <div class="grade-4">
            <label class="campo"><span>Jogador</span><input data-bind="jogador" value="${esc(p.jogador)}"></label>
            <label class="campo"${dica(AJUDA.campos.idade)}><span>Idade</span>
              <input type="number" data-bind="idade" value="${esc(p.idade)}" min="0" max="120" placeholder="—"></label>
            <label class="campo"${dica(AJUDA.campos.origem)}><span>Origem</span>
              <input data-bind="origem" value="${esc(p.origem)}" list="dl-origens">
              <datalist id="dl-origens">${ORIGENS.map(o => `<option value="${esc(o)}">`).join('')}</datalist></label>
            <div class="campo"><span>Classe/Trilha</span>
              <input aria-label="Classe" data-bind="classe" data-recarrega value="${esc(p.classe)}" list="dl-classes">
              <datalist id="dl-classes">${CLASSES.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
              <input aria-label="Trilha" data-bind="trilha" data-recarrega value="${esc(p.trilha)}" list="dl-trilhas" placeholder="Escolha ou digite a trilha">
              <datalist id="dl-trilhas">${(Regras.trilhas[p.classe] || []).map(([nome, desc]) => `<option value="${esc(nome)}">${esc(desc)}</option>`).join('')}</datalist>
            </div>
          </div>
          <div class="grade-4">
            <label class="campo"${dica(AJUDA.campos.nex)}><span>NEX %</span><input type="number" data-bind="nex" value="${num(p.nex)}" min="0" max="99" step="5"></label>
            <label class="campo"${dica(AJUDA.campos.desl)}><span>Deslocamento</span><input type="number" data-bind="desl" step="1.5" value="${num(p.desl)}"></label>
            <label class="campo"${dica(AJUDA.campos.peRodada)}><span>PE / turno</span><input data-bind="peRodada" value="${esc(p.peRodada)}"></label>
            <label class="campo"${dica(AJUDA.campos.patente)}><span>Patente</span>
              <input data-bind="patente" value="${esc(p.patente)}" list="dl-patentes">
              <datalist id="dl-patentes">${PATENTES.map(o => `<option value="${esc(o)}">`).join('')}</datalist></label>
          </div>
        </div>
      </section>

      ${Regras.guia(p)}
      ${this.blocoIdade(p)}

      ${p.classe === 'Sobrevivente' ? `<section class="bloco"><label class="campo"><span>Estágio do Sobrevivente (NEX 0%)</span><select data-bind="estagio" data-recarrega>${[1,2,3,4,5].map(n=>`<option value="${n}" ${num(p.estagio,1)===n?'selected':''}>Estágio ${n}</option>`).join('')}</select></label><p class="dica-passo">Escolha o estágio, confira os benefícios no guia e use Calcular pela classe para revisar os máximos.</p></section>` : ''}
      <!-- ATRIBUTOS -->
      <section class="bloco">
        <h2 class="titulo-bloco">Atributos</h2>
        <div class="atributos">
          ${ATRIBUTOS.map(a => `
            <div class="atributo"${dica(AJUDA.atributos[a.key] + ' ' + COMO_ROLA)}>
              <button class="btn-mini" data-attr="${a.key}:-1">−</button>
              <div class="atributo-caixa">
                <input class="atributo-valor" type="number" data-bind="atributos.${a.key}" data-attr-input="${a.key}" value="${num(p.atributos[a.key])}">
                <span class="atributo-sigla">${a.key}</span>
              </div>
              <button class="btn-mini" data-attr="${a.key}:1">+</button>
              <span class="atributo-nome">${a.nome}</span>
            </div>`).join('')}
        </div>
      </section>

      <!-- STATUS -->
      <section class="bloco">
        <h2 class="titulo-bloco">Status
          <button class="btn btn-ghost btn-peq" data-calcular title="Calcula PV/PE/SAN pela classe, NEX e atributos">Calcular pela classe</button>
          <button class="btn btn-ghost btn-peq" data-subirnex title="Revisar avanço do personagem">▲ ${p.classe === "Sobrevivente" ? "Subir estágio" : "Subir NEX"}</button>
        </h2>
        <div class="status-grade">
          ${this.caixaStatus('pv',  'Pontos de Vida',    p)}
          ${this.caixaStatus('pe',  'Pontos de Esforço', p)}
          ${this.caixaStatus('san', 'Sanidade',          p)}

          <div class="caixa-status caixa-defesa"${dica(AJUDA.campos.defesa)}>
            <h3>Defesa</h3>
            <div class="defesa-total" id="defesa-total">${defesaTotal(p)}</div>
            <p class="formula">10 + AGI (<span id="def-agi">${num(p.atributos.AGI)}</span>) + equip. + outros</p>
            <div class="grade-2">
              <label class="campo"${dica(AJUDA.campos.defEquip)}><span>Equipamento</span><input type="number" data-bind="defesa.equip" data-def value="${num(p.defesa.equip)}"></label>
              <label class="campo"${dica(AJUDA.campos.defOutros)}><span>Outros</span><input type="number" data-bind="defesa.outros" data-def value="${num(p.defesa.outros)}"></label>
            </div>
          </div>
        </div>
        <div class="grade-2 espaco-topo">
          <label class="campo"${dica(AJUDA.campos.protecao)}><span>Proteção</span><input data-bind="protecao" value="${esc(p.protecao)}" placeholder="Ex.: Colete balístico"></label>
          <label class="campo"${dica(AJUDA.campos.resistencias)}><span>Resistências</span><input data-bind="resistencias" value="${esc(p.resistencias)}" placeholder="Ex.: Balístico 5, Sangue 2"></label>
        </div>
      </section>

      <!-- PERÍCIAS -->
      <section class="bloco">
        <h2 class="titulo-bloco">Perícias <span class="legenda">* só pode ser usada se treinada</span></h2>
        <div class="pericias">
          ${PERICIAS.map(per => this.linhaPericia(p, per)).join('')}
        </div>
      </section>

      <!-- ATAQUES -->
      <section class="bloco">
        <h2 class="titulo-bloco">Ataques <button class="btn btn-ghost btn-peq" data-add="ataques">+ Ataque</button></h2>
        <div class="tabela tabela-ataques">
          <div class="tabela-cab"><span${dica(AJUDA.campos.ataqueNome)}>Ataque</span><span${dica(AJUDA.campos.ataqueTeste)}>Teste</span><span${dica(AJUDA.campos.ataqueDano)}>Dano</span><span${dica(AJUDA.campos.ataqueEspecial)}>Crítico / Alcance / Especial</span><span></span></div>
          ${p.ataques.length ? p.ataques.map((a, i) => `
            <div class="tabela-linha">
              <input data-bind="ataques.${i}.nome"     value="${esc(a.nome)}"     placeholder="Pistola">
              <input data-bind="ataques.${i}.teste"    value="${esc(a.teste)}"    placeholder="Pontaria">
              <input data-bind="ataques.${i}.dano"     value="${esc(a.dano)}"     placeholder="2d6">
              <input data-bind="ataques.${i}.especial" value="${esc(a.especial)}" placeholder="19/x2, curto, balístico">
              <button class="btn-mini" data-rolardano="${i}" title="Rolar o dano">🎲</button>
              <button class="btn-mini perigo" data-del="ataques:${i}" title="Remover">✕</button>
            </div>`).join('') : '<p class="vazio-linha">Nenhum ataque cadastrado.</p>'}
        </div>
      </section>

      <!-- ALIADOS -->
      <section class="bloco">
        <h2 class="titulo-bloco"${dica(AJUDA.campos.aliado)}>Aliados
          <button class="btn btn-ghost btn-peq" data-add="aliados">+ Aliado</button>
          <button class="btn btn-ghost btn-peq" data-aliado-pronto>Usar um pronto</button>
          <span class="legenda">bicho de estimação, cão adestrado, contato — o bônus entra na rolagem sozinho</span>
        </h2>
        ${p.aliados.length ? p.aliados.map((a, i) => `
          <article class="aliado">
            <div class="aliado-cab">
              <button class="aliado-foto" data-foto-aliado="${i}" title="Trocar foto">
                ${a.foto ? `<img src="${esc(a.foto)}" alt="">` : esc(iniciais(a.nome || '?'))}
              </button>
              <label class="campo"><span>Nome</span>
                <input data-bind="aliados.${i}.nome" value="${esc(a.nome)}" placeholder="Ex.: Tobias, o macaco"></label>
              <label class="campo"><span>Tipo</span>
                <input data-bind="aliados.${i}.tipo" value="${esc(a.tipo)}" placeholder="Animal"></label>
              <button class="btn-mini perigo" data-del="aliados:${i}" title="Remover">✕</button>
            </div>
            <label class="campo"><span>Descrição</span>
              <textarea data-bind="aliados.${i}.descricao" rows="2">${esc(a.descricao)}</textarea></label>

            <h4 class="aliado-sub">Bônus de perícia
              <button class="btn-mini" data-add-bonus="${i}" title="Adicionar">+</button></h4>
            ${(a.bonus || []).length ? a.bonus.map((b, j) => `
              <div class="aliado-linha">
                <select data-bind="aliados.${i}.bonus.${j}.pericia">
                  <option value="">— escolha a perícia —</option>
                  ${PERICIAS.map(x => `<option value="${x.key}" ${b.pericia === x.key ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}
                </select>
                <input type="number" data-bind="aliados.${i}.bonus.${j}.valor" value="${num(b.valor)}" title="Valor do bônus">
                <button class="btn-mini perigo" data-del="aliados.${i}.bonus:${j}" title="Remover">✕</button>
              </div>`).join('') : '<p class="vazio-linha">Sem bônus.</p>'}

            <h4 class="aliado-sub">Habilidades
              <button class="btn-mini" data-add-hab="${i}" title="Adicionar">+</button></h4>
            ${(a.habilidades || []).length ? a.habilidades.map((h, j) => `
              <div class="aliado-linha hab">
                <input data-bind="aliados.${i}.habilidades.${j}.nome" value="${esc(h.nome)}" placeholder="Nome">
                <input data-bind="aliados.${i}.habilidades.${j}.custo" value="${esc(h.custo)}" placeholder="1 PE">
                <input data-bind="aliados.${i}.habilidades.${j}.efeito" value="${esc(h.efeito)}" placeholder="O que faz">
                <button class="btn-mini perigo" data-del="aliados.${i}.habilidades:${j}" title="Remover">✕</button>
              </div>`).join('') : '<p class="vazio-linha">Sem habilidades.</p>'}
          </article>`).join('')
          : '<p class="vazio-linha">Nenhum aliado. Um bicho de estimação treinado entra aqui, e o bônus dele passa a valer nos testes.</p>'}
      </section>

      <!-- MUNIÇÃO -->
      <section class="bloco">
        <h2 class="titulo-bloco"${dica(AJUDA.campos.municao)}>Munição
          <button class="btn btn-ghost btn-peq" data-add="municoes">+ Munição</button></h2>
        <div class="tabela tabela-municao">
          <div class="tabela-cab"><span>Arma / tipo</span><span>Atual</span><span>Máximo</span><span></span></div>
          ${p.municoes.length ? p.municoes.map((m, i) => `
            <div class="tabela-linha">
              <input data-bind="municoes.${i}.nome" value="${esc(m.nome)}" placeholder="Fuzil de assalto">
              <input type="number" data-bind="municoes.${i}.atual" value="${num(m.atual)}">
              <input type="number" data-bind="municoes.${i}.max" value="${num(m.max)}">
              <button class="btn-mini perigo" data-del="municoes:${i}" title="Remover">✕</button>
            </div>`).join('')
            : '<p class="vazio-linha">Sem controle de munição. Adicione uma linha por arma — aparece no card da mesa.</p>'}
        </div>
      </section>

      <!-- HABILIDADES -->
      <section class="bloco">
        <h2 class="titulo-bloco"${dica(AJUDA.campos.habilidade)}>Habilidades
          <button class="btn btn-ghost btn-peq" data-add="habilidades">+ Habilidade</button></h2>
        <div class="tabela tabela-habilidades">
          <div class="tabela-cab">${[['nome', 'Nome'], ['custo', 'Custo'], ['desc', 'Descritivo']].map(([chave, titulo]) => this.cabecalhoOrdem('habilidades', chave, titulo)).join('')}<span></span></div>
          ${p.habilidades.length ? p.habilidades.map((h, i) => `
            <div class="tabela-linha">
              <input data-bind="habilidades.${i}.nome"   value="${esc(h.nome)}"   placeholder="Nome">
              <input data-bind="habilidades.${i}.custo"  value="${esc(h.custo)}"  placeholder="1 PE">
              <textarea class="habilidade-desc" data-bind="habilidades.${i}.desc" rows="3" placeholder="O que faz">${esc(h.desc)}</textarea>
              <button class="btn-mini" data-virar-ritual="${i}" title="Mover pra Rituais">⇩</button>
              <button class="btn-mini perigo" data-del="habilidades:${i}" title="Remover">✕</button>
            </div>`).join('') : '<p class="vazio-linha">Nenhum poder de classe, origem ou trilha.</p>'}
        </div>
      </section>

      <datalist id="lista-duracoes">${DURACOES.filter(Boolean).map(d => `<option value="${d}">`).join('')}</datalist>
      <datalist id="lista-resist">${['nenhuma', 'Vontade evita', 'Vontade parcial', 'Fortitude parcial', 'Reflexos reduz à metade', 'Reflexos evita'].map(d => `<option value="${d}">`).join('')}</datalist>

      <!-- RITUAIS -->
      <section class="bloco">
        <h2 class="titulo-bloco"${dica(AJUDA.campos.ritual)}>Rituais
          <span class="legenda">${p.rituais.length ? p.rituais.length + (p.rituais.length === 1 ? ' conhecido' : ' conhecidos') : ''}</span>
          <button class="btn btn-ghost btn-peq" data-catalogo-rituais>Do catálogo</button>
          <button class="btn btn-ghost btn-peq" data-add="rituais">+ Ritual</button></h2>
        <div class="grade-2">
          <div class="campo"${dica(AJUDA.campos.dtRituais)}><span>DT de rituais automática</span>
            <output id="dt-rituais" class="defesa-total">${Regras.dtRituais(p)}</output>
            <small id="dt-rituais-formula">${this.formulaDtRituais(p)}</small></div>
          <label class="campo"><span>Ajuste de DT (poderes e equipamentos)</span>
            <input type="number" data-bind="dtRituaisBonus" value="${num(p.dtRituaisBonus)}" step="1">
            <small>Inclua aqui os bônus das habilidades de trilha, poderes e itens em uso.</small></label>
        </div>
        <div class="rituais-ordenacao" aria-label="Ordenar rituais"><span>Ordenar por:</span>${[['nome', 'Nome'], ['elemento', 'Elemento'], ['circulo', 'Círculo'], ['custo', 'Custo']].map(([chave, titulo]) => this.cabecalhoOrdem('rituais', chave, titulo)).join('')}</div>
        ${p.rituais.length ? p.rituais.map((r, i) => this.cartaoRitual(p, r, i)).join('')
          : '<p class="vazio-linha">Nenhum ritual conhecido.</p>'}
      </section>

      <!-- INVENTÁRIO -->
      ${this.blocoInventario(p)}

      <!-- DESCRIÇÃO -->
      <section class="bloco">
        <h2 class="titulo-bloco">Descrição</h2>
        <div class="grade-2">
          <label class="campo"${dica(AJUDA.campos.aparencia)}><span>Aparência</span><textarea data-bind="descricao.aparencia" rows="4">${esc(p.descricao.aparencia)}</textarea></label>
          ${p.historiaCarregada === false ? '<p class="vazio-linha">Conecte-se novamente para carregar história, personalidade e objetivo.</p>' : Store.podeVerHistoria(p) ? `
          <label class="campo"${dica(AJUDA.campos.personalidade)}><span>Personalidade</span><textarea data-bind="descricao.personalidade" rows="4">${esc(p.descricao.personalidade)}</textarea></label>
          <label class="campo"${dica(AJUDA.campos.historico)}><span>Histórico</span><textarea data-bind="descricao.historico" rows="4">${esc(p.descricao.historico)}</textarea></label>
          <label class="campo"${dica(AJUDA.campos.objetivo)}><span>Objetivo</span><textarea data-bind="descricao.objetivo" rows="4">${esc(p.descricao.objetivo)}</textarea></label>` : '<p class="vazio-linha">História, personalidade e objetivo escondidos pelo jogador.</p>'}
          ${Store.podeEditar(p) ? `<label class="campo"><span>Visibilidade da história, personalidade e objetivo</span>
            <select data-bind="historiaPublica">
              <option value="false" ${p.historiaPublica !== true ? 'selected' : ''}>Escondidos</option>
              <option value="true" ${p.historiaPublica === true ? 'selected' : ''}>Visíveis para os outros jogadores</option>
            </select><small class="ajuda">Quando escondidos, só você e o mestre podem ler os três campos.</small></label>` : ''}
        </div>
        ${Store.ehMestre ? `
        <label class="campo campo-mestre"><span>Anotações do mestre 🔒</span>
          <textarea data-bind="notas" rows="3" placeholder="Segredos, ganchos, o que o jogador não sabe...">${esc(p.notas)}</textarea>
          <small class="ajuda">Fica numa tabela separada; os jogadores não recebem esse texto nem olhando a rede.</small>
        </label>` : ''}
      </section>
    </div>`;
  },

  /* O inventário fica com filtro por categoria porque a mochila de um agente
     de NEX alto passa fácil de vinte linhas e quase toda pergunta em mesa é
     por categoria ("o que eu tenho de III?"). O filtro é só de tela: não vai
     pro banco, e a linha continua editando o item pelo índice real da lista,
     por isso o `map` guarda o `i` ANTES de filtrar. */
  async carregarDescricoesInventario(p) {
    if (typeof Catalogo === 'undefined' || !p.inventario.itens.some(i => !i.descricao)) return;
    try {
      await Catalogo.carregar();
      if (this.atual?.id !== p.id) return;
      p.inventario.itens.forEach((item, i) => {
        const el = $(`[data-bind="inventario.itens.${i}.descricao"]`);
        if (el && !el.value && document.activeElement !== el) {
          el.value = Catalogo.descricaoItem(item);
          el.closest('.item-descricao').querySelector('.item-descricao-texto').textContent = el.value || 'Sem descrição.';
        }
      });
    } catch (e) { /* A consulta não impede editar o inventário offline. */ }
  },

  blocoInventario(p) {
    const itens = p.inventario.itens;
    const f = this.filtroItem;
    const conta = c => itens.filter(it => (c === 'sem' ? !it.categoria : it.categoria === c)).length;
    const semCat = conta('sem');
    const visiveis = itens
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => !f || (f === 'sem' ? !it.categoria : it.categoria === f));
    const espacos = visiveis.reduce((t, { it }) => t + num(it.espacos), 0);
    const carga = num(p.inventario.cargaMax);

    const chip = (valor, rotulo, n) => `
      <button class="chip-filtro ${f === valor ? 'ativo' : ''}" data-filtro-item="${valor}">
        ${rotulo} <i>${n}</i></button>`;

    return `
      <section class="bloco">
        <h2 class="titulo-bloco">Inventário
          <span class="legenda">${visiveis.length ? `${espacos} espaço${espacos === 1 ? '' : 's'}${!f && carga ? ' de ' + carga : ''}` : ''}</span>
          <button class="btn btn-ghost btn-peq" data-catalogo>Do catálogo</button>
          <button class="btn btn-ghost btn-peq" data-add="itens">+ Item</button></h2>
        <div class="grade-limites">
          ${CATEGORIAS_ITEM.map(c => `
            <label class="campo campo-mini"${dica(AJUDA.campos.limiteItem)}><span>Limite ${c}</span>
              <input data-bind="inventario.limites.${c}" value="${esc(p.inventario.limites[c])}"></label>`).join('')}
          <label class="campo campo-mini"${dica(AJUDA.campos.credito)}><span>Limite de crédito</span><input data-bind="inventario.credito" value="${esc(p.inventario.credito)}"></label>
          <label class="campo campo-mini"${dica(AJUDA.campos.cargaMax)}><span>Carga máx.</span><input data-bind="inventario.cargaMax" value="${esc(p.inventario.cargaMax)}"></label>
          <label class="campo campo-mini"${dica(AJUDA.campos.prestigio)}><span>Prestígio</span><input data-bind="prestigio" value="${esc(p.prestigio)}"></label>
        </div>
        ${itens.length ? `
        <div class="filtros filtros-itens">
          ${chip('', 'todos', itens.length)}
          ${CATEGORIAS_ITEM.map(c => chip(c, 'Cat. ' + c, conta(c))).join('')}
          ${semCat ? chip('sem', 'sem categoria', semCat) : ''}
        </div>` : ''}
        <div class="tabela tabela-itens">
          <div class="tabela-cab">${this.cabecalhoOrdem('itens', 'nome', 'Item')}${this.cabecalhoOrdem('itens', 'categoria', 'Categoria')}${this.cabecalhoOrdem('itens', 'espacos', 'Espaços')}<span></span></div>
          ${visiveis.length ? visiveis.map(({ it, i }) => `
            <div class="tabela-linha">
              <input data-bind="inventario.itens.${i}.nome" value="${esc(it.nome)}" placeholder="Nome do item">
              <select data-bind="inventario.itens.${i}.categoria">
                <option value="">—</option>
                ${CATEGORIAS_ITEM.map(c => `<option value="${c}" ${it.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
              <input data-bind="inventario.itens.${i}.espacos" value="${esc(it.espacos)}" placeholder="1">
              <button class="btn-mini perigo" data-del="itens:${i}" title="Remover">✕</button>
              <div class="item-descricao">
                <div class="item-descricao-acoes"><button type="button" class="btn-mini" data-ver-item aria-expanded="false">Descrição</button>
                ${Store.podeEditar(p) ? '<button type="button" class="btn-mini" data-editar-item title="Editar descrição deste item" aria-label="Editar descrição deste item" aria-expanded="false">✎</button>' : ''}</div>
                <div class="item-descricao-corpo">
                <p class="item-descricao-texto">${esc(typeof Catalogo !== 'undefined' ? Catalogo.descricaoItem(it) || 'Sem descrição.' : it.descricao || 'Sem descrição.')}</p>
                <label class="campo item-descricao-editor"><span>Descrição deste item · salva automaticamente</span><textarea data-bind="inventario.itens.${i}.descricao" rows="4" placeholder="Descrição do item">${esc(typeof Catalogo !== 'undefined' ? Catalogo.descricaoItem(it) : it.descricao || '')}</textarea></label>
                ${it.livro ? `<small>${esc(it.livro)}${it.pagina ? ', p. ' + esc(it.pagina) : ''}</small>` : ''}
                </div>
              </div>
            </div>`).join('')
            : `<p class="vazio-linha">${itens.length ? 'Nenhum item nessa categoria.' : 'Mochila vazia.'}</p>`}
        </div>
      </section>`;
  },

  caixaStatus(chave, rotulo, p) {
    return `
      <div class="caixa-status caixa-${chave}"${dica(AJUDA.campos[chave])}>
        <h3>${rotulo}</h3>
        <div class="status-nums">
          <label><span>Atuais</span><input type="number" data-bind="${chave}.atual" data-status="${chave}" value="${num(p[chave].atual)}"></label>
          <i>/</i>
          <label><span>Máx.</span><input type="number" data-bind="${chave}.max" data-status="${chave}" value="${num(p[chave].max)}"></label>
        </div>
        <div class="barra ${chave === 'pe' ? '' : 'barra-modelo'}"><div class="barra-fill ${chave}" data-barra="${chave}" style="width:${pct(p[chave].atual, p[chave].max)}%"></div>${chave !== 'pe' ? `<span class="barra-numero" data-barra-numero="${chave}">${num(p[chave].atual)}/${num(p[chave].max)}</span>` : ''}</div>
      </div>`;
  },

  linhaPericia(p, per) {
    const dado = p.pericias[per.key] || { treino: 0, outros: 0 };
    const usada = num(dado.treino) > 0 || num(dado.outros) !== 0;
    const aliado = bonusAliados(p, per.key);
    /* a dica da fórmula muda quando tem aliado somando: a pessoa precisa
       saber de onde veio aquele número a mais */
    const dicaFormula = AJUDA.campos.formula + (aliado ? ` Inclui +${aliado} de aliado.` : '');
    return `
      <div class="pericia ${usada ? 'pericia-ativa' : ''}" data-pericia="${per.key}"${dica(AJUDA.pericias[per.nome])}>
        <button class="pericia-nome" data-rolar="${per.key}"
                ${dica((AJUDA.pericias[per.nome] || '') + ' Clique pra rolar.')}>${esc(per.nome)}${per.treinada ? '<i class="ast">*</i>' : ''}</button>
        <span class="pericia-attr"${dica(AJUDA.atributos[per.attr] + ' ' + COMO_ROLA)}>${per.attr}</span>
        <select data-bind="pericias.${per.key}.treino" data-per="${per.key}"${dica(AJUDA.campos.treino)}>
          ${TREINO.map(t => `<option value="${t.v}" ${num(dado.treino) === t.v ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
        <input class="pericia-outros" type="number" data-bind="pericias.${per.key}.outros" data-per="${per.key}" value="${num(dado.outros)}"${dica(AJUDA.campos.outros)}>
        <span class="pericia-formula ${aliado ? 'com-aliado' : ''}"
              data-formula="${per.key}"${dica(dicaFormula)}>${formulaPericia(p, per.key)}</span>
      </div>`;
  },

  /* Só aparece quando a idade está preenchida: mesa que não usa a regra
     opcional não precisa ver o bloco. Jovem (17-24) é o padrão do sistema,
     então também não rende bloco nenhum. */
  blocoIdade(p) {
    const f = faixaDaIdade(p.idade);
    if (!f || (!f.beneficios.length && !f.desvantagens)) return '';

    const escolhidas = p.desvantagensIdade || [];
    const faltam = f.desvantagens - escolhidas.length;
    const aj = ajusteIdade(p);

    return `
      <section class="bloco">
        <h2 class="titulo-bloco"${dica(AJUDA.campos.pesoIdade)}>Idade
          <span class="legenda">${esc(f.nome)}, ${f.min}${f.max > 150 ? ' anos ou mais' : ' a ' + f.max + ' anos'}</span></h2>
        <p class="dialogo fraco">${esc(f.resumo)}</p>

        ${f.beneficios.length ? `<div class="idade-lista">
          ${f.beneficios.map(([n, t]) => `
            <div class="idade-item bom"><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join('')}
        </div>` : ''}

        ${f.desvantagens ? `
          <h3 class="idade-sub">O Peso da Idade
            <span class="legenda">${f.desvantagens === 1 ? 'escolha 1 desvantagem'
              : 'escolha ' + f.desvantagens + ' desvantagens'}</span>
            ${faltam > 0 ? `<span class="idade-falta">falta${faltam > 1 ? 'm' : ''} ${faltam}</span>`
              : faltam < 0 ? `<span class="idade-falta">${-faltam} a mais do que a regra pede</span>`
              : '<span class="idade-ok">completo</span>'}</h3>

          <div class="idade-escolhas">
            ${DESVANTAGENS_IDADE.map(d => {
              const on = escolhidas.includes(d.id);
              return `<label class="idade-desv ${on ? 'on' : ''}">
                <input type="checkbox" data-desv-idade="${d.id}" ${on ? 'checked' : ''}>
                <b>${esc(d.nome)}</b><span>${esc(d.efeito)}</span>
              </label>`;
            }).join('')}
          </div>

          ${(aj.pv || aj.pe) ? `<p class="idade-conta">Já descontado no cálculo de status:
            ${[aj.pv ? aj.pv + ' PV' : '', aj.pe ? aj.pe + ' PE' : ''].filter(Boolean).join(' e ')}
            (NEX ${num(p.nex)}%).</p>` : ''}
        ` : ''}
      </section>`;
  },

  /* Um ritual tem campos demais pra caber numa linha de tabela, então cada um
     vira um cartão com a faixa do Elemento na lateral. A ordem dos campos é a
     mesma do bloco impresso no livro, pra dar pra copiar de cima pra baixo. */
  cartaoRitual(p, r, i) {
    const info  = circuloInfo(r.circulo);
    const nex   = num(p.nex);
    const cedo  = p.classe === 'Ocultista' && info.nex && nex < info.nex;
    const opt   = (lista, val) => [...new Set([...lista, r[val] || ''])].map(o =>
      `<option value="${esc(o)}" ${o === (r[val] || '') ? 'selected' : ''}>${esc(o || '—')}</option>`).join('');

    return `
      <div class="ritual" style="--elem: var(--roxo)">
        <div class="ritual-cab">
          <input class="ritual-nome" data-bind="rituais.${i}.nome" value="${esc(r.nome)}" placeholder="Nome do ritual">
          <select class="ritual-elem" data-bind="rituais.${i}.elemento" data-recarrega${dica(AJUDA.campos.ritualElemento)}>
            ${r.elemento && !ELEMENTOS.some(e => e.id === r.elemento) ? `<option selected value="${esc(r.elemento)}">${esc(r.elemento)}</option>` : ''}
            ${ELEMENTOS.map(e => `<option value="${e.id}" ${e.id === (r.elemento || '') ? 'selected' : ''}>${e.nome}</option>`).join('')}
          </select>
          <select class="ritual-circ" data-circulo="${i}"${dica(AJUDA.campos.ritualCirculo)}>
            ${CIRCULOS.map(c => `<option value="${c.v}" ${c.v === String(r.circulo || '') ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select>
          <input class="ritual-pe" data-bind="rituais.${i}.custo" value="${esc(r.custo)}" placeholder="PE" title="Custo em PE">
          <button class="btn-mini perigo" data-del="rituais:${i}" title="Remover">✕</button>
        </div>

        ${cedo ? `<p class="ritual-aviso">Ocultistas precisam de NEX ${info.nex}% para acessar ${info.label.toLowerCase()}. Você está em ${nex}%.</p>` : ''}

        <div class="ritual-campos">
          <label><span>Execução</span><select data-bind="rituais.${i}.execucao">${opt(EXECUCOES, 'execucao')}</select></label>
          <label><span>Alcance</span><select data-bind="rituais.${i}.alcance">${opt(ALCANCES, 'alcance')}</select></label>
          <label${dica(AJUDA.campos.ritualAlvo)}><span>Alvo / Área</span><input data-bind="rituais.${i}.alvo" value="${esc(r.alvo)}" placeholder="1 ser"></label>
          <label><span>Duração</span><input data-bind="rituais.${i}.duracao" value="${esc(r.duracao)}" placeholder="cena" list="lista-duracoes"></label>
          <label${dica(AJUDA.campos.ritualResist)}><span>Resistência</span><input data-bind="rituais.${i}.resistencia" value="${esc(r.resistencia)}" placeholder="Vontade evita" list="lista-resist"></label>
        </div>

        <textarea class="ritual-desc" data-bind="rituais.${i}.desc" rows="5" placeholder="O que o ritual faz. Aprimoramentos (+PE) também entram aqui.">${esc(r.desc)}</textarea>
      </div>`;
  },

  cabecalhoOrdem(lista, chave, titulo) {
    const ordem = this.ordenacao[lista];
    const ativa = ordem?.chave === chave;
    const direcao = ativa && ordem.direcao === 1 ? 'decrescente' : 'crescente';
    return `<button type="button" class="ordenar-coluna" data-ordenar="${lista}:${chave}"
      ${this.atual && Store.podeEditar(this.atual) ? '' : 'disabled'}
      aria-label="Ordenar por ${titulo}, ordem ${direcao}" title="Ordenar por ${titulo} (${direcao})">${titulo}${ativa ? `<span aria-hidden="true"> ${ordem.direcao === 1 ? '↑' : '↓'}</span>` : ''}</button>`;
  },

  ordenarLista(lista, chave) {
    if (!Store.podeEditar(this.atual)) return;
    const permitidas = {
      itens: ['nome', 'categoria', 'espacos'],
      habilidades: ['nome', 'custo', 'pagina', 'desc'],
      rituais: ['nome', 'elemento', 'circulo', 'custo', 'pagina']
    };
    if (!permitidas[lista]?.includes(chave)) return;
    const anterior = this.ordenacao[lista];
    const direcao = anterior?.chave === chave ? -anterior.direcao : 1;
    this.ordenacao[lista] = { chave, direcao };
    this.listaDe(lista).sort((a, b) => this.compararOrdem(a[chave], b[chave], chave, direcao));
    Store.salvar(this.atual);
    this.abrir(this.atual.id);
    $(`[data-ordenar="${lista}:${chave}"]`)?.focus({ preventScroll: true });
  },

  compararOrdem(a, b, chave, direcao) {
    const texto = v => String(v ?? '').trim();
    a = texto(a); b = texto(b);
    // Campos sem valor ficam no fim em ambas as direções.
    if (!a || !b) return a ? -1 : b ? 1 : 0;
    const numero = v => {
      if (chave === 'categoria') {
        const romana = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
        if (romana[v.toUpperCase()] !== undefined) return romana[v.toUpperCase()];
      }
      const n = v.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
      return n ? Number(n[0]) : null;
    };
    if (['categoria', 'espacos', 'custo', 'pagina', 'circulo'].includes(chave)) {
      const na = numero(a), nb = numero(b);
      if (na !== null && nb !== null && na !== nb) return (na - nb) * direcao;
    }
    return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }) * direcao;
  },

  /* ---------------- comportamento ---------------- */

  ligar() {
    /* delegação presa uma única vez — o innerHTML muda, o listener continua valendo */
    if (this._ligado) return;
    this._ligado = true;
    const raiz = $('#view-ficha');

    /* binding genérico */
    raiz.addEventListener('input', e => {
      const caminho = e.target.dataset.bind;
      if (!caminho || !Store.podeEditar(this.atual)) return;
      const valor = caminho === 'historiaPublica' ? e.target.value === 'true' : e.target.type === 'number' ? num(e.target.value) : e.target.value;
      setPath(this.atual, caminho, valor);
      if (/^inventario\.itens\.\d+\.descricao$/.test(caminho)) {
        e.target.closest('.item-descricao').querySelector('.item-descricao-texto').textContent = valor || 'Sem descrição.';
      }
      this.salvarDepois();
      this.atualizarDerivados(e.target);
    });

    raiz.addEventListener('change', e => {
      /* O círculo decide o custo base em PE (1/3/6/10). Preenche quando o campo
         está vazio ou quando contém apenas um custo-base — inclusive o "1 PE"
         que veio junto de uma habilidade movida. Já "3 PE (5 com aprimoramento)"
         é escolha do jogador e fica intocado. */
      const circ = e.target.dataset.circulo;
      if (circ !== undefined) {
        const r = this.atual.rituais[Number(circ)];
        const cru = String(r.custo || '').trim().toLowerCase().replace(/\s*pe$/, '').trim();
        const soBase = !cru || CIRCULOS.some(c => c.pe && c.pe === cru);
        r.circulo = e.target.value;
        if (soBase) r.custo = circuloInfo(r.circulo).pe;
        Store.salvar(this.atual);
        return this.abrir(this.atual.id);
      }
      /* idade troca a faixa etária inteira; no change pra não redesenhar
         a ficha a cada tecla digitada no campo */
      if (e.target.dataset.bind === 'idade') {
        setPath(this.atual, 'idade', e.target.value);
        Store.salvar(this.atual);
        return this.abrir(this.atual.id);
      }

      /* trocar o Elemento repinta a faixa do cartão, então redesenha */
      if (e.target.dataset.bind && e.target.dataset.recarrega !== undefined) {
        setPath(this.atual, e.target.dataset.bind, e.target.value);
        Store.salvar(this.atual);
        return this.abrir(this.atual.id);
      }

      if (e.target.dataset.bind && e.target.tagName === 'SELECT') {
        const v = e.target.dataset.per ? num(e.target.value) : e.target.value;
        setPath(this.atual, e.target.dataset.bind, v);
        this.salvarDepois();
        this.atualizarDerivados(e.target);
        /* Trocar a categoria de um item muda a contagem dos chips e pode tirar
           a linha da vista: com filtro ligado, redesenha pra não mentir. */
        if (this.filtroItem && /^inventario\.itens\.\d+\.categoria$/.test(e.target.dataset.bind))
          this.abrir(this.atual.id);
      }
    });

    raiz.addEventListener('click', e => {
      const consulta = e.target.closest('[data-ver-item]');
      if (consulta) {
        const caixa = consulta.closest('.item-descricao');
        const aberta = caixa.classList.toggle('aberta');
        if (!aberta) {
          caixa.classList.remove('editando');
          caixa.querySelector('[data-editar-item]')?.setAttribute('aria-expanded', 'false');
        }
        consulta.setAttribute('aria-expanded', String(aberta));
        return;
      }
      const editarItem = e.target.closest('[data-editar-item]');
      if (editarItem) {
        if (!Store.podeEditar(this.atual)) return;
        const caixa = editarItem.closest('.item-descricao');
        const editando = caixa.classList.toggle('editando');
        caixa.classList.add('aberta');
        caixa.querySelector('[data-ver-item]').setAttribute('aria-expanded', 'true');
        editarItem.setAttribute('aria-expanded', String(editando));
        if (editando) caixa.querySelector('textarea').focus();
        return;
      }

      const ordem = e.target.closest('[data-ordenar]');
      if (ordem) return this.ordenarLista(...ordem.dataset.ordenar.split(':'));
      if (e.target.closest('[data-revisar-guia]')) return this.abrir(this.atual.id);
      if (e.target.closest('[data-voltar]'))     return this.voltar();
      if (e.target.closest('[data-excluir]'))    return this.excluir();
      if (e.target.closest('[data-trocar-img]')) return Mesa.trocarImagem(this.atual.id);
      if (e.target.closest('[data-catalogo-rituais]')) return CatalogoRituais.abrir(this.atual);
      if (e.target.closest('[data-calcular]'))   return this.calcular();

      const rolar = e.target.closest('[data-rolar]');
      if (rolar) return Rolagem.rolarPericia(this.atual, rolar.dataset.rolar);

      const dano = e.target.closest('[data-rolardano]');
      if (dano) {
        const a = this.atual.ataques[Number(dano.dataset.rolardano)];
        if (!a?.dano) return toast('Preenche o campo de dano primeiro.', 'erro');
        return Rolagem.rolarTexto(a.dano, 'Dano — ' + (a.nome || 'ataque'), this.atual.nome);
      }

      if (e.target.closest('[data-subirnex]')) return this.subirNex();

      const attr = e.target.closest('[data-attr]');
      if (attr) {
        const [k, d] = attr.dataset.attr.split(':');
        const novo = Math.max(0, num(this.atual.atributos[k]) + Number(d));
        this.atual.atributos[k] = novo;
        $(`[data-attr-input="${k}"]`, raiz).value = novo;
        this.salvarDepois();
        this.atualizarDerivados();
        return;
      }

      if (e.target.closest('[data-catalogo]')) return this.abrirCatalogo();

      const fil = e.target.closest('[data-filtro-item]');
      if (fil) {
        this.filtroItem = fil.dataset.filtroItem;
        return this.abrir(this.atual.id);
      }

      const add = e.target.closest('[data-add]');
      if (add) return this.adicionarLinha(add.dataset.add);

      const bon = e.target.closest('[data-add-bonus]');
      if (bon) {
        this.atual.aliados[Number(bon.dataset.addBonus)].bonus.push({ pericia: '', valor: 2 });
        Store.salvar(this.atual); return this.abrir(this.atual.id);
      }
      const hab = e.target.closest('[data-add-hab]');
      if (hab) {
        this.atual.aliados[Number(hab.dataset.addHab)].habilidades.push({ nome: '', custo: '', efeito: '' });
        Store.salvar(this.atual); return this.abrir(this.atual.id);
      }
      const foto = e.target.closest('[data-foto-aliado]');
      if (foto) return this.fotoAliado(Number(foto.dataset.fotoAliado));
      if (e.target.closest('[data-aliado-pronto]')) return this.aliadoPronto();

      /* Quem já tinha ritual anotado na tabela de habilidades não precisa
         redigitar: o ⇩ leva a linha inteira pro bloco de baixo. */
      const vira = e.target.closest('[data-virar-ritual]');
      if (vira) {
        const [h] = this.atual.habilidades.splice(Number(vira.dataset.virarRitual), 1);
        this.atual.rituais.push(Object.assign(
          { nome: '', elemento: '', circulo: '', custo: '', execucao: '', alcance: '',
            alvo: '', duracao: '', resistencia: '', pagina: '', desc: '' },
          { nome: h.nome, custo: h.custo, pagina: h.pagina, desc: h.desc }));
        Store.salvar(this.atual);
        return this.abrir(this.atual.id);
      }

      const desv = e.target.closest('[data-desv-idade]');
      if (desv) {
        if (!Store.podeEditar(this.atual)) return;
        const id = desv.dataset.desvIdade;
        const lista = this.atual.desvantagensIdade;
        const i = lista.indexOf(id);
        if (i >= 0) lista.splice(i, 1); else lista.push(id);
        Store.salvar(this.atual);
        return this.abrir(this.atual.id);
      }

      const del = e.target.closest('[data-del]');
      if (del) {
        const [lista, i] = del.dataset.del.split(':');
        this.listaDe(lista).splice(Number(i), 1);
        Store.salvar(this.atual);
        return this.abrir(this.atual.id);
      }
    });
  },

  /* ---------------- popup do catálogo ---------------- */

  /* Escolher de uma lista pronta em vez de digitar "Fuzil de assalto / III /
     2" na mão. O estado do popup (busca, filtros, escolhidos) fica aqui e
     não na ficha: nada disso é do personagem. */
  catalogo: { busca: '', grupo: '', categoria: '', escolhidos: [] },

  async abrirCatalogo() {
    this.catalogo = { busca: '', grupo: '', categoria: '', escolhidos: [] };
    Modal.abrir({
      titulo: 'Catálogo de itens',
      corpo: '<p class="dialogo">Carregando o catálogo…</p>',
      confirmar: 'Adicionar',
      largo: true,
      onConfirmar: () => this.adicionarDoCatalogo()
    });
    await Catalogo.carregar();
    if ($('#modal').hidden) return;          /* fechou antes de chegar */
    $('#modal-body').innerHTML = this.htmlCatalogo();
    this.ligarCatalogo();
  },

  htmlCatalogo() {
    if (!Catalogo.itens.length) {
      return `<p class="dialogo">O catálogo não carregou. Ele vive na tabela
        <b>itens_catalogo</b> do Supabase — se ela ainda não existe, rode
        <b>sql/v12-catalogo-itens.sql</b> e depois o <b>catalogo/seed-itens.sql</b>.</p>`;
    }
    return `
      <input id="cat-busca" class="busca" placeholder="Buscar item..." value="${esc(this.catalogo.busca)}">
      <div class="filtros" id="cat-grupos">
        <button type="button" class="chip-filtro ativo" data-cat-grupo="">todos</button>
        ${Catalogo.grupos().map(g =>
          `<button type="button" class="chip-filtro" data-cat-grupo="${esc(g)}">${esc(g)}</button>`).join('')}
      </div>
      <div class="filtros" id="cat-cats">
        <button type="button" class="chip-filtro ativo" data-cat-cat="">todas</button>
        ${[0, 1, 2, 3, 4].map(n => `<button type="button" class="chip-filtro" data-cat-cat="${n}">${
          n ? 'Cat. ' + Catalogo.categoriaTexto(n) : 'comum'}</button>`).join('')}
      </div>
      <div class="cat-lista" id="cat-lista">${this.linhasCatalogo()}</div>
      <p class="cat-rodape">${Catalogo.itens.length} itens dos livros${
        Catalogo.origem === 'local' ? ' · lendo o arquivo local (só no seu computador)' : ''}</p>`;
  },

  linhasCatalogo() {
    const f = this.catalogo;
    /* marca o que o agente já carrega: evita a segunda pistola sem querer */
    const jaTem = new Set(this.atual.inventario.itens
      .map(i => Catalogo.normal(i.nome).trim()).filter(Boolean));
    const lista = Catalogo.filtrar(f);
    if (!lista.length) return '<p class="vazio-linha">Nada bate com essa busca.</p>';

    return lista.map(i => {
      const idx = Catalogo.itens.indexOf(i);
      const marcado = f.escolhidos.includes(idx);
      const cat = Catalogo.categoriaTexto(i.categoria);
      const esp = Catalogo.espacosTexto(i.espacos);
      const fonte = [i.livro, i.pagina ? 'p. ' + i.pagina : ''].filter(Boolean).join(', ');
      const texto = i.descricao ? (i.descricao.length > 260 ? i.descricao.slice(0, 260) + '…' : i.descricao) : '';
      return `
        <div class="catalogo-item">
        <button type="button" class="cat-item ${marcado ? 'ativo' : ''}" data-cat="${idx}"${dica(texto)}>
          <span class="cat-marca">${marcado ? '✓' : '+'}</span>
          <span class="cat-nome">${esc(i.nome)}${
            jaTem.has(Catalogo.normal(i.nome)) ? '<i class="cat-ja">no inventário</i>' : ''}</span>
          <span class="cat-meta">
            <span class="chip-cat">${cat ? 'Cat. ' + cat : 'comum'}</span>
            ${esp ? `<span>${esp} esp.</span>` : ''}
            ${i.dano ? `<span class="cat-dano">${esc(i.dano)}</span>${
              i.critico ? `<span>crít. ${esc(i.critico)}</span>` : ''}` : ''}
            ${fonte ? `<span class="cat-livro">${esc(fonte)}</span>` : ''}
          </span>
        </button>
        <details class="catalogo-descricao"><summary>Descrição</summary><p>${esc(i.descricao || 'Descrição ainda não disponível.')}</p></details>
        </div>`;
    }).join('');
  },

  /* Só a lista é redesenhada a cada tecla; o campo de busca fica de pé, senão
     o foco (e o cursor) some na primeira letra. Por isso os três ouvintes
     moram em elementos que o redesenho não toca. */
  ligarCatalogo() {
    const busca = $('#cat-busca');
    if (!busca) return;

    busca.addEventListener('input', e => {
      this.catalogo.busca = e.target.value;
      this.redesenharCatalogo();
    });

    const grupo = (caixa, chave, attr) => caixa?.addEventListener('click', e => {
      const b = e.target.closest('[' + attr + ']');
      if (!b) return;
      this.catalogo[chave] = b.getAttribute(attr);
      $$('[' + attr + ']', caixa).forEach(x => x.classList.toggle('ativo', x === b));
      this.redesenharCatalogo();
    });
    grupo($('#cat-grupos'), 'grupo', 'data-cat-grupo');
    grupo($('#cat-cats'), 'categoria', 'data-cat-cat');

    $('#cat-lista').addEventListener('click', e => {
      const linha = e.target.closest('[data-cat]');
      if (!linha) return;
      const idx = Number(linha.dataset.cat);
      const escolhidos = this.catalogo.escolhidos;
      const i = escolhidos.indexOf(idx);
      if (i >= 0) escolhidos.splice(i, 1); else escolhidos.push(idx);
      /* mexe só na linha clicada: redesenhar a lista inteira faria o item
         saltar de lugar debaixo do dedo de quem está escolhendo vários */
      linha.classList.toggle('ativo', i < 0);
      $('.cat-marca', linha).textContent = i < 0 ? '✓' : '+';
      this.atualizarBotaoCatalogo();
    });

    busca.focus();
    this.atualizarBotaoCatalogo();
  },

  redesenharCatalogo() {
    $('#cat-lista').innerHTML = this.linhasCatalogo();
  },

  atualizarBotaoCatalogo() {
    const n = this.catalogo.escolhidos.length;
    const b = $('[data-modal-ok]');
    if (b) b.textContent = n ? `Adicionar ${n} ${n === 1 ? 'item' : 'itens'}` : 'Adicionar';
  },

  adicionarDoCatalogo() {
    const escolhidos = this.catalogo.escolhidos;
    if (!escolhidos.length) { toast('Escolha pelo menos um item da lista.', 'erro'); return false; }

    const novos = escolhidos.map(i => Catalogo.paraItemDaFicha(Catalogo.itens[i]));
    this.atual.inventario.itens.push(...novos);

    /* Um filtro de categoria ligado esconderia justamente o que acabou de
       entrar. Se algum item novo cair fora dele, volta pra "todos". */
    const escondido = it => this.filtroItem === 'sem' ? Boolean(it.categoria) : it.categoria !== this.filtroItem;
    if (this.filtroItem && novos.some(escondido)) this.filtroItem = '';

    Store.salvar(this.atual);
    this.abrir(this.atual.id);
    toast(novos.length === 1 ? 'Item adicionado ao inventário.' : novos.length + ' itens adicionados ao inventário.');
  },

  listaDe(nome) {
    if (nome === 'itens') return this.atual.inventario.itens;
    if (nome.includes('.')) return getPath(this.atual, nome);   // aliados.0.bonus
    return this.atual[nome];
  },

  /* Depois de adicionar, o cursor vai pro primeiro campo da linha NOVA.
     Endereça pelo índice em vez de contar colunas de trás pra frente: cada
     tabela tem um número diferente de campos, e errar a conta foca uma linha
     acima — o que rola a página até lá. `preventScroll` garante que focar
     nunca mexa na rolagem, nem por engano. */
  focarUltimo(nome) {
    const prefixo = nome === 'itens' ? 'inventario.itens' : nome;
    const i = this.listaDe(nome).length - 1;
    if (i < 0) return;
    $(`[data-bind^="${prefixo}.${i}."]`)?.focus({ preventScroll: true });
  },

  adicionarLinha(nome) {
    const modelos = {
      ataques:     { nome: '', teste: '', dano: '', especial: '' },
      habilidades: { nome: '', custo: '', pagina: '', desc: '' },
      rituais:     { nome: '', elemento: '', circulo: '', custo: '', execucao: '', alcance: '',
                     alvo: '', duracao: '', resistencia: '', pagina: '', desc: '' },
      itens:       { nome: '', categoria: '', espacos: '', descricao: '' },
      municoes:    { nome: '', atual: 0, max: 0 },
      aliados:     { nome: '', tipo: '', foto: '', descricao: '', bonus: [], habilidades: [] }
    };
    const novo = Object.assign({}, modelos[nome]);
    /* Com um filtro de categoria ligado, um item novo em branco sumiria na
       hora de ser criado. Ele já nasce na categoria que está sendo vista. */
    if (nome === 'itens' && this.filtroItem && this.filtroItem !== 'sem') novo.categoria = this.filtroItem;
    this.listaDe(nome).push(novo);
    Store.salvar(this.atual);
    this.abrir(this.atual.id);
    this.focarUltimo(nome);
  },

  /* atualiza só os valores calculados, sem redesenhar (não perde o foco) */
  formulaDtRituais(p) {
    return `10 + ${Regras.nivel(p.nex)} (NEX) + ${num(p.atributos?.PRE)} (PRE) + ${num(p.dtRituaisBonus)} (ajustes)`;
  },

  atualizarDerivados(alvo) {
    const p = this.atual;
    const raiz = $('#view-ficha');

    const retrato = $('.retrato-ficha', raiz), imagem = imagemPorVida(p);
    if (retrato && retrato.dataset.imagemAtual !== imagem) {
      retrato.dataset.imagemAtual = imagem;
      retrato.innerHTML = (imagem ? `<img src="${esc(imagem)}" alt="">` : `<div class="retrato-vazio" style="--h:${corDoNome(p.nome)}">${esc(iniciais(p.nome))}</div>`) + '<span class="retrato-acao">trocar imagem</span>';
    }

    const dt = $('#dt-rituais', raiz);
    if (dt) { dt.textContent = Regras.dtRituais(p); $('#dt-rituais-formula', raiz).textContent = this.formulaDtRituais(p); }

    const defTotal = $('#defesa-total', raiz);
    if (defTotal) {
      defTotal.textContent = defesaTotal(p);
      $('#def-agi', raiz).textContent = num(p.atributos.AGI);
    }

    ['pv', 'pe', 'san'].forEach(k => {
      const barra = $(`[data-barra="${k}"]`, raiz);
      if (barra) barra.style.width = pct(p[k].atual, p[k].max) + '%';
      const numero = $(`[data-barra-numero="${k}"]`, raiz);
      if (numero) numero.textContent = `${num(p[k].atual)}/${num(p[k].max)}`;
    });

    const chaves = alvo?.dataset?.per ? [alvo.dataset.per] : PERICIAS.map(x => x.key);
    chaves.forEach(k => {
      const el = $(`[data-formula="${k}"]`, raiz);
      if (!el) return;
      el.textContent = formulaPericia(p, k);
      const d = p.pericias[k];
      el.closest('.pericia').classList.toggle('pericia-ativa', num(d.treino) > 0 || num(d.outros) !== 0);
    });
  },

  calcular() {
    const p = this.atual;
    const r = Regras.status(p);
    if (!r) return toast('Escolha uma classe conhecida (Combatente, Especialista, Ocultista...).', 'erro');
    /* Frágil e Melancólico saem direto do total: são as duas desvantagens de
       idade que mexem em número que a ficha calcula sozinha. */
    const aj = ajusteIdade(p);

    Modal.abrir({
      titulo: 'Calcular status',
      corpo: `<p class="dialogo">Pela classe <b>${esc(p.classe)}</b>, NEX <b>${num(p.nex)}%</b>${p.classe === "Sobrevivente" ? `, estágio <b>${num(p.estagio,1)}</b>` : ""},
              VIG <b>${num(p.atributos.VIG)}</b> e PRE <b>${num(p.atributos.PRE)}</b>:</p>
              <ul class="lista-calc">
                <li><b>PV</b> ${r.pv}</li><li><b>PE</b> ${r.pe}</li><li><b>Sanidade</b> ${r.san}</li>
              </ul>
              ${(aj.pv || aj.pe) ? `<p class="dialogo fraco">Já com o Peso da Idade descontado:
                ${[aj.pv ? aj.pv + ' PV' : '', aj.pe ? aj.pe + ' PE' : ''].filter(Boolean).join(' e ')}.</p>` : ''}
              <p class="dialogo fraco">Isso substitui os máximos e enche os atuais. Inclui os bônus de origem em PV/PE/SAN e de Durão. Outros poderes e trilhas exigem ajustes manuais.</p>`,
      confirmar: 'Aplicar',
      onConfirmar: () => {
        p.pv  = { atual: r.pv,  max: r.pv  };
        p.pe  = { atual: r.pe,  max: r.pe  };
        p.san = { atual: r.san, max: r.san };
        p.peRodada = Regras.limitePE(p);
        Store.salvar(p);
        this.abrir(p.id);
        toast('Status calculados.');
      }
    });
  },

  aliadoPronto() {
    Modal.abrir({
      titulo: 'Aliado pronto',
      corpo: `<p class="dialogo fraco">Transcritos dos livros. Depois de adicionar dá pra mudar tudo.</p>
        ${ALIADOS_PRONTOS.map((a, i) => `
          <label class="radio aliado-opcao">
            <input type="radio" name="pronto" value="${i}" ${i === 0 ? 'checked' : ''}>
            <span><b>${esc(a.nome)}</b> — ${esc(a.descricao)}
              <i class="fonte">${esc(a.fonte)}</i></span>
          </label>`).join('')}`,
      confirmar: 'Adicionar',
      onConfirmar: () => {
        const i = Number($('input[name="pronto"]:checked').value);
        const base = JSON.parse(JSON.stringify(ALIADOS_PRONTOS[i]));
        delete base.fonte;
        this.atual.aliados.push(Object.assign({ foto: '' }, base));
        Store.salvar(this.atual);
        this.abrir(this.atual.id);
      }
    });
  },

  fotoAliado(i) {
    const p = this.atual;
    Modal.abrir({
      titulo: 'Foto do aliado',
      corpo: `<label class="campo"><span>Arquivo</span><input type="file" id="al-foto" accept="image/*"></label>
              <div class="previa" id="al-previa">${p.aliados[i].foto ? `<img src="${esc(p.aliados[i].foto)}">` : '<span class="fraco">sem foto</span>'}</div>`,
      confirmar: 'Salvar',
      onConfirmar: async () => {
        if (Modal._fotoAliado === undefined) return;
        try {
          p.aliados[i].foto = Modal._fotoAliado
            ? await Nuvem.enviarRetrato(Modal._fotoAliado, App.mesa.id, 'aliado') : '';
          Store.salvar(p);
          this.abrir(p.id);
        } catch (e) { toast('Erro: ' + (e.message || e), 'erro'); return false; }
        finally { delete Modal._fotoAliado; }
      }
    });
    $('#al-foto').addEventListener('change', async e => {
      try {
        const d = await lerImagem(e.target.files[0]);
        Modal._fotoAliado = d;
        $('#al-previa').innerHTML = `<img src="${d}">`;
      } catch { toast('Não consegui ler a imagem.', 'erro'); }
    });
  },

  subirNex() {
    const p = this.atual;
    if (p.classe === 'Sobrevivente') return Regras.subirEstagio(p);
    if (Regras.civil(p)) return toast('Sobrevivente evolui por estágio; Mundano precisa de treinamento para mudar de classe. Consulte o guia.', 'erro');
    if (num(p.nex) >= 99) return toast('NEX máximo atingido.');
    const nexNovo = Math.min(99, num(p.nex) + 5);
    const antes = Regras.status(p);
    const depois = Regras.status({...p, nex: nexNovo});
    if (!antes || !depois)
      return toast('Escolha uma classe conhecida (Combatente, Especialista, Ocultista...).', 'erro');

    /* Frágil e Melancólico tiram por NEX — então o desconto cresce junto com
       o nível, e o ganho real da subida é menor do que o da tabela da classe. */
    const ajA = ajusteIdade(p);
    const ajD = ajusteIdade(Object.assign({}, p, { nex: nexNovo }));


    const linha = (r, a, d) => `<li><b>${r}</b> ${a} → ${d} <em>(+${d - a})</em></li>`;
    Modal.abrir({
      titulo: `Subir para NEX ${nexNovo}%`,
      corpo: `<p class="dialogo">De <b>${num(p.nex)}%</b> para <b>${nexNovo}%</b> como <b>${esc(p.classe)}</b>:</p>
              <ul class="lista-calc">
                ${linha('PV', antes.pv, depois.pv)}
                ${linha('PE', antes.pe, depois.pe)}
                ${linha('Sanidade', antes.san, depois.san)}
              </ul>
              <p class="dialogo fraco">Os máximos sobem e a diferença é somada aos atuais — quem estava ferido continua ferido.
              Perícias, trilha e habilidades novas você escolhe na mão.</p>`,
      confirmar: 'Subir NEX',
      onConfirmar: () => {
        ['pv', 'pe', 'san'].forEach(k => {
          const ganho = depois[k] - antes[k];
          p[k].max = num(p[k].max) + ganho;
          p[k].atual = Math.min(p[k].max, num(p[k].atual) + ganho);
        });
        p.nex = nexNovo;
        p.peRodada = Regras.limitePE(p);
        Store.salvar(p);
        this.abrir(p.id);
        toast(`Agora é NEX ${nexNovo}%.`);
      }
    });
  },

  excluir() {
    const p = this.atual;
    Modal.abrir({
      titulo: 'Excluir agente',
      corpo: `<p class="dialogo">Apagar a ficha de <b>${esc(p.nome || 'sem nome')}</b> de vez? Não dá pra desfazer.</p>`,
      confirmar: 'Excluir', perigo: true,
      onConfirmar: async () => {
        try { await Store.remover(p.id); this.voltar(); toast('Ficha excluída.'); }
        catch (e) { toast('Não consegui excluir: ' + (e.message || e), 'erro'); }
      }
    });
  },

  salvarDepois() {
    clearTimeout(this._t);
    const ind = $('#indicador-salvo');
    if (ind) { ind.textContent = 'salvando...'; ind.classList.add('salvando'); }
    this._t = setTimeout(() => {
      Store.salvar(this.atual);
      if (ind) { ind.textContent = 'salvo na nuvem'; ind.classList.remove('salvando'); }
    }, 400);
  }
};
