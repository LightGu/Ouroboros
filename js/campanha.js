/* Caderno de campanha do mestre: anotações ligadas por [[links]] + visão em grafo */

const TIPOS = [
  { nome: 'NPC',      h: 0   },
  { nome: 'Mistério', h: 275 },
  { nome: 'Pista',    h: 45  },
  { nome: 'Local',    h: 195 },
  { nome: 'Sessão',   h: 135 },
  { nome: 'Nota',     h: 220 }
];

const Campanha = {
  lista: [],
  aberta: null,
  soMinhas: false,
  vista: 'lista',        // 'lista' | 'grafo'
  busca: '',
  filtroTipo: '',

  async carregar() {
    try { this.lista = await Nuvem.anotacoes(App.mesa.id); this.render(); }
    catch (e) { $('#campanha-corpo').innerHTML = `<p class="vazio-linha">Erro: ${esc(e.message || e)}</p>`; }
  },

  /* ---------------- links ---------------- */

  /* [[Assim]] — mesmo formato do Obsidian */
  linksDe(nota) {
    const achados = String(nota.texto || '').match(/\[\[([^\]\n]+)\]\]/g) || [];
    return [...new Set(achados.map(x => x.slice(2, -2).trim()).filter(Boolean))];
  },

  porTitulo(t) {
    const alvo = String(t).trim().toLowerCase();
    return this.lista.find(n => n.titulo.trim().toLowerCase() === alvo);
  },

  backlinks(nota) {
    const meu = nota.titulo.trim().toLowerCase();
    return this.lista.filter(n => n.id !== nota.id &&
      this.linksDe(n).some(l => l.trim().toLowerCase() === meu));
  },

  nomeAutor(n) {
    return (Celular.membros || []).find(m => m.id === n.autor_id)?.nome || 'alguém';
  },

  corDoTipo(tipo) {
    return (TIPOS.find(t => t.nome === tipo) || TIPOS[TIPOS.length - 1]).h;
  },

  /* ---------------- desenho ---------------- */

  render() {
    this.renderBarra();
    if (this.vista === 'grafo') return this.renderGrafo();
    this.renderLista();
  },

  renderBarra() {
    const tipos = [...new Set(this.lista.map(n => n.tipo))].sort();
    $('#campanha-barra').innerHTML = `
      <button class="btn btn-primary btn-peq" id="btn-nova-nota">+ Anotação</button>
      ${this.temDeOutros() ? `<button class="chip-filtro ${this.soMinhas ? 'ativo' : ''}" id="btn-so-minhas">só as minhas</button>` : ''}
      <button class="btn btn-ghost btn-peq" id="btn-importar-notas" title="Markdown ou JSON">↥ Importar</button>
      <button class="btn btn-ghost btn-peq" id="btn-exportar-notas" title="Backup em JSON">↧ Exportar</button>
      <div class="sep"></div>
      <div class="grupo-modo">
        <button class="btn btn-peq ${this.vista === 'lista' ? 'ativo' : ''}" data-vista="lista">☰ Lista</button>
        <button class="btn btn-peq ${this.vista === 'grafo' ? 'ativo' : ''}" data-vista="grafo">◉ Grafo</button>
      </div>
      <input id="campanha-busca" class="busca" placeholder="Buscar título, texto ou etiqueta..." value="${esc(this.busca)}">
      <div class="filtros">
        <button class="chip-filtro ${!this.filtroTipo ? 'ativo' : ''}" data-tipo="">todos</button>
        ${tipos.map(t => `<button class="chip-filtro ${this.filtroTipo === t ? 'ativo' : ''}"
           data-tipo="${esc(t)}" style="--h:${this.corDoTipo(t)}">${esc(t)}</button>`).join('')}
      </div>
      <div class="cresce"></div>
      <span class="dica-som">${this.lista.length} anotações · só você vê</span>`;

    $('#btn-nova-nota').addEventListener('click', () => this.nova());
    $('#btn-so-minhas')?.addEventListener('click', () => { this.soMinhas = !this.soMinhas; this.render(); });
    $('#btn-importar-notas').addEventListener('click', () => this.modalImportar());
    $('#btn-exportar-notas').addEventListener('click', () => this.exportar());
    $$('#campanha-barra [data-vista]').forEach(b => b.addEventListener('click', () => {
      this.vista = b.dataset.vista; this.render();
    }));
    $('#campanha-busca').addEventListener('input', e => {
      this.busca = e.target.value;
      this.vista === 'grafo' ? this.destacarGrafo() : this.renderLista();
    });
    $$('#campanha-barra [data-tipo]').forEach(b => b.addEventListener('click', () => {
      this.filtroTipo = b.dataset.tipo; this.render();
    }));
  },

  minhaEh(n) { return n.autor_id === App.sessao?.user?.id; },
  temDeOutros() { return this.lista.some(n => !this.minhaEh(n)); },

  filtradas() {
    const b = this.busca.trim().toLowerCase();
    return this.lista.filter(n =>
      (!this.soMinhas || this.minhaEh(n)) &&
      (!this.filtroTipo || n.tipo === this.filtroTipo) &&
      (!b || (n.titulo + ' ' + n.texto + ' ' + (n.etiquetas || []).join(' ')).toLowerCase().includes(b)));
  },

  renderLista() {
    const lista = this.filtradas();
    const corpo = $('#campanha-corpo');
    if (!lista.length) {
      corpo.innerHTML = `<div class="vazio">
        <div class="vazio-mark">✦</div>
        <h2>${this.lista.length ? 'Nada bate com esse filtro' : 'Caderno vazio'}</h2>
        <p>${this.lista.length ? 'Tenta outra busca.'
          : 'Anote NPCs, mistérios, pistas e locais. Escreva <b>[[Nome de outra anotação]]</b> no texto pra ligar as duas — o grafo se monta sozinho.'}</p>
        ${this.lista.length ? '' : '<div class="vazio-btns"><button class="btn btn-primary" onclick="Campanha.nova()">+ Primeira anotação</button></div>'}
      </div>`;
      return;
    }

    corpo.innerHTML = `<div class="notas-grade">${lista.map(n => {
      const links = this.linksDe(n).length;
      const back = this.backlinks(n).length;
      return `
      <article class="nota" data-nota="${n.id}" style="--h:${this.corDoTipo(n.tipo)}">
        <header class="nota-cab">
          <span class="nota-tipo">${esc(n.tipo)}</span>
          ${n.compartilhada ? '<span class="nota-selo" title="Todo mundo da mesa vê">compartilhada</span>' : ''}
          ${!this.minhaEh(n) ? `<span class="nota-autor">de ${esc(this.nomeAutor(n))}</span>` : ''}
          ${n.fixada ? '<span class="nota-fixada" title="Fixada">★</span>' : ''}
        </header>
        <h3 class="nota-titulo">${esc(n.titulo)}</h3>
        <p class="nota-previa">${esc(String(n.texto || '').replace(/\[\[|\]\]/g, '').slice(0, 160)) || '<span class="fraco">sem texto</span>'}</p>
        <footer class="nota-pe">
          ${(n.etiquetas || []).map(t => `<span class="chip-cat">#${esc(t)}</span>`).join('')}
          <span class="cresce"></span>
          ${links ? `<span class="nota-liga" title="Links que saem">→ ${links}</span>` : ''}
          ${back ? `<span class="nota-liga" title="Menções a esta">← ${back}</span>` : ''}
        </footer>
      </article>`;
    }).join('')}</div>`;

    $$('.nota', corpo).forEach(el =>
      el.addEventListener('click', () => this.abrir(el.dataset.nota)));
  },

  /* ---------------- editor ---------------- */

  nova(titulo = '') {
    Modal.abrir({
      titulo: 'Nova anotação',
      corpo: `
        <div class="grade-2">
          <label class="campo"><span>Título *</span><input id="nn-titulo" value="${esc(titulo)}" placeholder="Dr. Aldo Ferrari"></label>
          <label class="campo"><span>Tipo</span>
            <select id="nn-tipo">${TIPOS.map(t => `<option>${t.nome}</option>`).join('')}</select></label>
        </div>
        <label class="campo"><span>Etiquetas (separadas por vírgula)</span>
          <input id="nn-tags" placeholder="hospital, suspeito"></label>`,
      confirmar: 'Criar',
      onConfirmar: async () => {
        const t = $('#nn-titulo').value.trim();
        if (!t) { toast('Precisa de um título.', 'erro'); return false; }
        if (this.porTitulo(t)) { toast('Já existe uma anotação com esse título.', 'erro'); return false; }
        try {
          const n = await Nuvem.criarAnotacao({
            mesa_id: App.mesa.id, titulo: t, tipo: $('#nn-tipo').value,
            etiquetas: $('#nn-tags').value.split(',').map(x => x.trim()).filter(Boolean), texto: ''
          });
          this.lista.unshift(n);
          this.render();
          this.abrir(n.id);
        } catch (e) { toast('Erro: ' + (e.message || e), 'erro'); return false; }
      }
    });
  },

  abrir(id) {
    const n = this.lista.find(x => x.id === id);
    if (!n) return;
    this.aberta = n;
    $('#painel-nota').hidden = false;
    this.renderNota();
  },

  fecharNota() {
    this.aberta = null;
    $('#painel-nota').hidden = true;
    this.render();
  },

  renderNota() {
    const n = this.aberta;
    const back = this.backlinks(n);
    const saem = this.linksDe(n);

    $('#painel-nota').innerHTML = `
      <header class="painel-cab">
        <span class="nota-tipo" style="--h:${this.corDoTipo(n.tipo)}">${esc(n.tipo)}</span>
        <div class="cresce"></div>
        <span class="salvo" id="nota-salvo"></span>
        <button class="btn btn-icon btn-ghost" id="nota-fechar">✕</button>
      </header>
      <div class="nota-editor">
        <input class="nota-titulo-inp" id="an-titulo" value="${esc(n.titulo)}">
        <div class="nota-meta">
          <select id="an-tipo">${TIPOS.map(t => `<option ${t.nome === n.tipo ? 'selected' : ''}>${t.nome}</option>`).join('')}</select>
          <input id="an-tags" value="${esc((n.etiquetas || []).join(', '))}" placeholder="etiquetas, separadas, por vírgula">
          <button class="btn-mini ${n.fixada ? 'ativo' : ''}" id="an-fixar" title="Fixar">★</button>
          <button class="btn-mini ${n.compartilhada ? 'ativo' : ''}" id="an-partilhar"
                  title="${n.compartilhada ? 'Todo mundo da mesa vê' : 'Só você vê'}">${n.compartilhada ? '👁' : '🔒'}</button>
          <button class="btn-mini perigo" id="an-apagar" title="Apagar">✕</button>
        </div>
        <textarea id="an-texto" class="nota-texto" placeholder="Escreva aqui.&#10;&#10;Use [[Nome de outra anotação]] pra ligar as duas — digite [[ que eu sugiro os títulos.">${esc(n.texto || '')}</textarea>
        <div id="an-sugestoes" class="sugestoes" hidden></div>

        ${saem.length ? `<div class="nota-links"><h4>Aponta para</h4>${saem.map(l => {
          const alvo = this.porTitulo(l);
          return `<button class="link-nota ${alvo ? '' : 'quebrado'}" data-ir="${esc(l)}">${esc(l)}${alvo ? '' : ' <i>criar</i>'}</button>`;
        }).join('')}</div>` : ''}

        ${back.length ? `<div class="nota-links"><h4>Mencionada em</h4>${back.map(b =>
          `<button class="link-nota" data-abrir-id="${b.id}">${esc(b.titulo)}</button>`).join('')}</div>` : ''}
      </div>`;

    $('#nota-fechar').addEventListener('click', () => this.fecharNota());
    $('#an-apagar').addEventListener('click', () => this.apagar(n));
    $('#an-fixar').addEventListener('click', () => {
      n.fixada = !n.fixada; this.gravar(n, { fixada: n.fixada }); this.renderNota(); this.render();
    });
    $('#an-partilhar').addEventListener('click', () => {
      n.compartilhada = !n.compartilhada;
      this.gravar(n, { compartilhada: n.compartilhada });
      toast(n.compartilhada ? 'Agora todo mundo da mesa vê.' : 'Voltou a ser só sua.');
      this.renderNota(); this.render();
    });

    /* anotação de outra pessoa: dá pra ler, não pra mexer */
    if (!this.minhaEh(n)) {
      $$('#painel-nota input, #painel-nota textarea, #painel-nota select').forEach(el => el.disabled = true);
      $$('#an-fixar, #an-partilhar, #an-apagar').forEach(el => el.remove());
      $('#nota-salvo').textContent = 'de ' + this.nomeAutor(n) + ' — somente leitura';
    }

    const campos = { titulo: '#an-titulo', tipo: '#an-tipo', texto: '#an-texto' };
    Object.entries(campos).forEach(([chave, sel]) => {
      $(sel).addEventListener('input', e => {
        n[chave] = e.target.value;
        this.gravar(n, { [chave]: e.target.value });
        if (chave === 'texto') this.autocompletar(e.target);
      });
    });
    $('#an-tags').addEventListener('input', e => {
      n.etiquetas = e.target.value.split(',').map(x => x.trim()).filter(Boolean);
      this.gravar(n, { etiquetas: n.etiquetas });
    });

    $$('[data-ir]', $('#painel-nota')).forEach(b => b.addEventListener('click', () => {
      const alvo = this.porTitulo(b.dataset.ir);
      alvo ? this.abrir(alvo.id) : this.nova(b.dataset.ir);
    }));
    $$('[data-abrir-id]', $('#painel-nota')).forEach(b =>
      b.addEventListener('click', () => this.abrir(b.dataset.abrirId)));
  },

  /* sugere títulos existentes quando você digita [[ */
  autocompletar(ta) {
    const cx = $('#an-sugestoes');
    const antes = ta.value.slice(0, ta.selectionStart);
    const m = antes.match(/\[\[([^\]\n]*)$/);
    if (!m) { cx.hidden = true; return; }

    const termo = m[1].toLowerCase();
    const cands = this.lista
      .filter(x => x.id !== this.aberta.id && x.titulo.toLowerCase().includes(termo))
      .slice(0, 6);
    if (!cands.length) { cx.hidden = true; return; }

    cx.hidden = false;
    cx.innerHTML = cands.map(c =>
      `<button data-sug="${esc(c.titulo)}"><b>${esc(c.titulo)}</b> <i>${esc(c.tipo)}</i></button>`).join('');
    $$('button', cx).forEach(b => b.addEventListener('click', () => {
      const pos = ta.selectionStart;
      const inicio = antes.lastIndexOf('[[');
      ta.value = ta.value.slice(0, inicio) + '[[' + b.dataset.sug + ']]' + ta.value.slice(pos);
      ta.focus();
      const novo = inicio + b.dataset.sug.length + 4;
      ta.setSelectionRange(novo, novo);
      cx.hidden = true;
      this.aberta.texto = ta.value;
      this.gravar(this.aberta, { texto: ta.value });
    }));
  },

  gravar(n, campos) {
    const ind = $('#nota-salvo');
    if (ind) { ind.textContent = 'salvando...'; ind.classList.add('salvando'); }
    clearTimeout(this._t);
    this._t = setTimeout(async () => {
      try {
        await Nuvem.salvarAnotacao(n.id, campos);
        if (ind) { ind.textContent = 'salvo'; ind.classList.remove('salvando'); }
        this.vista === 'grafo' ? this.renderGrafo() : this.renderLista();
      } catch (e) {
        if (ind) ind.textContent = 'erro ao salvar';
        toast('Não consegui salvar: ' + (e.message || e), 'erro');
      }
    }, 500);
  },

  apagar(n) {
    Modal.abrir({
      titulo: 'Apagar anotação', perigo: true, confirmar: 'Apagar',
      corpo: `<p class="dialogo">Apagar <b>${esc(n.titulo)}</b>? Os <code>[[links]]</code> que apontam pra ela viram links quebrados.</p>`,
      onConfirmar: async () => {
        try {
          await Nuvem.apagarAnotacao(n.id);
          this.lista = this.lista.filter(x => x.id !== n.id);
          this.fecharNota();
        } catch (e) { toast('Erro: ' + (e.message || e), 'erro'); }
      }
    });
  },

  /* ---------------- grafo ---------------- */

  renderGrafo() {
    const corpo = $('#campanha-corpo');
    if (!this.lista.length) return this.renderLista();

    /* nós reais + fantasmas (links pra anotações que ainda não existem) */
    const nos = this.lista.map(n => ({ id: n.id, titulo: n.titulo, tipo: n.tipo, fantasma: false }));
    const arestas = [];
    const fantasmas = new Map();

    this.lista.forEach(n => {
      this.linksDe(n).forEach(l => {
        const alvo = this.porTitulo(l);
        if (alvo) { arestas.push([n.id, alvo.id]); return; }
        const chave = 'f:' + l.toLowerCase();
        if (!fantasmas.has(chave)) {
          fantasmas.set(chave, { id: chave, titulo: l, tipo: 'Nota', fantasma: true });
          nos.push(fantasmas.get(chave));
        }
        arestas.push([n.id, chave]);
      });
    });

    const grau = {};
    arestas.forEach(([a, b]) => { grau[a] = (grau[a] || 0) + 1; grau[b] = (grau[b] || 0) + 1; });

    /* O viewBox acompanha a proporção real da caixa. Se não acompanhar, o SVG
       cria faixas vazias nas laterais e toda conversão de coordenada erra. */
    const caixa = corpo.getBoundingClientRect();
    const L = Math.max(520, Math.round(caixa.width) || 900);
    const A = Math.round(Math.min(window.innerHeight * 0.74, 660));

    /* posição inicial em círculo — evita todos nascerem no mesmo ponto */
    nos.forEach((n, i) => {
      const ang = (i / nos.length) * Math.PI * 2;
      n.x = L / 2 + Math.cos(ang) * 200;
      n.y = A / 2 + Math.sin(ang) * 200;
      n.vx = 0; n.vy = 0;
      n.r = 7 + Math.min(11, (grau[n.id] || 0) * 1.8);
    });

    this.simular(nos, arestas, L, A);

    const mapa = new Map(nos.map(n => [n.id, n]));
    corpo.innerHTML = `
      <div class="grafo-caixa">
        <svg id="grafo" viewBox="0 0 ${L} ${A}" preserveAspectRatio="xMidYMid meet">
          <g id="grafo-zoom">
            <g stroke="#3a4050" stroke-width="1">
              ${arestas.map(([a, b]) => {
                const na = mapa.get(a), nb = mapa.get(b);
                return `<line class="aresta" data-a="${esc(a)}" data-b="${esc(b)}"
                          x1="${na.x.toFixed(1)}" y1="${na.y.toFixed(1)}"
                          x2="${nb.x.toFixed(1)}" y2="${nb.y.toFixed(1)}"/>`;
              }).join('')}
            </g>
            ${nos.map(n => `
              <g class="no ${n.fantasma ? 'no-fantasma' : ''}" data-no="${esc(n.id)}"
                 transform="translate(${n.x.toFixed(1)},${n.y.toFixed(1)})" style="--h:${this.corDoTipo(n.tipo)}">
                <circle class="alvo" r="${n.r + 12}"></circle>
                <circle r="${n.r}"></circle>
                <text y="${n.r + 13}">${esc(n.titulo.length > 22 ? n.titulo.slice(0, 21) + '…' : n.titulo)}</text>
              </g>`).join('')}
          </g>
        </svg>
        <div class="grafo-legenda">
          ${[...new Set(nos.map(n => n.tipo))].map(t =>
            `<span style="--h:${this.corDoTipo(t)}">${esc(t)}</span>`).join('')}
          <span class="fraco">· clique abre · arraste move · roda dá zoom</span>
        </div>
      </div>`;

    this.ligarGrafo(nos, mapa);
    this.destacarGrafo();
  },

  /* Força bruta: repulsão entre todos os pares, mola nas arestas,
     gravidade fraca pro centro. Esfria aos poucos e para. */
  simular(nos, arestas, L, A) {
    const REP = 5200, MOLA = 0.012, TAM = 110, CENTRO = 0.0016;
    let temp = 1;
    for (let passo = 0; passo < 320; passo++) {
      for (let i = 0; i < nos.length; i++) {
        for (let j = i + 1; j < nos.length; j++) {
          const a = nos[i], b = nos[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = (Math.random() - .5); dy = (Math.random() - .5); d2 = 1; }
          const d = Math.sqrt(d2);
          const f = REP / d2;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
        }
      }
      arestas.forEach(([ia, ib]) => {
        const a = nos.find(n => n.id === ia), b = nos.find(n => n.id === ib);
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - TAM) * MOLA;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      });
      nos.forEach(n => {
        n.vx += (L / 2 - n.x) * CENTRO;
        n.vy += (A / 2 - n.y) * CENTRO;
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += Math.max(-18, Math.min(18, n.vx)) * temp;
        n.y += Math.max(-18, Math.min(18, n.vy)) * temp;
        n.x = Math.max(30, Math.min(L - 30, n.x));
        n.y = Math.max(24, Math.min(A - 24, n.y));
      });
      temp *= 0.988;
    }
  },

  ligarGrafo(nos, mapa) {
    const svg = $('#grafo');
    const zoom = $('#grafo-zoom');
    let escala = 1, panX = 0, panY = 0;
    let arrastando = null, movendoTela = null;

    const aplicar = () => zoom.setAttribute('transform', `translate(${panX},${panY}) scale(${escala})`);

    /* Converte a posição do mouse usando a própria matriz do SVG. Fazer essa
       conta na mão erra sempre que o elemento e o viewBox têm proporções
       diferentes — era o motivo do nó fugir do cursor. */
    const emCoord = (e, alvo) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(alvo.getScreenCTM().inverse());
    };
    const noGrafo = e => emCoord(e, zoom);      // espaço dos nós
    const naTela  = e => emCoord(e, svg);       // espaço do viewBox

    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const p = naTela(e);
      const ux = (p.x - panX) / escala, uy = (p.y - panY) / escala;
      escala = Math.max(0.3, Math.min(3.5, escala * (e.deltaY < 0 ? 1.12 : 0.89)));
      panX = p.x - ux * escala;
      panY = p.y - uy * escala;
      aplicar();
    }, { passive: false });

    svg.addEventListener('pointerdown', e => {
      const g = e.target.closest('.no');
      if (g) {
        arrastando = { no: mapa.get(g.dataset.no), g, moveu: false, x0: e.clientX, y0: e.clientY };
        svg.setPointerCapture?.(e.pointerId);
      } else {
        const p = naTela(e);
        movendoTela = { x: p.x - panX, y: p.y - panY };
        svg.classList.add('arrastando-tela');
      }
    });

    svg.addEventListener('pointermove', e => {
      if (movendoTela) {
        const p = naTela(e);
        panX = p.x - movendoTela.x; panY = p.y - movendoTela.y;
        return aplicar();
      }
      if (!arrastando) return;
      /* só vira arrasto depois de 4px — senão qualquer tremida cancela o clique */
      if (Math.hypot(e.clientX - arrastando.x0, e.clientY - arrastando.y0) > 4) arrastando.moveu = true;
      if (!arrastando.moveu) return;
      const p = noGrafo(e);
      const n = arrastando.no;
      n.x = p.x; n.y = p.y;
      arrastando.g.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`);
      $$(`line[data-a="${CSS.escape(n.id)}"]`, svg).forEach(l => { l.setAttribute('x1', n.x); l.setAttribute('y1', n.y); });
      $$(`line[data-b="${CSS.escape(n.id)}"]`, svg).forEach(l => { l.setAttribute('x2', n.x); l.setAttribute('y2', n.y); });
    });

    const soltar = () => {
      if (arrastando && !arrastando.moveu) {
        const n = arrastando.no;
        n.fantasma ? this.nova(n.titulo) : this.abrir(n.id);
      }
      arrastando = null; movendoTela = null;
      svg.classList.remove('arrastando-tela');
    };
    svg.addEventListener('pointerup', soltar);
    svg.addEventListener('pointerleave', soltar);
  },

  /* a busca ilumina os nós correspondentes em vez de sumir com o resto */
  destacarGrafo() {
    const svg = $('#grafo');
    if (!svg) return;
    const b = this.busca.trim().toLowerCase();
    const alvos = new Set(this.filtradas().map(n => n.id));
    $$('.no', svg).forEach(g => {
      const dentro = !b && !this.filtroTipo ? true : alvos.has(g.dataset.no);
      g.classList.toggle('apagado', !dentro);
    });
  },

  /* ---------------- importar / exportar ---------------- */

  /* Normaliza o tipo pro conjunto conhecido (que define a cor), sem barrar
     tipos novos: o que não reconhecer entra como veio. */
  normalizarTipo(t) {
    const bruto = String(t || '').trim();
    if (!bruto) return 'Nota';
    const chave = slug(bruto);
    const conhecido = TIPOS.find(x => slug(x.nome) === chave);
    return conhecido ? conhecido.nome : bruto;
  },

  lerEtiquetas(v) {
    if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
    return String(v || '').replace(/^\[|\]$/g, '')
      .split(',').map(x => x.trim().replace(/^["'#]|["']$/g, '')).filter(Boolean);
  },

  /* Markdown com frontmatter, no formato do Obsidian. Uma anotação por arquivo. */
  lerMarkdown(texto, nomeArquivo) {
    let corpo = texto.replace(/^\uFEFF/, '');
    const meta = {};

    const fm = corpo.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (fm) {
      corpo = corpo.slice(fm[0].length);
      let chaveLista = null;
      fm[1].split(/\r?\n/).forEach(linha => {
        const item = linha.match(/^\s*-\s+(.*)$/);
        if (item && chaveLista) { (meta[chaveLista] = meta[chaveLista] || []).push(item[1].trim()); return; }
        const par = linha.match(/^([A-Za-zÀ-ÿ_][\w\-À-ÿ]*)\s*:\s*(.*)$/);
        if (!par) return;
        const chave = slug(par[1]);
        const valor = par[2].trim();
        if (valor === '') { chaveLista = chave; meta[chave] = []; }
        else { chaveLista = null; meta[chave] = valor.replace(/^["']|["']$/g, ''); }
      });
    }

    /* título: frontmatter > primeiro "# Cabeçalho" > nome do arquivo */
    let titulo = meta.titulo || meta.title || meta.nome || '';
    if (!titulo) {
      const h1 = corpo.match(/^\s*#\s+(.+)$/m);
      if (h1) { titulo = h1[1].trim(); corpo = corpo.replace(h1[0], ''); }
    }
    if (!titulo) titulo = String(nomeArquivo || '').replace(/\.[^.]+$/, '');

    return {
      titulo: titulo.trim(),
      tipo: this.normalizarTipo(meta.tipo || meta.type || meta.categoria),
      etiquetas: this.lerEtiquetas(meta.etiquetas ?? meta.tags ?? meta.etiqueta),
      fixada: /^(true|sim|yes|1)$/i.test(String(meta.fixada ?? meta.pinned ?? '')),
      texto: corpo.replace(/^\s*\n/, '').trimEnd()
    };
  },

  lerJson(texto) {
    const dados = JSON.parse(texto);
    const lista = Array.isArray(dados) ? dados : (dados.anotacoes || dados.notas || []);
    return lista.map(n => ({
      titulo: String(n.titulo || n.title || n.nome || '').trim(),
      tipo: this.normalizarTipo(n.tipo || n.type),
      etiquetas: this.lerEtiquetas(n.etiquetas ?? n.tags),
      fixada: Boolean(n.fixada ?? n.pinned),
      texto: String(n.texto || n.text || n.corpo || n.body || '')
    }));
  },

  async lerArquivos(arquivos) {
    const achados = [];
    for (const f of arquivos) {
      const txt = await f.text();
      try {
        if (/\.json$/i.test(f.name)) achados.push(...this.lerJson(txt));
        else achados.push(this.lerMarkdown(txt, f.name));
      } catch (e) {
        achados.push({ titulo: '', erro: `${f.name}: ${e.message}` });
      }
    }
    return achados;
  },

  modalImportar() {
    Modal.abrir({
      titulo: 'Importar anotações',
      corpo: `
        <label class="campo"><span>Arquivos</span>
          <input type="file" id="imp-arq" accept=".md,.markdown,.txt,.json" multiple></label>
        <p class="dialogo fraco">
          <b>Markdown</b>: um arquivo por anotação (pode selecionar vários de uma vez), no formato do Obsidian.
          <b>JSON</b>: uma lista inteira num arquivo só.
        </p>
        <div id="imp-previa" class="imp-previa"><span class="fraco">nenhum arquivo escolhido</span></div>
        <label class="radio"><input type="radio" name="imp-conflito" value="pular" checked> pular as que já existem</label>
        <label class="radio"><input type="radio" name="imp-conflito" value="substituir"> substituir as que já existem</label>`,
      confirmar: 'Importar',
      onConfirmar: async () => {
        const achados = (Modal._notasLidas || []).filter(n => n.titulo && !n.erro);
        if (!achados.length) { toast('Nada pra importar.', 'erro'); return false; }
        const substituir = $('input[name="imp-conflito"]:checked').value === 'substituir';
        const btn = $('[data-modal-ok]');
        let novas = 0, trocadas = 0, puladas = 0, falhas = 0;

        for (let i = 0; i < achados.length; i++) {
          const n = achados[i];
          if (btn) btn.textContent = `Importando ${i + 1}/${achados.length}...`;
          const existe = this.porTitulo(n.titulo);
          try {
            if (existe && !substituir) { puladas++; continue; }
            if (existe) {
              await Nuvem.salvarAnotacao(existe.id, n);
              Object.assign(existe, n);
              trocadas++;
            } else {
              const criada = await Nuvem.criarAnotacao(Object.assign({ mesa_id: App.mesa.id }, n));
              this.lista.unshift(criada);
              novas++;
            }
          } catch (e) { falhas++; console.error(n.titulo, e); }
        }

        delete Modal._notasLidas;
        this.render();
        toast(`${novas} nova(s)` + (trocadas ? `, ${trocadas} atualizada(s)` : '')
            + (puladas ? `, ${puladas} pulada(s)` : '') + (falhas ? `, ${falhas} com erro` : '') + '.');
      }
    });

    $('#imp-arq').addEventListener('change', async e => {
      const previa = $('#imp-previa');
      previa.innerHTML = '<span class="fraco">lendo...</span>';
      const achados = await this.lerArquivos([...e.target.files]);
      Modal._notasLidas = achados;

      const bons = achados.filter(n => n.titulo && !n.erro);
      const ruins = achados.filter(n => n.erro || !n.titulo);
      previa.innerHTML = `
        <p class="imp-resumo"><b>${bons.length}</b> anotação(ões) lida(s)${ruins.length ? ` · <span class="fraco">${ruins.length} ignorada(s)</span>` : ''}</p>
        ${bons.slice(0, 12).map(n => {
          const existe = this.porTitulo(n.titulo);
          const links = (String(n.texto).match(/\[\[/g) || []).length;
          return `<div class="imp-item">
            <span class="nota-tipo" style="--h:${this.corDoTipo(n.tipo)}">${esc(n.tipo)}</span>
            <b>${esc(n.titulo)}</b>
            ${links ? `<i>${links} link${links > 1 ? 's' : ''}</i>` : ''}
            ${existe ? '<span class="imp-conflito">já existe</span>' : ''}
          </div>`;
        }).join('')}
        ${bons.length > 12 ? `<p class="fraco">…e mais ${bons.length - 12}</p>` : ''}
        ${ruins.map(n => `<div class="imp-item imp-erro">${esc(n.erro || 'sem título — ignorada')}</div>`).join('')}`;
    });
  },

  exportar() {
    const dados = this.lista.map(n => ({
      titulo: n.titulo, tipo: n.tipo, etiquetas: n.etiquetas || [], fixada: n.fixada, texto: n.texto || ''
    }));
    const blob = new Blob([JSON.stringify({ anotacoes: dados }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `campanha-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`${dados.length} anotação(ões) exportada(s).`);
  },

  /* ---------------- realtime ---------------- */

  mudou(payload) {
    const { eventType, new: novo, old: antigo } = payload;
    if (eventType === 'DELETE') this.lista = this.lista.filter(n => n.id !== antigo.id);
    else {
      const i = this.lista.findIndex(n => n.id === novo.id);
      if (i >= 0) { if (this.aberta?.id === novo.id) return; this.lista[i] = novo; }
      else this.lista.unshift(novo);
    }
    if (App.telaAtual === 'campanha') this.render();
  }
};
