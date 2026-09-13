/* Acervo pessoal do mestre: metadados pesquisáveis e imagens privadas. */
const Bestiario = {
  lista: [],
  filtros: {},
  versao: 0,
  imagemUrl: null,

  limpar() {
    this.versao++;
    if (this.imagemUrl) URL.revokeObjectURL(this.imagemUrl);
    this.imagemUrl = null;
    this.lista = [];
    $('#view-bestiario').innerHTML = '';
  },

  async carregar(id) {
    if (!App.ehMestre) return;
    this.limpar();
    const versao = this.versao;
    $('#view-bestiario').innerHTML = '<p class="vazio-linha" role="status">Carregando bestiário…</p>';
    try {
      const lista = await Nuvem.bestiario();
      if (versao !== this.versao) return;
      this.lista = lista;
      this.render();
      if (id) this.abrir(id);
    } catch (e) {
      if (versao !== this.versao) return;
      $('#view-bestiario').innerHTML = `<p class="vazio-linha" role="alert">Não consegui carregar o bestiário: ${esc(e.message || e)}</p><button class="btn" id="best-repetir">Tentar novamente</button>`;
      $('#best-repetir').onclick = () => this.carregar();
    }
  },

  normal(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  },

  filtrar() {
    const f = this.filtros;
    return this.lista.filter(c =>
      (!f.name || this.normal(c.name).includes(this.normal(f.name))) &&
      (!f.element || c.element === f.element) &&
      (!f.vd || String(c.vd) === f.vd) &&
      (!f.type || c.type === f.type) &&
      (!f.tags || (c.tags || []).includes(f.tags)));
  },

  render() {
    if (!App.ehMestre) return;
    if (this.imagemUrl) URL.revokeObjectURL(this.imagemUrl);
    this.imagemUrl = null;
    const filtro = (chave, titulo) => {
      const valores = [...new Set(this.lista.flatMap(c => chave === 'tags' ? c.tags || [] : [c[chave]])
        .filter(v => v !== null && v !== undefined && v !== '').map(String))]
        .sort((a, b) => chave === 'vd' ? Number(a) - Number(b) : a.localeCompare(b, 'pt-BR'));
      return `<label class="campo"><span>${titulo}</span><select data-best-filtro="${chave}"><option value="">Todos</option>${valores.map(v => `<option value="${esc(v)}" ${this.filtros[chave] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;
    };
    $('#view-bestiario').innerHTML = `
      <header class="best-topo"><div><h1>Bestiário</h1><p>Seu acervo privado de criaturas.</p></div><div class="best-tags"><button class="btn" id="best-importar">Importar lote dos livros</button><button class="btn btn-primary" id="best-novo">+ Criatura</button></div></header>
      <div class="best-filtros">
        <label class="campo"><span>Buscar por nome</span><input type="search" data-best-filtro="name" value="${esc(this.filtros.name || '')}" placeholder="Nome da criatura"></label>
        ${filtro('element', 'Elemento')}${filtro('vd', 'VD')}${filtro('type', 'Tipo')}${filtro('tags', 'Tag')}
        <button class="btn btn-ghost" id="best-limpar">Limpar filtros</button>
      </div>
      <p id="best-contagem" class="fraco" role="status"></p><div id="best-lista" class="best-grade"></div>`;
    $('#best-novo').onclick = () => this.cadastrar();
    $('#best-importar').onclick = () => this.importarLote();
    $('#best-limpar').onclick = () => { this.filtros = {}; this.render(); };
    $$('[data-best-filtro]').forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
      this.filtros[el.dataset.bestFiltro] = el.value;
      this.renderLista();
    }));
    this.renderLista();
  },

  renderLista() {
    const lista = this.filtrar();
    $('#best-contagem').textContent = `${lista.length} de ${this.lista.length} criatura(s)`;
    $('#best-lista').innerHTML = lista.length ? lista.map(c => `
      <article class="best-card"><button class="btn btn-ghost" data-best-id="${esc(c.id)}"><b>${esc(c.name)}</b>
        <span>${esc(c.element || 'Sem elemento')} · VD ${c.vd ?? '—'}</span>
        <small>${esc(c.type || '')}</small>
        <span class="best-tags">${(c.tags || []).map(t => `<span class="chip-cat">${esc(t)}</span>`).join('')}</span>
      </button><button class="btn" data-best-adicionar="${esc(c.id)}">+ Adicionar à mesa</button></article>`).join('') : `<p class="vazio-linha">${this.lista.length ? 'Nenhuma criatura corresponde aos filtros.' : 'Nenhuma criatura cadastrada. Use “+ Criatura” para começar.'}</p>`;
    $$('[data-best-id]').forEach(b => b.onclick = () => this.abrir(b.dataset.bestId));
    $$('[data-best-adicionar]').forEach(b => b.onclick = () => this.adicionar(b.dataset.bestAdicionar, b));
  },

  async adicionar(id, botao) {
    if (!App.ehMestre || !Store.mesaId || this.adicionando) return;
    const criatura = this.lista.find(c => c.id === id);
    if (!criatura) return;
    this.adicionando = true;
    botao.disabled = true;
    try {
      await Store.criarDoBestiario(criatura);
      toast(criatura.name + ' adicionado aos turnos, oculto dos jogadores.');
    } catch (e) { toast('Não consegui adicionar: ' + (e.message || e), 'erro'); }
    finally { this.adicionando = false; botao.disabled = false; }
  },

  async abrir(id) {
    const c = this.lista.find(c => c.id === id);
    if (!c || !App.ehMestre) return;
    const versao = ++this.versao;
    $('#view-bestiario').innerHTML = `
      <button class="btn btn-ghost" id="best-voltar">‹ Voltar ao bestiário</button>
      <header class="best-topo"><div><h1>${esc(c.name)}</h1><p>${esc(c.element || 'Sem elemento')} · VD ${c.vd ?? '—'} · ${esc(c.type || 'Sem tipo')}</p></div></header>
      <p class="best-tags">${(c.tags || []).map(t => `<span class="chip-cat">${esc(t)}</span>`).join('')}</p>
      ${c.notes ? `<p class="best-notas">${esc(c.notes)}</p>` : ''}
      <button class="btn btn-primary" id="best-adicionar">+ Adicionar à mesa</button>
      <button class="btn" id="best-zoom" hidden>Tamanho original</button>
      <div id="best-imagem" class="best-imagem"><p role="status">Carregando ficha…</p></div>`;
    $('#best-adicionar').onclick = e => this.adicionar(id, e.currentTarget);
    $('#best-voltar').onclick = () => { this.versao++; this.render(); };
    try {
      const blob = await Nuvem.imagemCriatura(c.image_path);
      if (versao !== this.versao) return;
      this.imagemUrl = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.alt = `Ficha completa de ${c.name}`;
      img.src = this.imagemUrl;
      img.onerror = () => { if (versao === this.versao) $('#best-imagem').textContent = 'Não foi possível exibir esta imagem.'; };
      $('#best-imagem').replaceChildren(img);
      $('#best-zoom').hidden = false;
      $('#best-zoom').onclick = e => {
        const original = $('#best-imagem').classList.toggle('original');
        e.target.textContent = original ? 'Ajustar à largura' : 'Tamanho original';
      };
    } catch (e) {
      if (versao === this.versao) $('#best-imagem').innerHTML = `<p role="alert">Não consegui abrir a imagem: ${esc(e.message || e)}</p><button class="btn" id="best-imagem-repetir">Tentar novamente</button>`;
      $('#best-imagem-repetir')?.addEventListener('click', () => this.abrir(id));
    }
  },

  prepararLote(arquivos, manifesto) {
    if (manifesto.version !== 1 || !Array.isArray(manifesto.creatures) || !manifesto.creatures.length)
      throw new Error('Manifesto de importação inválido.');
    const mapa = new Map();
    for (const arquivo of arquivos) {
      if (mapa.has(arquivo.name)) throw new Error('Há arquivos com nomes repetidos na pasta.');
      mapa.set(arquivo.name, arquivo);
    }
    const chaves = new Set();
    return manifesto.creatures.map(r => {
      if (!r || typeof r.source_key !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.source_key) || chaves.has(r.source_key))
        throw new Error('Identificador de origem inválido ou repetido.');
      chaves.add(r.source_key);
      if (typeof r.name !== 'string' || !r.name.trim() || r.name.length > 200 ||
          !Number.isInteger(r.vd) || r.vd < 0 || r.vd > 2147483647 ||
          !Array.isArray(r.tags) || r.tags.some(t => typeof t !== 'string') ||
          [r.element, r.type, r.notes].some(v => v != null && typeof v !== 'string'))
        throw new Error('Metadados inválidos para ' + (r.name || 'uma criatura') + '.');
      if (r.image_revision != null && (!Number.isInteger(r.image_revision) || r.image_revision < 1)) throw new Error('Revisão inválida.');
      const arquivo = mapa.get(r.image_file);
      if (!arquivo || !/\.(jpg|jpeg|png|webp)$/i.test(arquivo.name) || !arquivo.size || arquivo.size > 20 * 1024 * 1024)
        throw new Error('Imagem ausente ou inválida: ' + r.image_file);
      return { registro: r, arquivo };
    });
  },

  importarLote() {
    if (!App.ehMestre) return;
    let lote = null, executando = false;
    Modal.abrir({
      titulo: 'Importar fichas dos livros', confirmar: 'Importar', largo: true,
      corpo: `<div id="best-lote">
        <p class="dialogo">Selecione a pasta do lote preparado com as imagens e o arquivo manifest.json.</p>
        <label class="campo"><span>Pasta do lote</span><input id="best-lote-pasta" type="file" webkitdirectory multiple></label>
        <p class="fraco">As fichas serão enviadas ao seu bestiário privado. Fichas com novas ilustrações serão atualizadas; as demais serão puladas. Se interromper, selecione a mesma pasta para continuar.</p>
        <p id="best-lote-status" role="status" aria-live="polite">Nenhuma pasta selecionada.</p>
        <progress id="best-lote-progresso" hidden></progress>
        <div id="best-lote-erros" role="alert"></div>
      </div>`,
      onConfirmar: async () => {
        if (!lote || executando) return false;
        executando = true;
        const raiz = $('#best-lote'), status = $('#best-lote-status'), progresso = $('#best-lote-progresso');
        const botao = $('[data-modal-ok]'), input = $('#best-lote-pasta');
        const versao = this.versao, dono = App.sessao.user.id;
        botao.disabled = true; input.disabled = true;
        progresso.hidden = false; progresso.max = lote.length; progresso.value = 0;
        let novos = 0, existentes = 0, atualizados = 0;
        const erros = [];
        for (let i = 0; i < lote.length; i++) {
          if (this.versao !== versao || App.sessao?.user?.id !== dono || $('#best-lote') !== raiz || $('#modal').hidden) break;
          const { registro, arquivo } = lote[i];
          status.textContent = `${i + 1}/${lote.length} — ${registro.name}`;
          try {
            const resultado = await Nuvem.importarCriatura(registro, arquivo);
            if (resultado.atualizado) atualizados++; else if (resultado.existente) existentes++; else novos++;
            if (this.versao === versao) {
              const pos = this.lista.findIndex(c => c.id === resultado.criatura.id);
              if (pos < 0) this.lista.push(resultado.criatura); else this.lista[pos] = resultado.criatura;
            }
          } catch (e) { erros.push(registro.name + ': ' + (e.message || e)); }
          progresso.value = i + 1;
        }
        if (this.versao === versao) { this.lista.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')); this.render(); }
        if ($('#best-lote') === raiz) {
          status.textContent = `${novos} importadas · ${atualizados} atualizadas · ${existentes} já existentes · ${erros.length} falhas.`;
          $('#best-lote-erros').textContent = erros.join('\n');
          botao.disabled = false; botao.textContent = erros.length ? 'Tentar novamente' : 'Concluir';
          input.disabled = !erros.length;
          if (!erros.length) Modal.aoConfirmar = null;
        }
        executando = false;
        return false;
      }
    });
    const input = $('#best-lote-pasta');
    $('[data-modal-ok]').disabled = true;
    input.addEventListener('change', async () => {
      lote = null;
      const arquivos = Array.from(input.files);
      const manifestos = arquivos.filter(f => f.name === 'manifest.json');
      try {
        if (manifestos.length !== 1 || manifestos[0].size > 5 * 1024 * 1024) throw new Error('Selecione a pasta que contém um único manifest.json.');
        const texto = await manifestos[0].text();
        if ($('#best-lote-pasta') !== input) return;
        lote = this.prepararLote(arquivos, JSON.parse(texto));
        $('#best-lote-status').textContent = `${lote.length} fichas prontas para importar (${Math.ceil(lote.reduce((n, e) => n + e.arquivo.size, 0) / 1024 / 1024)} MB).`;
        $('[data-modal-ok]').disabled = false;
      } catch (e) {
        if ($('#best-lote-pasta') !== input) return;
        $('#best-lote-status').textContent = e.message || String(e);
        $('[data-modal-ok]').disabled = true;
      }
    });
  },

  cadastrar() {
    if (!App.ehMestre) return;
    let salvando = false;
    Modal.abrir({
      titulo: 'Cadastrar criatura', confirmar: 'Cadastrar', largo: true,
      corpo: `<form id="best-form">
        <label class="campo"><span>Nome *</span><input name="name" required maxlength="200"></label>
        <div class="grade-2">
          <label class="campo"><span>Elemento</span><input name="element" placeholder="Ex.: Sangue"></label>
          <label class="campo"><span>VD</span><input name="vd" type="number" min="0" max="2147483647" step="1"></label>
          <label class="campo"><span>Tipo</span><input name="type" placeholder="Ex.: Criatura paranormal"></label>
          <label class="campo"><span>Tags (separadas por vírgula)</span><input name="tags" placeholder="Ex.: floresta, chefe"></label>
        </div>
        <label class="campo"><span>Observações</span><textarea name="notes" rows="3"></textarea></label>
        <label class="campo"><span>Imagem da ficha *</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp" required></label>
        <p class="fraco">PNG, JPG ou WebP, até 20 MB. A imagem será guardada na resolução original.</p>
        <p id="best-form-erro" role="alert"></p>
      </form>`,
      onConfirmar: async () => {
        if (salvando) return false;
        const form = $('#best-form');
        if (!form || !form.reportValidity()) return false;
        const campos = Object.fromEntries(new FormData(form));
        if (!campos.name.trim()) { $('#best-form-erro').textContent = 'Informe o nome da criatura.'; return false; }
        const arquivo = campos.image;
        delete campos.image;
        campos.name = campos.name.trim();
        campos.element = campos.element.trim() || null;
        campos.type = campos.type.trim() || null;
        campos.vd = campos.vd === '' ? null : Number(campos.vd);
        campos.tags = [...new Set(campos.tags.split(',').map(t => t.trim()).filter(Boolean))];
        const versao = this.versao;
        salvando = true;
        const botao = $('[data-modal-ok]');
        botao.disabled = true; botao.textContent = 'Enviando…';
        try {
          const c = await Nuvem.criarCriatura(campos, arquivo);
          if (versao === this.versao && App.ehMestre) {
            this.lista.push(c);
            this.lista.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
            this.render();
          }
          toast('Criatura cadastrada.');
          return $('#best-form') === form;
        } catch (e) {
          if ($('#best-form') === form) $('#best-form-erro').textContent = e.message || String(e);
          return false;
        } finally {
          salvando = false;
          botao.disabled = false; botao.textContent = 'Cadastrar';
        }
      }
    });
    $('#best-form').onsubmit = e => { e.preventDefault(); $('[data-modal-ok]').click(); };
  }
};
