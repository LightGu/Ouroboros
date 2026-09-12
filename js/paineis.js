/* Preferências visuais locais: mover um painel nunca altera a ficha na nuvem. */
const Paineis = {
  montar(p) {
    const ficha = $('#view-ficha .ficha');
    const blocos = Array.from(ficha.children).filter(el => el.matches('section.bloco') && el.querySelector(':scope > h2'));
    const chave = `paineis-v1:${App.sessao?.user?.id || 'local'}:${p.id}`;
    let prefs = {};
    try { prefs = JSON.parse(localStorage.getItem(chave)) || {}; } catch { /* preferência opcional */ }
    const padrao = blocos.map((el, i) => ({ el, id: slug(el.querySelector('h2').firstChild.textContent.trim()) || `bloco-${i}` }));
    const ordem = Array.isArray(prefs.ordem) ? prefs.ordem : [];
    let itens = [...padrao].sort((a,b) => {
      const ai = ordem.indexOf(a.id), bi = ordem.indexOf(b.id);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
    const fechados = new Set(Array.isArray(prefs.fechados) ? prefs.fechados : []);
    const ocultos = new Set(Array.isArray(prefs.ocultos) ? prefs.ocultos : []);
    const barra = document.createElement('section');
    barra.className = 'bloco organizar-paineis';
    barra.setAttribute('aria-label', 'Organizar ficha');
    barra.innerHTML = `<b>Sua ficha, do seu jeito</b><p>Arraste pela alça ⠿ ou use as setas. Recolher mantém o título; ocultar tira o painel da tela.</p>
      <div class="painel-acoes"><button class="btn btn-ghost" data-layout="lista">Lista</button><button class="btn btn-ghost" data-layout="cascata">Cascata</button>
      <button class="btn btn-ghost" data-todos="abrir">Expandir todos</button><button class="btn btn-ghost" data-todos="fechar">Recolher todos</button>
      <button class="btn btn-ghost" data-restaurar>Restaurar organização</button></div>
      <details><summary>Mostrar ou ocultar painéis</summary><div class="painel-visibilidade"></div></details><span class="sr-only" aria-live="polite" data-painel-anuncio></span>`;
    const grupo = document.createElement('div');
    grupo.className = 'paineis-ficha';
    blocos[0]?.before(barra);
    barra.after(grupo);
    const salvar = () => {
      try { localStorage.setItem(chave, JSON.stringify({ ordem: itens.map(i=>i.id), fechados: [...fechados], ocultos: [...ocultos], modo: prefs.modo })); } catch { /* sem armazenamento, mantém na sessão */ }
    };
    const pintar = () => {
      grupo.classList.toggle('modo-cascata', prefs.modo === 'cascata');
      itens.forEach(({el,id}, i) => {
        grupo.appendChild(el);
        el.hidden = ocultos.has(id);
        el.querySelector('.painel-conteudo').hidden = fechados.has(id);
        const toggle = el.querySelector('[data-recolher]');
        toggle.textContent = fechados.has(id) ? 'Expandir' : 'Recolher';
        toggle.setAttribute('aria-expanded', String(!fechados.has(id)));
        el.querySelector('[data-mover="-1"]').disabled = i === 0;
        el.querySelector('[data-mover="1"]').disabled = i === itens.length - 1;
      });
      $$('[data-layout]', barra).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.layout === (prefs.modo || 'lista'))));
      $$('[data-visibilidade]', barra).forEach(b => b.setAttribute('aria-pressed', String(!ocultos.has(b.dataset.visibilidade))));
    };
    const mover = (id, destino) => {
      const de = itens.findIndex(i=>i.id === id);
      if (de < 0 || destino < 0 || destino >= itens.length || de === destino) return;
      const [item] = itens.splice(de,1); itens.splice(destino,0,item);
      pintar(); salvar();
      $('[data-painel-anuncio]', barra).textContent = `${item.nome} movido para a posição ${destino+1}.`;
    };
    let arrastando = null;
    itens.forEach(item => {
      const {el,id} = item, titulo = el.querySelector(':scope > h2');
      item.nome = titulo.firstChild.textContent.trim();
      el.dataset.painel = id;
      const corpo = document.createElement('div'); corpo.className = 'painel-conteudo'; corpo.id = `painel-corpo-${id}`;
      Array.from(el.childNodes).forEach(n => { if (n !== titulo) corpo.appendChild(n); });
      el.appendChild(corpo);
      const ctrl = document.createElement('span'); ctrl.className = 'painel-controles';
      ctrl.innerHTML = `<button class="btn-mini painel-alca" draggable="true" aria-label="Arrastar ${esc(item.nome)}" title="Arrastar painel">⠿</button>
        <button class="btn-mini" data-mover="-1" aria-label="Mover ${esc(item.nome)} para cima">↑</button>
        <button class="btn-mini" data-mover="1" aria-label="Mover ${esc(item.nome)} para baixo">↓</button>
        <button class="btn btn-ghost btn-peq" data-recolher aria-controls="${corpo.id}">Recolher</button>
        <button class="btn-mini" data-ocultar aria-label="Ocultar ${esc(item.nome)}">×</button>`;
      titulo.appendChild(ctrl);
      ctrl.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-mover')) { mover(id, itens.findIndex(i=>i.id===id)+Number(b.dataset.mover)); b.focus(); return; }
        if (b.hasAttribute('data-recolher')) { fechados.has(id) ? fechados.delete(id) : fechados.add(id); }
        if (b.hasAttribute('data-ocultar')) { ocultos.add(id); barra.querySelector('summary').focus(); }
        pintar(); salvar(); if (!ocultos.has(id)) b.focus();
      });
      ctrl.querySelector('[draggable]').addEventListener('dragstart', e => {
        arrastando = id; e.dataTransfer.setData('text/plain',id); e.dataTransfer.effectAllowed='move'; el.classList.add('arrastando');
      });
      el.addEventListener('dragover', e => { if (arrastando) { e.preventDefault(); e.dataTransfer.dropEffect='move'; el.classList.add('destino-arraste'); } });
      el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('destino-arraste'); });
      el.addEventListener('drop', e => { if (!arrastando) return; e.preventDefault(); mover(arrastando,itens.findIndex(i=>i.id===id)); el.classList.remove('destino-arraste'); });
      el.addEventListener('dragend', () => { arrastando=null; itens.forEach(i=>i.el.classList.remove('arrastando','destino-arraste')); });
      const b = document.createElement('button'); b.className='btn btn-ghost btn-peq'; b.textContent=item.nome; b.dataset.visibilidade=id;
      b.addEventListener('click',()=>{ ocultos.has(id) ? ocultos.delete(id) : ocultos.add(id); pintar(); salvar(); });
      $('.painel-visibilidade',barra).appendChild(b);
    });
    barra.addEventListener('click', e => {
      const b=e.target.closest('button'); if (!b) return;
      if (b.dataset.layout) prefs.modo=b.dataset.layout;
      if (b.dataset.todos) itens.forEach(({id}) => { if (b.dataset.todos==='fechar') fechados.add(id); else {fechados.delete(id);ocultos.delete(id);} });
      if (b.hasAttribute('data-restaurar')) { itens=[...padrao]; prefs.modo='lista'; fechados.clear(); ocultos.clear(); }
      pintar(); salvar();
    });
    pintar();
  }
};
