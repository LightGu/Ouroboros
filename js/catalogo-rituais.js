/* Dados dos livros vêm do Supabase autenticado; fallback local em catalogo/. */
const CatalogoRituais = {
  itens: null,
  promessa: null,
  async carregar() {
    if (this.itens) return this.itens;
    if (!this.promessa) this.promessa = this.buscar().finally(() => { this.promessa = null; });
    return this.promessa;
  },
  async buscar() {
    try {
      if (Nuvem.cliente) {
        const itens = await Nuvem.catalogoRituais();
        if (itens.length) return (this.itens = itens.map(r => ({...r, desc:r.descricao || r.desc || ''})));
      }
    } catch (e) { console.warn('Catálogo de rituais indisponível:', e.message || e); }
    try {
      const r = await fetch('catalogo/rituais.json');
      if (r.ok) return (this.itens = await r.json());
    } catch (e) { /* O arquivo só existe no desenvolvimento. */ }
    return [];
  },
  chave(r) { return [Catalogo.normal(r.nome).trim(), r.elemento, String(r.circulo)].join('|'); },
  filtrar({busca = '', elemento = '', circulo = '', livro = ''} = {}) {
    const q = Catalogo.normal(busca).trim();
    return (this.itens || []).filter(r => (!elemento || r.elemento === elemento || (r.elementos || []).includes(elemento))
      && (!circulo || String(r.circulo) === circulo) && (!livro || r.livro === livro)
      && (!q || Catalogo.normal(`${r.nome} ${r.elemento} ${r.livro}`).includes(q)));
  },
  paraFicha(r) {
    return {nome:r.nome, elemento:r.elemento, elementos:r.elementos || [], circulo:String(r.circulo), custo:circuloInfo(r.circulo).pe,
      execucao:r.execucao || '', alcance:r.alcance || '', alvo:r.alvo || '', duracao:r.duracao || '',
      resistencia:r.resistencia || '', pagina:`${r.livro}, p. ${r.pagina}`, desc:r.desc || ''};
  },
  async abrir(p) {
    if (!Store.podeEditar(p)) return;
    const estado = {personagem:p, busca:'', elemento:'', circulo:'', livro:'', escolhidos:new Set()};
    this.estado = estado;
    Modal.abrir({titulo:'Catálogo de rituais', corpo:'<p class="dialogo">Carregando rituais…</p>',
      confirmar:'Adicionar', largo:true, onConfirmar:() => this.adicionar(estado)});
    const itens = await this.carregar();
    if (this.estado !== estado || $('#modal').hidden || $('#modal-titulo').textContent !== 'Catálogo de rituais') return;
    if (!itens.length) {
      $('#modal-body').innerHTML = '<p class="dialogo">O catálogo de rituais ainda não está disponível. Tente novamente mais tarde.</p>';
      return;
    }
    const livros = [...new Set(itens.map(r => r.livro))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    $('#modal-body').innerHTML = `<label class="campo"><span>Buscar ritual</span><input id="rit-busca" placeholder="Nome ou elemento"></label>
      <div class="grade-3">
        <label class="campo"><span>Elemento</span><select data-rit-filtro="elemento"><option value="">Todos</option>${ELEMENTOS.filter(e=>e.id).map(e=>`<option value="${e.id}">${esc(e.nome)}</option>`).join('')}</select></label>
        <label class="campo"><span>Círculo</span><select data-rit-filtro="circulo"><option value="">Todos</option>${CIRCULOS.filter(c=>c.v).map(c=>`<option value="${c.v}">${esc(c.label)}</option>`).join('')}</select></label>
        <label class="campo"><span>Livro</span><select data-rit-filtro="livro"><option value="">Todos</option>${livros.map(l=>`<option>${esc(l)}</option>`).join('')}</select></label>
      </div><p class="dica-passo">Confira os pré-requisitos e os aprimoramentos antes de conjurar.</p>
      <div id="rit-lista" class="cat-lista"></div><p id="rit-contagem" class="cat-rodape"></p>`;
    $('#rit-busca').addEventListener('input', e => { estado.busca = e.target.value; this.render(); });
    $$('[data-rit-filtro]').forEach(el => el.addEventListener('change', () => { estado[el.dataset.ritFiltro] = el.value; this.render(); }));
    $('#rit-lista').addEventListener('click', e => {
      const botao = e.target.closest('[data-rit-escolher]');
      if (!botao) return;
      const id = Number(botao.dataset.ritEscolher);
      if (estado.escolhidos.has(id)) estado.escolhidos.delete(id); else estado.escolhidos.add(id);
      this.render();
    });
    this.render();
    $('#rit-busca').focus();
  },
  render() {
    const s = this.estado;
    const conhecidos = new Set(s.personagem.rituais.map(r => this.chave(r)));
    const lista = this.filtrar(s);
    $('#rit-lista').innerHTML = lista.map(r => {
      const id = this.itens.indexOf(r), ja = conhecidos.has(this.chave(r)), on = s.escolhidos.has(id);
      const cedo = num(s.personagem.nex) < circuloInfo(r.circulo).nex;
      return `<div class="ritual-catalogo-item">
        <button class="cat-item ${on?'ativo':''}" data-rit-escolher="${id}" ${ja?'disabled':''} aria-pressed="${on}">
          <span class="cat-marca">${ja || on?'✓':'+'}</span><span class="cat-nome">${esc(r.nome)}${ja?'<i class="cat-ja">já conhecido</i>':''}</span>
          <span class="cat-meta">${esc((r.elementos || [r.elemento]).map(e => ELEMENTOS.find(x=>x.id===e)?.nome || e).join(r.elemento === 'varia' ? ' / ' : ' + '))} · ${esc(r.circulo)}º círculo · ${circuloInfo(r.circulo).pe} PE</span>
          <span class="cat-meta">${esc(r.livro)}, p. ${esc(r.pagina)}${cedo?' · acima do NEX de acesso de ocultista':''}</span>
        </button>
        <details><summary>Ver ritual e aprimoramentos</summary><p>${esc(r.execucao)} · ${esc(r.alcance)} · ${esc(r.duracao)}</p>
          <p>Alvo/área: ${esc(r.alvo || '—')} · Resistência: ${esc(r.resistencia || '—')}</p><p class="ritual-catalogo-desc">${esc(r.desc)}</p></details>
      </div>`;
    }).join('') || '<p class="vazio-linha">Nenhum ritual encontrado.</p>';
    $('#rit-contagem').textContent = `${lista.length} rituais · ${s.escolhidos.size} selecionados`;
    $('[data-modal-ok]').textContent = s.escolhidos.size ? `Adicionar ${s.escolhidos.size}` : 'Adicionar';
  },
  adicionar(s) {
    if (!Store.podeEditar(s.personagem) || Ficha.atual?.id !== s.personagem.id) return false;
    const conhecidos = new Set(s.personagem.rituais.map(r => this.chave(r)));
    const novos = [];
    for (const id of s.escolhidos) {
      const r = this.itens?.[id];
      if (!r || conhecidos.has(this.chave(r))) continue;
      conhecidos.add(this.chave(r)); novos.push(this.paraFicha(r));
    }
    if (!novos.length) { toast('Escolha pelo menos um ritual novo.', 'erro'); return false; }
    s.personagem.rituais.push(...novos);
    Store.salvar(s.personagem); Ficha.abrir(s.personagem.id);
    toast(`${novos.length} ritual(is) adicionado(s).`);
  }
};
