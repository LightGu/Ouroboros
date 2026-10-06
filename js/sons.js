/* Trilha sonora da mesa: acervo do mestre, tocando pra todo mundo */

const Sons = {
  lista: [],
  locais: [],
  pastaLocal: null,
  pastaLocalAtiva: false,
  tocando: new Map(),      // id -> HTMLAudioElement
  filtro: '',
  busca: '',
  bloqueado: false,        // navegador barrou o áudio até alguém clicar

  async carregar() {
    if (!App.ehMestre) return;          /* acervo é só do mestre */
    try {
      this.lista = await Nuvem.sons(App.mesa.id);
      await this.restaurarPastaLocal();
      this.render();
    }
    catch (e) { $('#sons-lista').innerHTML = `<p class="vazio-linha">Erro: ${esc(e.message || e)}</p>`; }
  },

  todos() { return [...this.locais, ...this.lista]; },

  categorias() {
    return [...new Set(this.todos().map(s => s.categoria).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },

  /* ---------------- desenho ---------------- */

  render() {
    this.renderBarra();
    const alvo = $('#sons-lista');
    const b = this.busca.toLowerCase();
    const todos = this.todos();
    const lista = todos.filter(s =>
      (!this.filtro || s.categoria === this.filtro) &&
      (!b || (s.nome + ' ' + s.categoria).toLowerCase().includes(b)));

    if (!lista.length) {
      alvo.innerHTML = `<p class="vazio-linha">${todos.length
        ? 'Nada bate com esse filtro.'
        : 'Nenhum som ainda. Abra uma pasta local ou suba um arquivo pra começar.'}</p>`;
      return;
    }

    alvo.innerHTML = lista.map(s => {
      const ativo = this.tocando.has(s.id);
      return `
      <article class="som ${ativo ? 'som-tocando' : ''}" data-som="${esc(s.id)}">
        ${s.local ? '<span class="som-local-icone" title="Arquivo do seu computador">♪</span>' : '<span class="alca" data-alca title="Arraste para reordenar">⠿</span>'}
        <button class="som-play" data-tocar="${esc(s.id)}" title="${ativo ? 'Parar imediatamente' : 'Tocar'}">${ativo ? '■' : '▶'}</button>
        <div class="som-info">
          <span class="som-nome">${esc(s.nome)}</span>
          <span class="som-tags">
            ${s.categoria ? `<span class="chip-cat">${esc(s.categoria)}</span>` : ''}
            ${s.loop ? '<span class="chip-cat chip-loop">loop</span>' : ''}
            ${s.local ? '<span class="chip-cat chip-local">local</span>' : ''}
            ${!s.local && !s.caminho ? '<span class="chip-cat chip-link">link</span>' : ''}
          </span>
        </div>
        <input class="som-vol" type="range" min="0" max="1" step="0.05" value="${s.volume}"
               data-vol="${esc(s.id)}" title="Volume">
        ${s.local ? '' : `<button class="btn-mini" data-editar="${esc(s.id)}" title="Editar">⋯</button>`}
      </article>`;
    }).join('');

    this.ligarArrasto();
  },

  renderBarra() {
    const cats = this.categorias();
    const temPasta = Boolean(this.pastaLocal);
    $('#sons-barra').innerHTML = `
      <button class="btn btn-primary btn-peq" id="btn-add-som">+ Som</button><div class="sep"></div>
      <button class="btn btn-ghost btn-peq" id="btn-pasta-local">📁 ${temPasta ? (this.pastaLocalAtiva ? 'Trocar pasta' : 'Reconectar pasta') : 'Abrir pasta local'}</button>
      ${temPasta ? '<button class="btn-mini" id="btn-remover-pasta" title="Esquecer pasta local">✕</button>' : ''}<div class="sep"></div>
      <input id="sons-busca" class="busca" placeholder="Buscar som..." value="${esc(this.busca)}">
      <div class="filtros">
        <button class="chip-filtro ${!this.filtro ? 'ativo' : ''}" data-filtro="">todos</button>
        ${cats.map(c => `<button class="chip-filtro ${this.filtro === c ? 'ativo' : ''}" data-filtro="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <div class="cresce"></div>
      <span class="dica-som" title="O áudio sai só nas suas caixas de som">🎧 só neste aparelho</span>
      <button class="btn btn-ghost btn-peq" id="btn-parar-tudo">■ Parar tudo</button>`;

    $('#btn-add-som')?.addEventListener('click', () => this.modalNovo());
    $('#btn-pasta-local')?.addEventListener('click', () => this.abrirPastaLocal());
    $('#btn-remover-pasta')?.addEventListener('click', () => this.removerPastaLocal());
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
      [...this.tocando.entries()].map(([id, audio]) => {
        const s = this.todos().find(x => x.id === id);
        const duracao = Number.isFinite(audio.duration) ? audio.duration : 0;
        const atual = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        return `<div class="tocando-item" data-player="${esc(id)}">
          <div class="tocando-cabecalho">
            <span class="tocando-nome">${esc(s?.nome || 'som')}</span>
            <span class="tocando-tempo" data-tempo>${this.formatarTempo(atual)} / ${this.formatarTempo(duracao)}</span>
          </div>
          <div class="tocando-controles">
            <input class="tocando-progresso" type="range" min="0" max="${duracao}" step="0.1"
                   value="${Math.min(atual, duracao)}" data-minutagem="${esc(id)}"
                   aria-label="Minutagem de ${esc(s?.nome || 'som')}" ${duracao ? '' : 'disabled'}>
            <button class="btn btn-ghost btn-peq tocando-parar" data-parar="${esc(id)}" title="Parar imediatamente">■ Parar</button>
          </div>
        </div>`;
      }).join('') +
      '<button class="btn btn-ghost btn-peq" id="tocando-parar-tudo">Parar tudo</button>';
    $('#tocando-parar-tudo')?.addEventListener('click', () => this.pararTudo());
  },

  formatarTempo(segundos) {
    const valor = Number(segundos);
    const total = Number.isFinite(valor) ? Math.max(0, Math.floor(valor)) : 0;
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segundosRestantes = total % 60;
    return horas
      ? `${horas}:${String(minutos).padStart(2, '0')}:${String(segundosRestantes).padStart(2, '0')}`
      : `${minutos}:${String(segundosRestantes).padStart(2, '0')}`;
  },

  atualizarPlayer(id) {
    const audio = this.tocando.get(id);
    const player = [...$$('[data-player]')].find(el => el.dataset.player === id);
    if (!audio || !player) return;
    const duracao = Number.isFinite(audio.duration) ? audio.duration : 0;
    const atual = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const progresso = $('[data-minutagem]', player);
    const tempo = $('[data-tempo]', player);
    if (progresso && document.activeElement !== progresso) progresso.value = Math.min(atual, duracao);
    if (progresso) { progresso.max = duracao; progresso.disabled = !duracao; }
    if (tempo) tempo.textContent = `${this.formatarTempo(atual)} / ${this.formatarTempo(duracao)}`;
  },

  /* ---------------- tocar ---------------- */

  async abrirBancoLocal() {
    return new Promise((resolve, reject) => {
      const pedido = indexedDB.open('ouroboros-sons-locais', 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore('config');
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error);
    });
  },

  async lerPastaSalva() {
    if (!window.indexedDB) return null;
    const banco = await this.abrirBancoLocal();
    return new Promise((resolve, reject) => {
      const pedido = banco.transaction('config').objectStore('config').get('pasta');
      pedido.onsuccess = () => resolve(pedido.result || null);
      pedido.onerror = () => reject(pedido.error);
    }).finally(() => banco.close());
  },

  async salvarPasta(handle) {
    if (!window.indexedDB) return;
    const banco = await this.abrirBancoLocal();
    await new Promise((resolve, reject) => {
      const pedido = banco.transaction('config', 'readwrite').objectStore('config').put(handle, 'pasta');
      pedido.onsuccess = resolve;
      pedido.onerror = () => reject(pedido.error);
    }).finally(() => banco.close());
  },

  async esquecerPasta() {
    if (!window.indexedDB) return;
    const banco = await this.abrirBancoLocal();
    await new Promise((resolve, reject) => {
      const pedido = banco.transaction('config', 'readwrite').objectStore('config').delete('pasta');
      pedido.onsuccess = resolve;
      pedido.onerror = () => reject(pedido.error);
    }).finally(() => banco.close());
  },

  async restaurarPastaLocal() {
    if (!window.showDirectoryPicker) return;
    try {
      this.pastaLocal = await this.lerPastaSalva();
      if (!this.pastaLocal) return;
      const permissao = await this.pastaLocal.queryPermission({ mode: 'read' });
      if (permissao === 'granted') await this.lerPastaLocal();
    } catch (e) { console.warn('Não consegui restaurar a pasta de sons:', e); }
  },

  async abrirPastaLocal() {
    if (!window.showDirectoryPicker) {
      toast('A pasta local requer Chrome ou Edge no computador.', 'erro');
      return;
    }
    try {
      let handle = this.pastaLocal;
      if (handle && !this.pastaLocalAtiva) {
        const permissao = await handle.requestPermission({ mode: 'read' });
        if (permissao !== 'granted') return;
      } else {
        handle = await window.showDirectoryPicker({ id: 'sons-rpg', mode: 'read' });
      }
      this.pastaLocal = handle;
      await this.salvarPasta(handle);
      await this.lerPastaLocal();
      this.render();
      toast(`${this.locais.length} áudio${this.locais.length === 1 ? '' : 's'} encontrado${this.locais.length === 1 ? '' : 's'} em ${handle.name}.`);
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Não consegui abrir a pasta: ' + (e.message || e), 'erro');
    }
  },

  async lerPastaLocal() {
    const extensoes = /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|webm)$/i;
    const encontrados = [];
    const visitar = async (diretorio, partes = []) => {
      for await (const [nome, handle] of diretorio.entries()) {
        if (handle.kind === 'directory') await visitar(handle, [...partes, nome]);
        else if (extensoes.test(nome)) {
          const caminho = [...partes, nome].join('/');
          encontrados.push({
            id: `local:${caminho}`, local: true, handle,
            nome: nome.replace(/\.[^.]+$/, ''),
            categoria: partes.join(' / ') || 'Pasta local',
            volume: .8, loop: false, caminhoLocal: caminho
          });
        }
      }
    };
    await visitar(this.pastaLocal);
    this.locais = encontrados.sort((a, b) => a.caminhoLocal.localeCompare(b.caminhoLocal, 'pt-BR'));
    this.pastaLocalAtiva = true;
  },

  async removerPastaLocal() {
    this.locais.forEach(s => this.parar(s.id));
    this.locais = [];
    this.pastaLocal = null;
    this.pastaLocalAtiva = false;
    try { await this.esquecerPasta(); } catch (e) { console.warn(e); }
    this.render();
    toast('Pasta local desconectada. Nenhum arquivo foi apagado.');
  },

  /* Toca só neste aparelho: o arquivo é baixado uma vez e fica em cache.
     Nada vai pela rede pros outros — foi o que barateou a banda. */
  alternar(id) {
    const s = this.todos().find(x => x.id === id);
    if (!s) return;
    this.tocando.has(id) ? this.parar(id) : this.tocar(s);
  },

  async tocar(s) {
    this.parar(s.id);
    let origem = s.arquivo;
    if (s.local) {
      try { origem = URL.createObjectURL(await s.handle.getFile()); }
      catch (e) { toast('Não consegui ler esse áudio local.', 'erro'); return; }
    }
    const a = new Audio(origem);
    if (s.local) a._urlLocal = origem;
    a.volume = Math.max(0, Math.min(1, s.volume ?? .8));
    a.loop = Boolean(s.loop);
    a.addEventListener('ended', () => { if (!a.loop) { this.tocando.delete(s.id); this.render(); this.renderTocando(); } });
    a.addEventListener('loadedmetadata', () => this.atualizarPlayer(s.id));
    a.addEventListener('durationchange', () => this.atualizarPlayer(s.id));
    a.addEventListener('timeupdate', () => this.atualizarPlayer(s.id));
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
    if (a._urlLocal) URL.revokeObjectURL(a._urlLocal);
    a.src = '';
    this.tocando.delete(id);
    this.render();
    this.renderTocando();
  },

  pararTudo() {
    [...this.tocando.keys()].forEach(id => this.parar(id));
  },

  /* ---------------- acervo (mestre) ---------------- */

  urlAudio(valor) {
    const texto = String(valor || '').trim();
    if (!texto) return '';
    try {
      const url = new URL(texto);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  },

  modalNovo() {
    Modal.abrir({
      titulo: 'Novo som',
      corpo: `
        <label class="campo"><span>Arquivo de áudio</span><input type="file" id="sm-arq" accept="audio/*"></label>
        <p class="dialogo fraco" id="sm-info">MP3, OGG, WAV ou M4A. Limite de 20 MB por arquivo.</p>
        <div class="separador-ou"><span>ou use um link</span></div>
        <label class="campo"><span>Link direto do áudio</span><input type="url" id="sm-url" inputmode="url" placeholder="https://exemplo.com/musica.mp3"></label>
        <p class="dialogo fraco">Bom para faixas grandes: o link precisa abrir o arquivo de áudio diretamente. Links de páginas do YouTube ou Spotify não funcionam.</p>
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
        const textoUrl = $('#sm-url').value.trim();
        const url = this.urlAudio(textoUrl);
        if (!arq && !textoUrl) { toast('Escolhe um arquivo ou cola um link.', 'erro'); return false; }
        if (textoUrl && !url) { toast('O link precisa começar com http:// ou https://.', 'erro'); return false; }
        if (arq && textoUrl) { toast('Escolhe só uma opção: arquivo ou link.', 'erro'); return false; }
        if (arq && arq.size > 20 * 1024 * 1024) { toast('Arquivo maior que 20 MB.', 'erro'); return false; }
        const btn = $('[data-modal-ok]');
        if (btn) { btn.disabled = true; btn.textContent = arq ? 'Enviando...' : 'Salvando...'; }
        try {
          const hospedado = arq ? await Nuvem.enviarSom(arq, App.mesa.id) : { caminho: null, url };
          const som = await Nuvem.criarSom({
            mesa_id: App.mesa.id,
            nome: $('#sm-nome').value.trim() || (arq ? arq.name.replace(/\.[^.]+$/, '') : 'Som por link'),
            categoria: $('#sm-cat').value.trim(),
            arquivo: hospedado.url, caminho: hospedado.caminho,
            volume: num($('#sm-vol').value, .8),
            loop: $('#sm-loop').checked,
            ordem: this.lista.length
          });
          this.lista.push(som);
          this.render();
          toast('Som adicionado.');
        } catch (e) {
          App.faltaMigracao(e);
          if (!/bucket not found/i.test(String(e.message || e)))
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
        ${!s.caminho ? `<label class="campo"><span>Link direto do áudio</span><input type="url" id="sm-url" inputmode="url" value="${esc(s.arquivo)}"></label>` : ''}
        <label class="radio"><input type="checkbox" id="sm-loop" ${s.loop ? 'checked' : ''}> repetir sem parar</label>
        <button class="btn btn-ghost btn-perigo-texto" id="sm-apagar" type="button">Apagar som</button>`,
      confirmar: 'Salvar',
      onConfirmar: async () => {
        const textoUrl = $('#sm-url')?.value.trim();
        const url = textoUrl == null ? null : this.urlAudio(textoUrl);
        if (textoUrl != null && !url) { toast('O link precisa começar com http:// ou https://.', 'erro'); return false; }
        const campos = {
          nome: $('#sm-nome').value.trim() || s.nome,
          categoria: $('#sm-cat').value.trim(),
          loop: $('#sm-loop').checked
        };
        if (url) campos.arquivo = url;
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
    const s = this.todos().find(x => x.id === id);
    if (!s) return;
    s.volume = v;
    const a = this.tocando.get(id);
    if (a) a.volume = v;
    if (!s.local) {
      clearTimeout(this._tv);
      this._tv = setTimeout(() => Nuvem.salvarSom(id, { volume: v }).catch(() => {}), 500);
    }
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
    $('#sons-tocando').addEventListener('input', e => {
      const controle = e.target.closest('[data-minutagem]');
      if (!controle) return;
      const audio = this.tocando.get(controle.dataset.minutagem);
      if (!audio || !Number.isFinite(audio.duration)) return;
      audio.currentTime = Math.max(0, Math.min(audio.duration, num(controle.value)));
      this.atualizarPlayer(controle.dataset.minutagem);
    });
    /* o navegador só libera áudio depois de um clique do usuário */
    $('#aviso-audio').addEventListener('click', () => {
      $('#aviso-audio').hidden = true;
      this.tocando.forEach(a => a.play().catch(() => {}));
    });
  }
};
