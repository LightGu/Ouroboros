/* Trilha sonora da mesa: acervo do mestre, tocando pra todo mundo */

const Sons = {
  lista: [],
  tocando: new Map(),      // id -> HTMLAudioElement
  filtro: '',
  busca: '',
  bloqueado: false,        // navegador barrou o áudio até alguém clicar

  async carregar() {
    if (!App.ehMestre) return;          /* acervo é só do mestre */
    try { this.lista = await Nuvem.sons(App.mesa.id); this.render(); }
    catch (e) { $('#sons-lista').innerHTML = `<p class="vazio-linha">Erro: ${esc(e.message || e)}</p>`; }
  },

  categorias() {
    return [...new Set(this.lista.map(s => s.categoria).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },

  /* ---------------- desenho ---------------- */

  render() {
    this.renderBarra();
    const alvo = $('#sons-lista');
    const b = this.busca.toLowerCase();
    const lista = this.lista.filter(s =>
      (!this.filtro || s.categoria === this.filtro) &&
      (!b || (s.nome + ' ' + s.categoria).toLowerCase().includes(b)));

    if (!lista.length) {
      alvo.innerHTML = `<p class="vazio-linha">${this.lista.length
        ? 'Nada bate com esse filtro.'
        : 'Nenhum som ainda. Suba um arquivo pra começar.'}</p>`;
      return;
    }

    alvo.innerHTML = lista.map(s => {
      const ativo = this.tocando.has(s.id);
      return `
      <article class="som ${ativo ? 'som-tocando' : ''}" data-som="${s.id}">
        <span class="alca" data-alca title="Arraste para reordenar">⠿</span>
        <button class="som-play" data-tocar="${s.id}" title="${ativo ? 'Parar' : 'Tocar'}">${ativo ? '⏸' : '▶'}</button>
        <div class="som-info">
          <span class="som-nome">${esc(s.nome)}</span>
          <span class="som-tags">
            ${s.categoria ? `<span class="chip-cat">${esc(s.categoria)}</span>` : ''}
            ${s.loop ? '<span class="chip-cat chip-loop">loop</span>' : ''}
          </span>
        </div>
        <input class="som-vol" type="range" min="0" max="1" step="0.05" value="${s.volume}"
               data-vol="${s.id}" title="Volume">
        <button class="btn-mini" data-editar="${s.id}" title="Editar">⋯</button>
      </article>`;
    }).join('');

    this.ligarArrasto();
  },

  renderBarra() {
    const cats = this.categorias();
    $('#sons-barra').innerHTML = `
      <button class="btn btn-primary btn-peq" id="btn-add-som">+ Som</button><div class="sep"></div>
      <input id="sons-busca" class="busca" placeholder="Buscar som..." value="${esc(this.busca)}">
      <div class="filtros">
        <button class="chip-filtro ${!this.filtro ? 'ativo' : ''}" data-filtro="">todos</button>
        ${cats.map(c => `<button class="chip-filtro ${this.filtro === c ? 'ativo' : ''}" data-filtro="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <div class="cresce"></div>
      <span class="dica-som" title="O áudio sai só nas suas caixas de som">🎧 só neste aparelho</span>
      <button class="btn btn-ghost btn-peq" id="btn-parar-tudo">■ Parar tudo</button>`;

    $('#btn-add-som')?.addEventListener('click', () => this.modalNovo());
    $('#sons-busca').addEventListener('input', e => { this.busca = e.target.value; this.render(); });
    $$('#sons-barra [data-filtro]').forEach(b => b.addEventListener('click', () => {
      this.filtro = b.dataset.filtro; this.render();
    }));
    $('#btn-parar-tudo').addEventListener('click', () => this.pararTudo());
  },

  renderTocando() {
    const barra = $('#sons-tocando');
    if (!this.tocando.size) { barra.hidden = true; return; }
    barra.hidden = false;
    barra.innerHTML = `<span class="tocando-rotulo">tocando</span>` +
      [...this.tocando.keys()].map(id => {
        const s = this.lista.find(x => x.id === id);
        return `<span class="tocando-item">${esc(s?.nome || 'som')}
          <button data-parar="${id}" title="Parar">✕</button></span>`;
      }).join('') +
      '<button class="btn btn-ghost btn-peq" id="tocando-parar-tudo">Parar tudo</button>';
    $('#tocando-parar-tudo')?.addEventListener('click', () => this.pararTudo());
  },

  /* ---------------- tocar ---------------- */

  /* Toca só neste aparelho: o arquivo é baixado uma vez e fica em cache.
     Nada vai pela rede pros outros — foi o que barateou a banda. */
  alternar(id) {
    const s = this.lista.find(x => x.id === id);
    if (!s) return;
    this.tocando.has(id) ? this.parar(id) : this.tocar(s);
  },

  tocar(s) {
    this.parar(s.id);
    const a = new Audio(s.arquivo);
    a.volume = Math.max(0, Math.min(1, s.volume ?? .8));
    a.loop = Boolean(s.loop);
    a.addEventListener('ended', () => { if (!a.loop) { this.tocando.delete(s.id); this.render(); this.renderTocando(); } });
    a.play().then(() => { this.bloqueado = false; $('#aviso-audio').hidden = true; })
            .catch(() => { this.bloqueado = true; $('#aviso-audio').hidden = false; });
    this.tocando.set(s.id, a);
    this.render();
    this.renderTocando();
  },

  parar(id) {
    const a = this.tocando.get(id);
    if (!a) return;
    a.pause();
    a.src = '';
    this.tocando.delete(id);
    this.render();
    this.renderTocando();
  },

  pararTudo() {
    [...this.tocando.keys()].forEach(id => this.parar(id));
  },

  /* ---------------- acervo (mestre) ---------------- */

  modalNovo() {
    Modal.abrir({
      titulo: 'Novo som',
      corpo: `
        <label class="campo"><span>Arquivo de áudio *</span><input type="file" id="sm-arq" accept="audio/*"></label>
        <p class="dialogo fraco" id="sm-info">MP3, OGG, WAV ou M4A. Limite de 20 MB por arquivo.</p>
        <div class="grade-2">
          <label class="campo"><span>Nome</span><input id="sm-nome" placeholder="Chuva na floresta"></label>
          <label class="campo"><span>Categoria</span>
            <input id="sm-cat" list="dl-cats" placeholder="Ambiente">
            <datalist id="dl-cats">${this.categorias().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
          </label>
        </div>
        <div class="grade-2">
          <label class="campo"><span>Volume</span><input type="range" id="sm-vol" min="0" max="1" step="0.05" value="0.8"></label>
          <label class="radio"><input type="checkbox" id="sm-loop"> repetir sem parar (ambiente)</label>
        </div>`,
      confirmar: 'Enviar',
      onConfirmar: async () => {
        const arq = $('#sm-arq').files[0];
        if (!arq) { toast('Escolhe um arquivo.', 'erro'); return false; }
        if (arq.size > 20 * 1024 * 1024) { toast('Arquivo maior que 20 MB.', 'erro'); return false; }
        const btn = $('[data-modal-ok]');
        if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
        try {
          const { caminho, url } = await Nuvem.enviarSom(arq, App.mesa.id);
          const som = await Nuvem.criarSom({
            mesa_id: App.mesa.id,
            nome: $('#sm-nome').value.trim() || arq.name.replace(/\.[^.]+$/, ''),
            categoria: $('#sm-cat').value.trim(),
            arquivo: url, caminho,
            volume: num($('#sm-vol').value, .8),
            loop: $('#sm-loop').checked,
            ordem: this.lista.length
          });
          this.lista.push(som);
          this.render();
          toast('Som adicionado.');
        } catch (e) {
          toast('Falhou o envio: ' + (e.message || e), 'erro');
          return false;
        }
      }
    });

    $('#sm-arq').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      if (!$('#sm-nome').value) $('#sm-nome').value = f.name.replace(/\.[^.]+$/, '');
      const mb = (f.size / 1048576).toFixed(1);
      $('#sm-info').textContent = `${f.name} — ${mb} MB` + (f.size > 20 * 1048576 ? ' ⚠ passa do limite de 20 MB' : '');
    });
  },

  modalEditar(id) {
    const s = this.lista.find(x => x.id === id);
    if (!s) return;
    Modal.abrir({
      titulo: 'Editar som',
      corpo: `
        <div class="grade-2">
          <label class="campo"><span>Nome</span><input id="sm-nome" value="${esc(s.nome)}"></label>
          <label class="campo"><span>Categoria</span>
            <input id="sm-cat" list="dl-cats2" value="${esc(s.categoria)}">
            <datalist id="dl-cats2">${this.categorias().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
          </label>
        </div>
        <label class="radio"><input type="checkbox" id="sm-loop" ${s.loop ? 'checked' : ''}> repetir sem parar</label>
        <button class="btn btn-ghost btn-perigo-texto" id="sm-apagar" type="button">Apagar som</button>`,
      confirmar: 'Salvar',
      onConfirmar: async () => {
        const campos = {
          nome: $('#sm-nome').value.trim() || s.nome,
          categoria: $('#sm-cat').value.trim(),
          loop: $('#sm-loop').checked
        };
        Object.assign(s, campos);
        this.render();
        try { await Nuvem.salvarSom(s.id, campos); }
        catch (e) { toast('Erro: ' + (e.message || e), 'erro'); }
      }
    });

    $('#sm-apagar').addEventListener('click', () => {
      Modal.fechar();
      Modal.abrir({
        titulo: 'Apagar som', perigo: true, confirmar: 'Apagar',
        corpo: `<p class="dialogo">Apagar <b>${esc(s.nome)}</b> da mesa? O arquivo sai do armazenamento também.</p>`,
        onConfirmar: async () => {
          this.parar(s.id);
          try {
            await Nuvem.apagarSom(s);
            this.lista = this.lista.filter(x => x.id !== s.id);
            this.render();
          } catch (e) { toast('Erro: ' + (e.message || e), 'erro'); }
        }
      });
    });
  },

  async mudarVolume(id, v) {
    const s = this.lista.find(x => x.id === id);
    if (!s) return;
    s.volume = v;
    const a = this.tocando.get(id);
    if (a) a.volume = v;
    clearTimeout(this._tv);
    this._tv = setTimeout(() => Nuvem.salvarSom(id, { volume: v }).catch(() => {}), 500);
  },

  /* ---------------- ordem ---------------- */

  ligarArrasto() {
    const lista = $('#sons-lista');
    let arrastado = null;

    $$('.som', lista).forEach(el => {
      const alca = $('[data-alca]', el);
      if (!alca) return;
      alca.addEventListener('mousedown', () => { el.draggable = true; });
      el.addEventListener('dragstart', e => {
        arrastado = el; el.classList.add('arrastando');
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', async () => {
        el.classList.remove('arrastando'); el.draggable = false; arrastado = null;
        const ids = $$('.som', lista).map(x => x.dataset.som);
        this.lista.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        try { await Nuvem.salvarOrdemSons(this.lista); }
        catch (e) { toast('Não consegui salvar a ordem.', 'erro'); }
      });
      el.addEventListener('dragover', e => {
        e.preventDefault();
        if (!arrastado || arrastado === el) return;
        const r = el.getBoundingClientRect();
        lista.insertBefore(arrastado, (e.clientY - r.top) > r.height / 2 ? el.nextSibling : el);
      });
    });
    lista.addEventListener('dragover', e => e.preventDefault());
  },

  /* ---------------- realtime ---------------- */

  mudou(payload) {
    const { eventType, new: novo, old: antigo } = payload;
    if (eventType === 'DELETE') { this.parar(antigo.id); this.lista = this.lista.filter(s => s.id !== antigo.id); }
    else {
      const i = this.lista.findIndex(s => s.id === novo.id);
      if (i >= 0) this.lista[i] = novo; else this.lista.push(novo);
      this.lista.sort((a, b) => num(a.ordem) - num(b.ordem));
    }
    if (App.telaAtual === 'sons') this.render();
  },

  ligar() {
    if (this._ligado) return;
    this._ligado = true;
    $('#sons-lista').addEventListener('click', e => {
      const t = e.target.closest('[data-tocar]');
      if (t) return this.alternar(t.dataset.tocar);
      const ed = e.target.closest('[data-editar]');
      if (ed) return this.modalEditar(ed.dataset.editar);
    });
    $('#sons-lista').addEventListener('input', e => {
      const v = e.target.closest('[data-vol]');
      if (v) this.mudarVolume(v.dataset.vol, num(v.value, .8));
    });
    $('#sons-tocando').addEventListener('click', e => {
      const p = e.target.closest('[data-parar]');
      if (p) this.parar(p.dataset.parar);
    });
    /* o navegador só libera áudio depois de um clique do usuário */
    $('#aviso-audio').addEventListener('click', () => {
      $('#aviso-audio').hidden = true;
      this.tocando.forEach(a => a.play().catch(() => {}));
    });
  }
};
