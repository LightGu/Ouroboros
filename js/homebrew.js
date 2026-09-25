const Homebrew = {
  render() {
    if (!App.ehMestre) return App.mostrar('mesa');
    const personagens = Store.estado.personagens.filter(p => !p.rapido);
    $('#view-homebrew').innerHTML = `<header class="guia-topo"><h1>Homebrew</h1><p>Conceda proficiências específicas aos jogadores.</p></header>
      <datalist id="homebrew-proficiencias"><option value="Armas pesadas"><option value="Armas táticas"><option value="Proteções pesadas"></datalist>
      <div class="lista-mesas">${personagens.map(p => `<article class="caixa-acao"><h3>${esc(p.nome || 'Sem nome')}</h3>
        <p>${esc(p.proficiencias || CLASSE_INFO[p.classe]?.proficiencias || 'Sem proficiência de classe')}</p>
        <div class="filtros">${(p.proficienciasExtras || []).map((x, i) => `<button class="chip-filtro" data-remover-proficiencia="${p.id}:${i}" title="Remover">${esc(x)} ×</button>`).join('')}</div>
        <form data-add-proficiencia="${p.id}" class="grade-2"><label class="campo"><span class="sr-only">Nova proficiência</span><input name="proficiencia" list="homebrew-proficiencias" placeholder="Ex.: Armas pesadas" required></label><button class="btn btn-primary">Adicionar</button></form>
      </article>`).join('') || '<p class="vazio-linha">Nenhum personagem de jogador.</p>'}</div>`;
    $('#view-homebrew').onclick = e => {
      const botao = e.target.closest('[data-remover-proficiencia]');
      if (!botao) return;
      const [id, indice] = botao.dataset.removerProficiencia.split(':');
      const p = Store.obter(id); p?.proficienciasExtras.splice(Number(indice), 1);
      if (p) { Store.salvar(p); this.render(); }
    };
    $('#view-homebrew').onsubmit = e => {
      const form = e.target.closest('[data-add-proficiencia]');
      if (!form) return; e.preventDefault();
      const p = Store.obter(form.dataset.addProficiencia), nome = form.proficiencia.value.trim();
      if (!p || !nome) return;
      p.proficienciasExtras ||= [];
      if (!p.proficienciasExtras.some(x => Catalogo.normal(x) === Catalogo.normal(nome))) p.proficienciasExtras.push(nome);
      Store.salvar(p); this.render();
    };
  }
};
