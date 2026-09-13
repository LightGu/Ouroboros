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

  async carregar() {
    if (!App.ehMestre) return;
    this.limpar();
    const versao = this.versao;
    $('#view-bestiario').innerHTML = '<p class="vazio-linha" role="status">Carregando bestiário…</p>';
    try {
      const lista = await Nuvem.bestiario();
      if (versao !== this.versao) return;
      this.lista = lista;
      this.render();
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
      <header class="best-topo"><div><h1>Bestiário</h1><p>Seu acervo privado de criaturas.</p></div><button class="btn btn-primary" id="best-novo">+ Criatura</button></header>
      <div class="best-filtros">
        <label class="campo"><span>Buscar por nome</span><input type="search" data-best-filtro="name" value="${esc(this.filtros.name || '')}" placeholder="Nome da criatura"></label>
        ${filtro('element', 'Elemento')}${filtro('vd', 'VD')}${filtro('type', 'Tipo')}${filtro('tags', 'Tag')}
        <button class="btn btn-ghost" id="best-limpar">Limpar filtros</button>
      </div>
      <p id="best-contagem" class="fraco" role="status"></p><div id="best-lista" class="best-grade"></div>`;
    $('#best-novo').onclick = () => this.cadastrar();
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
      <button class="best-card" data-best-id="${esc(c.id)}"><b>${esc(c.name)}</b>
        <span>${esc(c.element || 'Sem elemento')} · VD ${c.vd ?? '—'}</span>
        <small>${esc(c.type || '')}</small>
        <span class="best-tags">${(c.tags || []).map(t => `<span class="chip-cat">${esc(t)}</span>`).join('')}</span>
      </button>`).join('') : `<p class="vazio-linha">${this.lista.length ? 'Nenhuma criatura corresponde aos filtros.' : 'Nenhuma criatura cadastrada. Use “+ Criatura” para começar.'}</p>`;
    $$('[data-best-id]').forEach(b => b.onclick = () => this.abrir(b.dataset.bestId));
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
      <button class="btn" id="best-zoom" hidden>Tamanho original</button>
      <div id="best-imagem" class="best-imagem"><p role="status">Carregando ficha…</p></div>`;
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
