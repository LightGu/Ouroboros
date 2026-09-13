/* Tela da mesa: cards, ordem dos turnos, vida */

const Mesa = {

  render() {
    const grid = $('#grid');
    const lista = Store.estado.personagens;

    $('#vazio').hidden = lista.length > 0;
    grid.innerHTML = lista.map((p, i) => this.card(p, i)).join('');

    this.renderTurno();
    this.ligarDragAndDrop();
  },

  /* ---------------- card ---------------- */

  card(p, i) {
    const c = Store.estado.combate;
    const pode = Store.podeEditar(p);
    const naVez = c.ativo && c.indice === i;
    const morto = p.pv.max > 0 && num(p.pv.atual) <= 0;

    const retrato = p.imagem
      ? `<img src="${esc(p.imagem)}" alt="">`
      : `<div class="retrato-vazio" style="--h:${corDoNome(p.nome)}">${esc(iniciais(p.nome))}</div>`;

    const sub = p.rapido
      ? `<span class="tag tag-rapido">Rápido</span>${p.classe ? ' ' + esc(p.classe) : ''}`
      : [p.classe, p.origem].filter(Boolean).map(esc).join(' • ') || '<span class="fraco">sem classe</span>';

    const barrasExtras = p.rapido ? '' : `
      ${this.barra(p, 'pe',  'PE')}
      ${this.barra(p, 'san', 'SAN')}`;

    const meta = p.rapido
      ? (p.notas ? `<p class="card-notas">${esc(p.notas)}</p>` : '')
      : `<div class="card-meta">
           <span title="Defesa"><b>DEF</b> ${defesaTotal(p)}</span>
           <span title="NEX"><b>NEX</b> ${esc(p.nex || 0)}%</span>
           <span title="Deslocamento"><b>DESL</b> ${esc(p.desl || 0)}m</span>
         </div>`;

    const cor = hexDaCor(p.cor);
    return `
    <article class="card ${naVez ? 'na-vez' : ''} ${morto ? 'abatido' : ''} ${p.rapido ? 'e-rapido' : ''} ${pode ? '' : 'so-leitura'} ${cor ? 'tem-dono' : ''}"
             data-id="${p.id}" data-i="${i}" ${cor ? `style="--dono:${cor}"` : ''}>
      <div class="card-barra-topo">
        <span class="alca" title="Arraste para mudar a ordem" data-alca role="button" tabindex="-1">⠿</span>
        <span class="pos">${i + 1}</span>
        <div class="cresce"></div>
        <button class="btn-mini" data-mover="-1" title="Mover para trás">‹</button>
        <button class="btn-mini" data-mover="1" title="Mover para frente">›</button>
        <button class="btn-mini" data-menu title="Opções">⋯</button>
      </div>

      <div class="retrato" data-abrir>
        ${retrato}
        ${naVez ? '<span class="selo-vez">NA VEZ</span>' : ''}
        ${morto ? '<span class="selo-morto">CAÍDO</span>' : ''}
        ${p.oculto ? '<span class="selo-oculto" title="Os jogadores não veem esta ficha">OCULTO</span>' : ''}
      </div>

      <div class="card-corpo">
        <h3 class="card-nome" data-abrir title="Abrir ficha">${esc(p.nome || 'Sem nome')}</h3>
        <p class="card-sub">${sub}</p>
        ${!p.rapido && !p.donoId
          ? '<button class="btn-assumir" data-assumir>Tornar meu personagem</button>'
          : ''}

        ${this.aliados(p)}
        ${this.atributos(p)}
        ${this.bonusInterludio(p)}
        ${this.municoes(p)}
        ${this.condicoes(p)}

        ${p.bestiarioId && !p.pv.max ? '<p class="fraco">PV não informado — consulte a ficha e edite.</p>' : this.barra(p, 'pv', 'PV')}
        ${p.bestiarioId && Store.ehMestre ? '<button class="btn" data-bestiario-ficha>Ficha do inimigo</button>' : ''}

        ${pode ? '' : '<p class="aviso-leitura">Só quem é dono da ficha (ou o mestre) pode mexer.</p>'}

        ${barrasExtras}
        ${meta}
      </div>
    </article>`;
  },

  /* Barra grande: número dentro, metade esquerda tira, metade direita põe,
     e o próprio número é o botão de digitar um valor exato. */
  barra(p, chave, rotulo) {
    const pode = Store.podeEditar(p);
    const editando = Mesa.editando === p.id + ':' + chave;
    const atual = num(p[chave].atual), max = num(p[chave].max);
    const vazio = max > 0 && atual <= 0;
    const baixo = max > 0 && atual > 0 && atual / max <= .3;

    const miolo = editando
      ? `<span class="barrao-edit">
           <input type="number" data-stat="${chave}" value="${atual}" autofocus>
           <i>/</i>
           <input type="number" data-statmax="${chave}" value="${max}">
         </span>`
      : pode
        ? `<button class="barrao-valor" data-editar="${chave}" title="Clique para digitar">${atual}<i>/${max}</i></button>`
        : `<span class="barrao-valor">${atual}<i>/${max}</i></span>`;

    const zona = (lado, passo, dica, sinal) => pode && !editando
      ? `<button class="barrao-zona ${lado}" data-ajuste="${chave}:${passo}" title="${dica}"><span>${sinal}</span></button>`
      : '<span class="barrao-zona"></span>';

    return `
      <div class="stat-barra">
        <span class="stat-rot">${rotulo}</span>
        <div class="barrao ${chave} ${vazio ? 'no-zero' : baixo ? 'baixo' : ''}">
          <div class="barrao-fill" style="width:${pct(atual, max)}%">${atual > 0 ? '<span class="oleo"></span><span class="bolhas"><i></i><i></i><i></i><i></i></span>' : ''}</div>
          ${zona('esq', -1, 'Tirar 1 (Shift = 5)', '−')}
          ${miolo}
          ${zona('dir', 1, 'Pôr 1 (Shift = 5)', '+')}
        </div>
      </div>`;
  },

  /* Aliados no card: a mesa precisa saber que o macaco existe. */
  aliados(p) {
    if (!p.aliados?.length) return '';
    return `<div class="aliados-card">
      ${p.aliados.map(a => {
        const b = (a.bonus || []).filter(x => x.pericia)
          .map(x => '+' + num(x.valor) + ' ' + (PERICIAS.find(y => y.key === x.pericia)?.nome || ''))
          .join(', ');
        return `<span class="aliado-chip" title="${esc(a.descricao || '')}${b ? ' — ' + esc(b) : ''}">
          <span class="aliado-mini">${a.foto ? `<img src="${esc(a.foto)}" alt="">` : esc(iniciais(a.nome || '?'))}</span>
          ${esc(a.nome || 'Aliado')}${b ? `<i>${esc(b)}</i>` : ''}
        </span>`;
      }).join('')}
    </div>`;
  },

  /* Atributos no card: o mestre precisa deles pra pedir teste sem abrir a ficha.
     Personagem rápido não tem ficha, então não mostra. */
  atributos(p) {
    if (p.rapido) return '';
    return `<div class="atrib-card">
      ${ATRIBUTOS.map(a => {
        const v = num(p.atributos[a.key]);
        return `<span class="atrib ${v === 0 ? 'zero' : ''}" title="${esc(a.nome)}">
                  <b>${v}</b><i>${a.key}</i>
                </span>`;
      }).join('')}
    </div>`;
  },

  /* +1d6 guardados do interlúdio. Clicar gasta um. */
  bonusInterludio(p) {
    const b = p.bonus || {};
    if (!num(b.corpo) && !num(b.mente)) return '';
    const pode = Store.podeEditar(p);
    const chip = (chave, rotulo, teto) => {
      const n = num(b[chave]);
      if (!n) return '';
      return `<button class="bon" data-bonus="${chave}" ${pode ? '' : 'disabled'}
               title="${rotulo} — clique para gastar um (teto ${teto})">
               <b>+1d6</b> ${rotulo} <i>×${n}</i></button>`;
    };
    return `<div class="bonus-il">
      ${chip('corpo', 'AGI/FOR/VIG', num(p.atributos.VIG))}
      ${chip('mente', 'INT/PRE', num(p.atributos.INT))}
    </div>`;
  },

  municoes(p) {
    if (!p.municoes?.length) return '';
    const pode = Store.podeEditar(p);
    return `<div class="municoes">${p.municoes.map((m, i) => {
      const atual = num(m.atual), max = num(m.max);
      const vazio = atual <= 0;
      const pouco = max > 0 && atual > 0 && atual / max <= 1 / 3;
      return `
        <span class="mun ${vazio ? 'mun-vazia' : pouco ? 'mun-pouca' : ''}" title="${esc(m.nome || 'Munição')}">
          ${pode ? `<button data-mun="${i}:-1" title="Gastar 1 (Shift = 5)">−</button>` : ''}
          <b class="mun-nome">${esc(m.nome || 'Munição')}</b>
          <b class="mun-num">${atual}<i>/${max}</i></b>
          ${pode ? `<button data-mun="${i}:1" title="Repor 1 (Shift = 5)">+</button>
                    <button data-recarregar="${i}" title="Recarregar até o máximo">↻</button>` : ''}
        </span>`;
    }).join('')}</div>`;
  },

  condicoes(p) {
    const pode = Store.podeEditar(p);
    const chips = (p.condicoes || []).map((c, i) =>
      `<span class="chip">${esc(c)}${pode ? `<button data-remcond="${i}" title="Remover">✕</button>` : ''}</span>`).join('');
    if (!pode && !chips) return '';
    return `<div class="condicoes">${chips}${pode ? '<button class="chip chip-add" data-addcond>+ condição</button>' : ''}</div>`;
  },

  /* ---------------- ações ---------------- */

  aplicar(id, sinal, quantidade) {
    const p = Store.obter(id);
    if (!p) return;
    if (!Store.podeEditar(p)) return toast('Essa ficha não é sua.', 'erro');
    const q = Math.abs(num(quantidade, 1));
    const max = num(p.pv.max);
    let novo = num(p.pv.atual) + sinal * q;
    if (max > 0) novo = Math.min(max, novo);
    p.pv.atual = Math.max(0, novo);
    Store.salvar(p);
    this.render();
  },

  ajustar(id, chave, delta) {
    const p = Store.obter(id);
    if (!p) return;
    if (!Store.podeEditar(p)) return toast('Essa ficha não é sua.', 'erro');
    const max = num(p[chave].max);
    let novo = num(p[chave].atual) + delta;
    if (max > 0) novo = Math.min(max, novo);
    p[chave].atual = Math.max(0, novo);
    Store.salvar(p);
    this.render();
  },

  mover(id, direcao) {
    const lista = Store.estado.personagens;
    const i = lista.findIndex(p => p.id === id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    Store.salvarOrdem();
    this.render();
  },

  menu(id, botao) {
    const p = Store.obter(id);
    const pode = Store.podeEditar(p);
    document.querySelectorAll('.popover').forEach(el => el.remove());
    const pop = document.createElement('div');
    pop.className = 'popover';
    pop.innerHTML = `
      <button data-op="abrir">${p.rapido ? 'Editar rápido' : 'Abrir ficha'}</button>
      ${pode ? '<button data-op="imagem">Trocar imagem</button>' : ''}
      ${pode ? '<button data-op="cheio">Restaurar PV/PE/SAN</button>' : ''}
      <button data-op="topo">Mandar pro topo</button>
      ${Store.ehMestre ? `<button data-op="oculto">${p.oculto ? 'Mostrar pros jogadores' : 'Esconder dos jogadores'}</button>` : ''}
      ${Store.ehMestre ? '<button data-op="dono">Definir dono</button>' : ''}
      ${pode && !p.rapido ? '<button data-op="cor">Minha cor</button>' : ''}
      ${Store.ehMestre && !p.rapido && p.donoId ? '<button data-op="liberar">Liberar pros jogadores</button>' : ''}
      ${pode ? '<button data-op="duplicar">Duplicar</button>' : ''}
      ${pode ? '<button data-op="remover" class="perigo">Remover da mesa</button>' : ''}`;
    botao.closest('.card').appendChild(pop);

    pop.addEventListener('click', async e => {
      const op = e.target.dataset.op;
      if (!op) return;
      pop.remove();
      if (op === 'abrir')     p.rapido ? Mesa.modalRapido(p) : Ficha.abrir(p.id);
      if (op === 'imagem')    Mesa.trocarImagem(p.id);
      if (op === 'dono')      Mesa.definirDono(p);
      if (op === 'cor')       Mesa.escolherCor(p);
      if (op === 'liberar')   Mesa.liberar(p);
      if (op === 'duplicar')  { await Store.duplicar(p.id); Mesa.render(); }
      if (op === 'oculto')    { p.oculto = !p.oculto; Store.salvar(p); Mesa.render();
                                toast(p.oculto ? 'Escondido dos jogadores.' : 'Visível pros jogadores.'); }
      if (op === 'topo')      { const l = Store.estado.personagens; const i = l.findIndex(x => x.id === p.id);
                                l.unshift(l.splice(i, 1)[0]); Store.salvarOrdem(); Mesa.render(); }
      if (op === 'cheio')     { ['pv', 'pe', 'san'].forEach(k => p[k].atual = num(p[k].max));
                                Store.salvar(p); Mesa.render(); toast(`${p.nome || 'Agente'} restaurado.`); }
      if (op === 'remover')   Mesa.confirmarRemocao(p);
    });

    setTimeout(() => {
      document.addEventListener('click', function fora(ev) {
        if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', fora); }
      });
    }, 0);
  },

  confirmarRemocao(p) {
    Modal.abrir({
      titulo: 'Remover da mesa',
      corpo: `<p class="dialogo">Remover <b>${esc(p.nome || 'esse personagem')}</b> da mesa? A ficha será apagada e isso não pode ser desfeito.</p>`,
      confirmar: 'Remover', perigo: true,
      onConfirmar: async () => {
        try { await Store.remover(p.id); Mesa.render(); toast('Removido da mesa.'); }
        catch (e) { toast('Não consegui remover: ' + (e.message || e), 'erro'); }
      }
    });
  },

  /* O jogador assume uma ficha livre e escolhe a cor dele. */
  assumir(p) {
    Modal.abrir({
      titulo: 'Tornar meu personagem',
      corpo: `
        <p class="dialogo">Você vira o dono de <b>${esc(p.nome || 'esta ficha')}</b>.
           A partir daí só você e o mestre podem editar.</p>
        <p class="dialogo fraco">Escolha uma cor — ela marca a borda do card pra mesa
           saber de relance quem é quem.</p>
        ${Mesa.paleta('')}`,
      confirmar: 'Assumir',
      onConfirmar: async () => {
        const cor = $('input[name="cor"]:checked')?.value;
        if (!cor) { toast('Escolhe uma cor.', 'erro'); return false; }
        try {
          await Nuvem.reivindicar(p.id, cor);
          p.donoId = App.sessao.user.id;
          p.cor = cor;
          Mesa.render();
          toast('Agora é seu.');
        } catch (e) { toast(String(e.message || e), 'erro'); return false; }
      }
    });
  },

  escolherCor(p) {
    Modal.abrir({
      titulo: 'Minha cor',
      corpo: `<p class="dialogo fraco">Marca a borda do card de <b>${esc(p.nome || 'sua ficha')}</b>.</p>
              ${Mesa.paleta(p.cor)}`,
      confirmar: 'Salvar',
      onConfirmar: () => {
        const cor = $('input[name="cor"]:checked')?.value || '';
        p.cor = cor;
        Store.salvar(p);
        Mesa.render();
      }
    });
  },

  paleta(atual) {
    return `<div class="paleta">
      ${CORES.map(c => `
        <label class="cor" style="--c:${c.hex}" title="${c.nome}">
          <input type="radio" name="cor" value="${c.id}" ${atual === c.id ? 'checked' : ''}>
          <span></span>
        </label>`).join('')}
    </div>`;
  },

  liberar(p) {
    Modal.abrir({
      titulo: 'Liberar ficha',
      corpo: `<p class="dialogo">Tirar o dono de <b>${esc(p.nome || 'esta ficha')}</b>?
              Ela volta a aparecer com o botão <i>Tornar meu personagem</i> pra quem quiser assumir.</p>`,
      confirmar: 'Liberar',
      onConfirmar: async () => {
        try {
          await Nuvem.liberar(p.id);
          p.donoId = null;
          Mesa.render();
          toast('Ficha liberada.');
        } catch (e) { toast(String(e.message || e), 'erro'); }
      }
    });
  },

  async definirDono(p) {
    let membros = [];
    try { membros = await Nuvem.membros(Store.mesaId); }
    catch (e) { return toast('Não consegui listar os membros.', 'erro'); }

    Modal.abrir({
      titulo: 'Dono da ficha',
      corpo: `<p class="dialogo">Quem pode editar <b>${esc(p.nome || 'essa ficha')}</b> além de você.</p>
              <label class="campo"><span>Jogador</span>
                <select id="sel-dono">
                  <option value="">— ninguém (só o mestre) —</option>
                  ${membros.map(m => `<option value="${m.id}" ${p.donoId === m.id ? 'selected' : ''}>
                      ${esc(m.nome)}${m.papel === 'mestre' ? ' (mestre)' : ''}</option>`).join('')}
                </select></label>`,
      confirmar: 'Salvar',
      onConfirmar: () => {
        p.donoId = $('#sel-dono').value || null;
        Store.salvar(p); Mesa.render();
      }
    });
  },

  trocarImagem(id) {
    const p = Store.obter(id);
    Modal.abrir({
      titulo: 'Imagem do personagem',
      corpo: `
        <label class="campo">
          <span>Enviar arquivo</span>
          <input type="file" id="img-arquivo" accept="image/*">
        </label>
        <label class="campo">
          <span>Ou colar um link (URL)</span>
          <input type="url" id="img-url" placeholder="https://..." value="${p.imagem?.startsWith('http') ? esc(p.imagem) : ''}">
        </label>
        <div class="previa" id="img-previa">${p.imagem ? `<img src="${esc(p.imagem)}" alt="">` : '<span class="fraco">sem imagem</span>'}</div>
        <button class="btn btn-ghost" id="img-limpar" type="button">Remover imagem</button>`,
      confirmar: 'Salvar',
      onConfirmar: async () => {
        const url = $('#img-url').value.trim();
        const pendente = Modal._imagemPendente;
        delete Modal._imagemPendente;
        try {
          if (pendente) p.imagem = await Nuvem.enviarRetrato(pendente, Store.mesaId, p.id);
          else if (pendente === '') p.imagem = '';
          else if (url) p.imagem = url;
        } catch (e) {
          toast('Falhou o envio da imagem: ' + (e.message || e), 'erro');
          return;
        }
        Store.salvar(p);
        Mesa.render();
        if (Ficha.atual && Ficha.atual.id === id) Ficha.abrir(id);
      }
    });

    $('#img-arquivo').addEventListener('change', async e => {
      try {
        const dados = await lerImagem(e.target.files[0]);
        Modal._imagemPendente = dados;
        $('#img-previa').innerHTML = `<img src="${dados}" alt="">`;
      } catch (err) { toast('Não consegui ler essa imagem.', 'erro'); }
    });
    $('#img-limpar').addEventListener('click', () => {
      Modal._imagemPendente = '';
      $('#img-url').value = '';
      $('#img-previa').innerHTML = '<span class="fraco">sem imagem</span>';
    });
  },

  addCondicao(id) {
    const p = Store.obter(id);
    Modal.abrir({
      titulo: 'Adicionar condição',
      corpo: `<label class="campo"><span>Condição</span>
                <input id="cond-txt" placeholder="Ex.: Sangrando, Atordoado, Enfeitiçado" list="lista-cond">
                <datalist id="lista-cond">
                  ${['Abalado','Agarrado','Atordoado','Caído','Cego','Confuso','Debilitado','Desprevenido','Enfeitiçado','Enjoado','Exausto','Fatigado','Fraco','Frustrado','Imóvel','Inconsciente','Lento','Paralisado','Pasmo','Sangrando','Surdo','Vulnerável']
                    .map(c => `<option value="${c}">`).join('')}
                </datalist></label>`,
      confirmar: 'Adicionar',
      onConfirmar: () => {
        const v = $('#cond-txt').value.trim();
        if (!v) return false;
        p.condicoes.push(v); Store.salvar(p); Mesa.render();
      }
    });
  },

  /* ---------------- personagem rápido ---------------- */

  modalRapido(existente) {
    if (!Store.ehMestre) return toast('Só o mestre cria personagem rápido.', 'erro');
    const p = existente || null;
    Modal.abrir({
      titulo: p ? 'Editar personagem rápido' : 'Personagem rápido',
      corpo: `
        <p class="dialogo fraco">Pra NPCs e inimigos que só precisam entrar na ordem dos turnos.</p>
        <div class="grade-2">
          <label class="campo"><span>Nome *</span><input id="r-nome" value="${esc(p?.nome || '')}" placeholder="Ex.: Zumbi Sanguinário"></label>
          <label class="campo"><span>Tipo / rótulo</span><input id="r-classe" value="${esc(p?.classe || '')}" placeholder="Ex.: Criatura, Capanga"></label>
          <label class="campo"><span>PV atual</span><input id="r-pva" type="number" value="${p ? num(p.pv.atual) : 20}"></label>
          <label class="campo"><span>PV máximo</span><input id="r-pvm" type="number" value="${p ? num(p.pv.max) : 20}"></label>
        </div>
        <label class="campo"><span>Notas rápidas</span><textarea id="r-notas" rows="2" placeholder="Def 15, ataque +8 / 1d8+3...">${esc(p?.notas || '')}</textarea></label>
        <label class="campo"><span>Imagem (opcional)</span><input type="file" id="r-img" accept="image/*"></label>
        <div class="previa" id="r-previa">${p?.imagem ? `<img src="${esc(p.imagem)}">` : '<span class="fraco">sem imagem</span>'}</div>`,
      confirmar: p ? 'Salvar' : 'Adicionar à mesa',
      onConfirmar: async () => {
        const nome = $('#r-nome').value.trim();
        if (!nome) { toast('Dá um nome pra ele.', 'erro'); return false; }
        const pendente = Modal._imagemPendente;
        delete Modal._imagemPendente;
        let alvo = p;
        try {
          if (!alvo) alvo = await Store.criar(true);
          alvo.rapido = true;
          alvo.nome = nome;
          alvo.classe = $('#r-classe').value.trim();
          alvo.pv.max = num($('#r-pvm').value);
          alvo.pv.atual = num($('#r-pva').value);
          alvo.notas = $('#r-notas').value;
          if (pendente) alvo.imagem = await Nuvem.enviarRetrato(pendente, Store.mesaId, alvo.id);
          else if (pendente === '') alvo.imagem = '';
          Store.salvar(alvo);
          Mesa.render();
        } catch (e) {
          toast('Não consegui salvar: ' + (e.message || e), 'erro');
          return false;
        }
      }
    });

    $('#r-img').addEventListener('change', async e => {
      try {
        const dados = await lerImagem(e.target.files[0]);
        Modal._imagemPendente = dados;
        $('#r-previa').innerHTML = `<img src="${dados}">`;
      } catch { toast('Não consegui ler essa imagem.', 'erro'); }
    });

    /* PV máximo alimenta o atual enquanto ainda está zerado/igual */
    const max = $('#r-pvm'), atual = $('#r-pva');
    max.addEventListener('input', () => { atual.value = max.value; });
  },

  /* ---------------- turnos ---------------- */

  renderTurno() {
    const c = Store.estado.combate;
    const lista = Store.estado.personagens;
    /* quem não é mestre acompanha, não dirige */
    $('.turnbar-left').hidden = !Store.ehMestre;
    ['#btn-anterior', '#btn-proximo', '#btn-parar'].forEach(sel => { $(sel).hidden = !Store.ehMestre; });
    $('#btn-turnos').hidden = c.ativo || !Store.ehMestre;
    $('#turno-info').hidden = !c.ativo;
    $('#btn-turnos').textContent = '▶ Iniciar turnos';
    if (c.ativo) {
      $('#rodada-num').textContent = c.rodada;
      $('#turno-nome').textContent = lista[c.indice]?.nome || '—';
    }
  },

  iniciarTurnos() {
    if (!Store.ehMestre) return;
    if (!Store.estado.personagens.length) return toast('Adicione alguém à mesa primeiro.', 'erro');
    Store.estado.combate = { ativo: true, indice: 0, rodada: 1 };
    Store.salvarCombate(); this.render();
  },

  pararTurnos() {
    Store.estado.combate.ativo = false;
    $('#log-iniciativa').hidden = true;
    Store.salvarCombate(); this.render();
  },

  passarTurno(direcao) {
    if (!Store.ehMestre) return;
    const c = Store.estado.combate;
    const n = Store.estado.personagens.length;
    if (!n) return;
    c.indice += direcao;
    if (c.indice >= n) { c.indice = 0; c.rodada++; }
    if (c.indice < 0)  { c.indice = n - 1; c.rodada = Math.max(1, c.rodada - 1); }
    Store.salvarCombate(); this.render();
  },

  rolarIniciativa() {
    if (!Store.ehMestre) return;
    const lista = Store.estado.personagens;
    if (!lista.length) return toast('Adicione alguém à mesa primeiro.', 'erro');

    const rolagens = lista.map(p => {
      const b = p.rapido
        ? { dados: 1, bonus: 0 }
        : bonusPericia(p, 'iniciativa');
      const qtd = Math.max(1, b.dados);
      const dados = Array.from({ length: qtd }, d20);
      const escolhido = b.dados <= 0 ? Math.min(...Array.from({ length: 2 }, d20)) : Math.max(...dados);
      return { p, total: escolhido + b.bonus, dado: escolhido, bonus: b.bonus };
    });

    rolagens.sort((a, b) => b.total - a.total);
    Store.reordenar(rolagens.map(r => r.p.id));
    Store.estado.combate = { ativo: true, indice: 0, rodada: 1 };
    Store.salvarCombate();

    const log = $('#log-iniciativa');
    log.hidden = false;
    log.innerHTML = `<b>Iniciativa:</b> ` + rolagens.map((r, i) =>
      `<span class="rol"><i>${i + 1}º</i> ${esc(r.p.nome || 'Sem nome')} <b>${r.total}</b>
       <em>(d20 ${r.dado}${r.bonus ? (r.bonus > 0 ? ' +' : ' −') + Math.abs(r.bonus) : ''})</em></span>`).join('');
    this.render();
  },

  /* ---------------- drag & drop ---------------- */

  ligarDragAndDrop() {
    const grid = $('#grid');
    let arrastado = null;

    $$('.card', grid).forEach(card => {
      const alca = $('[data-alca]', card);
      alca.addEventListener('mousedown', () => { card.draggable = true; });
      alca.addEventListener('touchstart', () => { card.draggable = true; }, { passive: true });

      card.addEventListener('dragstart', e => {
        arrastado = card;
        card.classList.add('arrastando');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.id);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('arrastando');
        card.draggable = false;
        arrastado = null;
        Store.reordenar($$('.card', grid).map(c => c.dataset.id));
        Mesa.render();
      });

      card.addEventListener('dragover', e => {
        e.preventDefault();
        if (!arrastado || arrastado === card) return;
        const r = card.getBoundingClientRect();
        const depois = (e.clientX - r.left) > r.width / 2;
        grid.insertBefore(arrastado, depois ? card.nextSibling : card);
      });
    });

    if (!grid.dataset.ligado) {
      grid.dataset.ligado = '1';
      grid.addEventListener('dragover', e => e.preventDefault());
    }
  }
};

function pct(atual, max) {
  const m = num(max);
  if (m <= 0) return 0;
  return Math.max(0, Math.min(100, (num(atual) / m) * 100));
}

/* ---------------- delegação de eventos ---------------- */

document.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (!card) return;
  const id = card.dataset.id;

  if (e.target.closest('[data-mover]'))       return Mesa.mover(id, Number(e.target.dataset.mover));
  if (e.target.closest('[data-menu]'))        return Mesa.menu(id, e.target);
  if (e.target.closest('[data-addcond]'))     return Mesa.addCondicao(id);
  if (e.target.closest('[data-assumir]'))     return Mesa.assumir(Store.obter(id));

  const bon = e.target.closest('[data-bonus]');
  if (bon) {
    const p = Store.obter(id);
    if (!Store.podeEditar(p)) return toast('Essa ficha não é sua.', 'erro');
    const chave = bon.dataset.bonus;
    p.bonus[chave] = Math.max(0, num(p.bonus[chave]) - 1);
    Store.salvar(p); Mesa.render();
    return Rolagem.rolarTexto('1d6', 'Bônus de interlúdio', p.nome);
  }

  const mun = e.target.closest('[data-mun]');
  if (mun) {
    const p = Store.obter(id);
    if (!Store.podeEditar(p)) return toast('Essa ficha não é sua.', 'erro');
    const [i, d] = mun.dataset.mun.split(':');
    const m = p.municoes[Number(i)];
    const passo = Number(d) * (e.shiftKey ? 5 : 1);
    m.atual = Math.max(0, Math.min(num(m.max) || Infinity, num(m.atual) + passo));
    Store.salvar(p); return Mesa.render();
  }

  const rec = e.target.closest('[data-recarregar]');
  if (rec) {
    const p = Store.obter(id);
    if (!Store.podeEditar(p)) return toast('Essa ficha não é sua.', 'erro');
    const m = p.municoes[Number(rec.dataset.recarregar)];
    m.atual = num(m.max);
    Store.salvar(p); return Mesa.render();
  }

  const ed = e.target.closest('[data-editar]');
  if (ed) { Mesa.editando = id + ':' + ed.dataset.editar; return Mesa.render(); }

  const ajuste = e.target.closest('[data-ajuste]');
  if (ajuste) {
    const [chave, delta] = ajuste.dataset.ajuste.split(':');
    return Mesa.ajustar(id, chave, Number(delta) * (e.shiftKey ? 5 : 1));
  }

  const rem = e.target.closest('[data-remcond]');
  if (rem) {
    const p = Store.obter(id);
    p.condicoes.splice(Number(rem.dataset.remcond), 1);
    Store.salvar(p); return Mesa.render();
  }

  if (e.target.closest('[data-bestiario-ficha]') && Store.ehMestre) return App.mostrar('bestiario', Store.obter(id).bestiarioId);

  if (e.target.closest('[data-abrir]')) {
    const p = Store.obter(id);
    return p.rapido ? Mesa.modalRapido(p) : Ficha.abrir(id);
  }
});

/* edição direta dos números no card */
document.addEventListener('change', e => {
  const card = e.target.closest('#grid .card');
  if (!card) return;
  const p = Store.obter(card.dataset.id);
  if (!p) return;
  const stat = e.target.dataset.stat, statMax = e.target.dataset.statmax;
  if (!Store.podeEditar(p)) { Mesa.render(); return toast('Essa ficha não é sua.', 'erro'); }
  if (stat)    { p[stat].atual = Math.max(0, num(e.target.value)); Mesa.editando = null; Store.salvar(p); Mesa.render(); }
  if (statMax) { p[statMax].max = Math.max(0, num(e.target.value)); Mesa.editando = null; Store.salvar(p); Mesa.render(); }
});

/* fecha o campo de digitar valor ao clicar fora ou apertar Esc */
document.addEventListener('pointerdown', e => {
  if (Mesa.editando && !e.target.closest('.barrao-edit')) { Mesa.editando = null; Mesa.render(); }
}, true);

document.addEventListener('keydown', e => {
  if (!Mesa.editando) return;
  if (e.key === 'Escape') { Mesa.editando = null; Mesa.render(); }
  if (e.key === 'Enter') e.target.blur();
});
