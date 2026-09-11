/* Tela da ficha de agente completa */

const Ficha = {
  atual: null,

  abrir(id) {
    this.atual = Store.obter(id);
    if (!this.atual) return;
    App.mostrar('ficha');
    $('#view-ficha').innerHTML = this.html(this.atual);
    window.scrollTo(0, 0);
    this.ligar();
    if (!Store.podeEditar(this.atual)) this.travar();
  },

  /* Jogador abrindo ficha que não é dele: dá pra consultar, não dá pra mexer. */
  travar() {
    const raiz = $('#view-ficha');
    $$('input, select, textarea', raiz).forEach(el => { el.disabled = true; });
    $$('[data-add], [data-del], [data-attr], [data-excluir], [data-calcular]', raiz)
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
          ${p.imagem ? `<img src="${esc(p.imagem)}" alt="">`
                     : `<div class="retrato-vazio" style="--h:${corDoNome(p.nome)}">${esc(iniciais(p.nome))}</div>`}
          <span class="retrato-acao">trocar imagem</span>
        </div>

        <div class="identidade-campos">
          <label class="campo campo-destaque"><span>Personagem</span>
            <input data-bind="nome" value="${esc(p.nome)}" placeholder="Nome do agente"></label>
          <div class="grade-3">
            <label class="campo"><span>Jogador</span><input data-bind="jogador" value="${esc(p.jogador)}"></label>
            <label class="campo"><span>Origem</span>
              <input data-bind="origem" value="${esc(p.origem)}" list="dl-origens">
              <datalist id="dl-origens">${ORIGENS.map(o => `<option value="${esc(o)}">`).join('')}</datalist></label>
            <label class="campo"><span>Classe</span>
              <input data-bind="classe" value="${esc(p.classe)}" list="dl-classes">
              <datalist id="dl-classes">${CLASSES.map(o => `<option value="${esc(o)}">`).join('')}</datalist></label>
          </div>
          <div class="grade-4">
            <label class="campo"><span>NEX %</span><input type="number" data-bind="nex" value="${num(p.nex)}" min="0" max="99" step="5"></label>
            <label class="campo"><span>Deslocamento</span><input type="number" data-bind="desl" value="${num(p.desl)}"></label>
            <label class="campo"><span>PE / rodada</span><input data-bind="peRodada" value="${esc(p.peRodada)}"></label>
            <label class="campo"><span>Patente</span>
              <input data-bind="patente" value="${esc(p.patente)}" list="dl-patentes">
              <datalist id="dl-patentes">${PATENTES.map(o => `<option value="${esc(o)}">`).join('')}</datalist></label>
          </div>
        </div>
      </section>

      <!-- ATRIBUTOS -->
      <section class="bloco">
        <h2 class="titulo-bloco">Atributos</h2>
        <div class="atributos">
          ${ATRIBUTOS.map(a => `
            <div class="atributo">
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
          <button class="btn btn-ghost btn-peq" data-subirnex title="Avança 5% de NEX e recalcula">▲ Subir NEX</button>
        </h2>
        <div class="status-grade">
          ${this.caixaStatus('pv',  'Pontos de Vida',    p)}
          ${this.caixaStatus('pe',  'Pontos de Esforço', p)}
          ${this.caixaStatus('san', 'Sanidade',          p)}

          <div class="caixa-status caixa-defesa">
            <h3>Defesa</h3>
            <div class="defesa-total" id="defesa-total">${defesaTotal(p)}</div>
            <p class="formula">10 + AGI (<span id="def-agi">${num(p.atributos.AGI)}</span>) + equip. + outros</p>
            <div class="grade-2">
              <label class="campo"><span>Equipamento</span><input type="number" data-bind="defesa.equip" data-def value="${num(p.defesa.equip)}"></label>
              <label class="campo"><span>Outros</span><input type="number" data-bind="defesa.outros" data-def value="${num(p.defesa.outros)}"></label>
            </div>
          </div>
        </div>
        <div class="grade-2 espaco-topo">
          <label class="campo"><span>Proteção</span><input data-bind="protecao" value="${esc(p.protecao)}" placeholder="Ex.: Colete balístico"></label>
          <label class="campo"><span>Resistências</span><input data-bind="resistencias" value="${esc(p.resistencias)}" placeholder="Ex.: Balístico 5, Sangue 2"></label>
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
          <div class="tabela-cab"><span>Ataque</span><span>Teste</span><span>Dano</span><span>Crítico / Alcance / Especial</span><span></span></div>
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
        <h2 class="titulo-bloco">Aliados
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
        <h2 class="titulo-bloco">Munição
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

      <!-- HABILIDADES E RITUAIS -->
      <section class="bloco">
        <h2 class="titulo-bloco">Habilidades &amp; Rituais
          <button class="btn btn-ghost btn-peq" data-add="habilidades">+ Habilidade</button></h2>
        <label class="campo campo-curto"><span>DT de rituais</span><input data-bind="dtRituais" value="${esc(p.dtRituais)}" placeholder="Ex.: 15"></label>
        <div class="tabela tabela-habilidades">
          <div class="tabela-cab"><span>Nome</span><span>Custo</span><span>Página</span><span>Descritivo</span><span></span></div>
          ${p.habilidades.length ? p.habilidades.map((h, i) => `
            <div class="tabela-linha">
              <input data-bind="habilidades.${i}.nome"   value="${esc(h.nome)}"   placeholder="Nome">
              <input data-bind="habilidades.${i}.custo"  value="${esc(h.custo)}"  placeholder="1 PE">
              <input data-bind="habilidades.${i}.pagina" value="${esc(h.pagina)}" placeholder="p. 00">
              <input data-bind="habilidades.${i}.desc"   value="${esc(h.desc)}"   placeholder="O que faz">
              <button class="btn-mini perigo" data-del="habilidades:${i}" title="Remover">✕</button>
            </div>`).join('') : '<p class="vazio-linha">Nenhuma habilidade ou ritual cadastrado.</p>'}
        </div>
      </section>

      <!-- INVENTÁRIO -->
      <section class="bloco">
        <h2 class="titulo-bloco">Inventário <button class="btn btn-ghost btn-peq" data-add="itens">+ Item</button></h2>
        <div class="grade-limites">
          ${CATEGORIAS_ITEM.map(c => `
            <label class="campo campo-mini"><span>Limite ${c}</span>
              <input data-bind="inventario.limites.${c}" value="${esc(p.inventario.limites[c])}"></label>`).join('')}
          <label class="campo campo-mini"><span>Limite de crédito</span><input data-bind="inventario.credito" value="${esc(p.inventario.credito)}"></label>
          <label class="campo campo-mini"><span>Carga máx.</span><input data-bind="inventario.cargaMax" value="${esc(p.inventario.cargaMax)}"></label>
          <label class="campo campo-mini"><span>Prestígio</span><input data-bind="prestigio" value="${esc(p.prestigio)}"></label>
        </div>
        <div class="tabela tabela-itens">
          <div class="tabela-cab"><span>Item</span><span>Categoria</span><span>Espaços</span><span></span></div>
          ${p.inventario.itens.length ? p.inventario.itens.map((it, i) => `
            <div class="tabela-linha">
              <input data-bind="inventario.itens.${i}.nome" value="${esc(it.nome)}" placeholder="Nome do item">
              <select data-bind="inventario.itens.${i}.categoria">
                <option value="">—</option>
                ${CATEGORIAS_ITEM.map(c => `<option value="${c}" ${it.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
              <input data-bind="inventario.itens.${i}.espacos" value="${esc(it.espacos)}" placeholder="1">
              <button class="btn-mini perigo" data-del="itens:${i}" title="Remover">✕</button>
            </div>`).join('') : '<p class="vazio-linha">Mochila vazia.</p>'}
        </div>
      </section>

      <!-- DESCRIÇÃO -->
      <section class="bloco">
        <h2 class="titulo-bloco">Descrição</h2>
        <div class="grade-2">
          <label class="campo"><span>Aparência</span><textarea data-bind="descricao.aparencia" rows="4">${esc(p.descricao.aparencia)}</textarea></label>
          <label class="campo"><span>Personalidade</span><textarea data-bind="descricao.personalidade" rows="4">${esc(p.descricao.personalidade)}</textarea></label>
          <label class="campo"><span>Histórico</span><textarea data-bind="descricao.historico" rows="4">${esc(p.descricao.historico)}</textarea></label>
          <label class="campo"><span>Objetivo</span><textarea data-bind="descricao.objetivo" rows="4">${esc(p.descricao.objetivo)}</textarea></label>
        </div>
        ${Store.ehMestre ? `
        <label class="campo campo-mestre"><span>Anotações do mestre 🔒</span>
          <textarea data-bind="notas" rows="3" placeholder="Segredos, ganchos, o que o jogador não sabe...">${esc(p.notas)}</textarea>
          <small class="ajuda">Fica numa tabela separada; os jogadores não recebem esse texto nem olhando a rede.</small>
        </label>` : ''}
      </section>
    </div>`;
  },

  caixaStatus(chave, rotulo, p) {
    return `
      <div class="caixa-status caixa-${chave}">
        <h3>${rotulo}</h3>
        <div class="status-nums">
          <label><span>Atuais</span><input type="number" data-bind="${chave}.atual" data-status="${chave}" value="${num(p[chave].atual)}"></label>
          <i>/</i>
          <label><span>Máx.</span><input type="number" data-bind="${chave}.max" data-status="${chave}" value="${num(p[chave].max)}"></label>
        </div>
        <div class="barra"><div class="barra-fill ${chave}" data-barra="${chave}" style="width:${pct(p[chave].atual, p[chave].max)}%"></div></div>
      </div>`;
  },

  linhaPericia(p, per) {
    const dado = p.pericias[per.key] || { treino: 0, outros: 0 };
    const usada = num(dado.treino) > 0 || num(dado.outros) !== 0;
    return `
      <div class="pericia ${usada ? 'pericia-ativa' : ''}" data-pericia="${per.key}">
        <button class="pericia-nome" data-rolar="${per.key}" title="Clique para rolar">${esc(per.nome)}${per.treinada ? '<i class="ast">*</i>' : ''}</button>
        <span class="pericia-attr">${per.attr}</span>
        <select data-bind="pericias.${per.key}.treino" data-per="${per.key}">
          ${TREINO.map(t => `<option value="${t.v}" ${num(dado.treino) === t.v ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
        <input class="pericia-outros" type="number" data-bind="pericias.${per.key}.outros" data-per="${per.key}" value="${num(dado.outros)}" title="Outros bônus">
        <span class="pericia-formula ${bonusAliados(p, per.key) ? 'com-aliado' : ''}"
              data-formula="${per.key}"
              title="${bonusAliados(p, per.key) ? '+' + bonusAliados(p, per.key) + ' de aliado' : ''}">${formulaPericia(p, per.key)}</span>
      </div>`;
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
      if (!caminho) return;
      const valor = e.target.type === 'number' ? num(e.target.value) : e.target.value;
      setPath(this.atual, caminho, valor);
      this.salvarDepois();
      this.atualizarDerivados(e.target);
    });

    raiz.addEventListener('change', e => {
      if (e.target.dataset.bind && e.target.tagName === 'SELECT') {
        const v = e.target.dataset.per ? num(e.target.value) : e.target.value;
        setPath(this.atual, e.target.dataset.bind, v);
        this.salvarDepois();
        this.atualizarDerivados(e.target);
      }
    });

    raiz.addEventListener('click', e => {
      if (e.target.closest('[data-voltar]'))     return this.voltar();
      if (e.target.closest('[data-excluir]'))    return this.excluir();
      if (e.target.closest('[data-trocar-img]')) return Mesa.trocarImagem(this.atual.id);
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

      const del = e.target.closest('[data-del]');
      if (del) {
        const [lista, i] = del.dataset.del.split(':');
        this.listaDe(lista).splice(Number(i), 1);
        Store.salvar(this.atual);
        return this.abrir(this.atual.id);
      }
    });
  },

  listaDe(nome) {
    if (nome === 'itens') return this.atual.inventario.itens;
    if (nome.includes('.')) return getPath(this.atual, nome);   // aliados.0.bonus
    return this.atual[nome];
  },

  adicionarLinha(nome) {
    const modelos = {
      ataques:     { nome: '', teste: '', dano: '', especial: '' },
      habilidades: { nome: '', custo: '', pagina: '', desc: '' },
      itens:       { nome: '', categoria: '', espacos: '' },
      municoes:    { nome: '', atual: 0, max: 0 },
      aliados:     { nome: '', tipo: '', foto: '', descricao: '', bonus: [], habilidades: [] }
    };
    this.listaDe(nome).push(Object.assign({}, modelos[nome]));
    Store.salvar(this.atual);
    this.abrir(this.atual.id);
  },

  /* atualiza só os valores calculados, sem redesenhar (não perde o foco) */
  atualizarDerivados(alvo) {
    const p = this.atual;
    const raiz = $('#view-ficha');

    const defTotal = $('#defesa-total', raiz);
    if (defTotal) {
      defTotal.textContent = defesaTotal(p);
      $('#def-agi', raiz).textContent = num(p.atributos.AGI);
    }

    ['pv', 'pe', 'san'].forEach(k => {
      const barra = $(`[data-barra="${k}"]`, raiz);
      if (barra) barra.style.width = pct(p[k].atual, p[k].max) + '%';
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
    const r = calcularStatus(p.classe, p.nex, p.atributos);
    if (!r) return toast('Escolha uma classe conhecida (Combatente, Especialista, Ocultista...).', 'erro');
    Modal.abrir({
      titulo: 'Calcular status',
      corpo: `<p class="dialogo">Pela classe <b>${esc(p.classe)}</b>, NEX <b>${num(p.nex)}%</b>,
              VIG <b>${num(p.atributos.VIG)}</b> e PRE <b>${num(p.atributos.PRE)}</b>:</p>
              <ul class="lista-calc">
                <li><b>PV</b> ${r.pv}</li><li><b>PE</b> ${r.pe}</li><li><b>Sanidade</b> ${r.san}</li>
              </ul>
              <p class="dialogo fraco">Isso substitui os máximos e enche os atuais. Habilidades e trilhas que dão bônus extras você ajusta na mão depois.</p>`,
      confirmar: 'Aplicar',
      onConfirmar: () => {
        p.pv  = { atual: r.pv,  max: r.pv  };
        p.pe  = { atual: r.pe,  max: r.pe  };
        p.san = { atual: r.san, max: r.san };
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
    const nexNovo = Math.min(99, num(p.nex) + 5);
    const antes = calcularStatus(p.classe, p.nex, p.atributos);
    const depois = calcularStatus(p.classe, nexNovo, p.atributos);
    if (!antes || !depois)
      return toast('Escolha uma classe conhecida (Combatente, Especialista, Ocultista...).', 'erro');

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
          p[k].max = depois[k];
          p[k].atual = Math.min(depois[k], num(p[k].atual) + ganho);
        });
        p.nex = nexNovo;
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
