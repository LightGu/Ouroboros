const CatalogoPoderes = {
  itens: null,
  async carregar() {
    if (this.itens) return this.itens;
    try { if (Nuvem.cliente) { const x = await Nuvem.catalogoPoderes(); if (x.length) return (this.itens = x); } } catch (e) { console.warn(e); }
    try { const r = await fetch('catalogo/poderes.json'); if (r.ok) return (this.itens = await r.json()); } catch {}
    return (this.itens = []);
  },
  async abrir(p) {
    if (!Store.podeEditar(p)) return;
    this.p = p; this.escolhidos = new Set();
    Modal.abrir({titulo:'Catálogo de poderes', corpo:'<p class="dialogo">Carregando poderes…</p>', confirmar:'Adicionar', largo:true, onConfirmar:()=>this.adicionar()});
    await this.carregar(); if ($('#modal').hidden) return;
    const classes = [...new Set(this.itens.map(x=>x.classe))];
    $('#modal-body').innerHTML = `<input id="poder-busca" class="busca" placeholder="Buscar poder..."><div class="filtros">${['',...classes].map(c=>`<button type="button" class="chip-filtro ${c===p.classe?'ativa':''}" data-poder-classe="${esc(c)}">${esc(c||'todos')}</button>`).join('')}</div><div id="poder-lista" class="cat-lista"></div>`;
    this.classe = classes.includes(p.classe) ? p.classe : '';
    $('#poder-busca').oninput = () => this.render();
    $('#modal-body').onclick = e => { const f=e.target.closest('[data-poder-classe]'), b=e.target.closest('[data-poder]'); if(f){this.classe=f.dataset.poderClasse; $$('[data-poder-classe]').forEach(x=>x.classList.toggle('ativa',x===f)); this.render();} if(b){const i=Number(b.dataset.poder); this.escolhidos.has(i)?this.escolhidos.delete(i):this.escolhidos.add(i); this.render();} };
    this.render();
  },
  render() {
    const q=Catalogo.normal($('#poder-busca')?.value||''), conhecidos=new Set(this.p.habilidades.map(h=>Catalogo.normal(h.nome)));
    const lista=this.itens.filter(x=>(!this.classe||x.classe===this.classe)&&(!q||Catalogo.normal(`${x.nome} ${x.descricao}`).includes(q)));
    $('#poder-lista').innerHTML=lista.map(x=>{const i=this.itens.indexOf(x), ja=conhecidos.has(Catalogo.normal(x.nome)), on=this.escolhidos.has(i); return `<article class="poder-catalogo-item ${on?'ativo':''}">
      <button type="button" class="poder-catalogo-add" data-poder="${i}" ${ja?'disabled':''} aria-label="${ja?'Poder já adicionado':'Adicionar '+esc(x.nome)}">${ja||on?'✓':'+'}</button>
      <details><summary>${esc(x.nome)}</summary><p>${esc(x.descricao)}</p></details>
    </article>`}).join('')||'<p class="vazio-linha">Nenhum poder encontrado.</p>';
  },
  adicionar() {
    const novos=[...this.escolhidos].map(i=>this.itens[i]).filter(Boolean);
    if(!novos.length){toast('Escolha pelo menos um poder.','erro');return false;}
    this.p.habilidades.push(...novos.map(x=>({nome:x.nome,custo:'',pagina:`${x.livro}, p. ${x.pagina}`,desc:x.descricao})));
    Store.salvar(this.p); Ficha.abrir(this.p.id); toast(`${novos.length} poder(es) adicionado(s).`);
  }
};
