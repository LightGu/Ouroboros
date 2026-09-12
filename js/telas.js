/* Login, cadastro e escolha de mesa */

const Telas = {

  /* ---------------- login / cadastro ---------------- */

  modo: 'entrar',

  ligarAuth() {
    $$('.alt').forEach(b => b.addEventListener('click', () => {
      this.modo = b.dataset.modo;
      $$('.alt').forEach(x => x.classList.toggle('ativa', x === b));
      $('#campo-nome').hidden = this.modo === 'entrar';
      $('#auth-senha').autocomplete = this.modo === 'entrar' ? 'current-password' : 'new-password';
      $('#btn-auth').textContent = this.modo === 'entrar' ? 'Entrar' : 'Criar conta';
      $('#auth-erro').hidden = true;
    }));

    $('#form-auth').addEventListener('submit', async e => {
      e.preventDefault();
      const nome  = $('#auth-nome').value.trim();
      const email = $('#auth-email').value.trim();
      const senha = $('#auth-senha').value;
      const btn = $('#btn-auth');
      const erro = $('#auth-erro');

      erro.hidden = true;
      btn.disabled = true;
      btn.textContent = 'Aguarde...';

      try {
        if (this.modo === 'cadastrar') {
          if (!nome) throw new Error('Diz seu nome pra mesa saber quem é quem.');
          const r = await Nuvem.cadastrar(nome, email, senha);
          if (!r.session) {
            erro.textContent = 'Conta criada. Confirma o link que chegou no seu email e volta aqui pra entrar.';
            erro.hidden = false;
            $$('.alt')[0].click();
            return;
          }
        } else {
          await Nuvem.entrar(email, senha);
        }
        await App.aposLogin();
      } catch (err) {
        erro.textContent = this.traduzir(err.message || String(err));
        erro.hidden = false;
      } finally {
        btn.disabled = false;
        btn.textContent = this.modo === 'entrar' ? 'Entrar' : 'Criar conta';
      }
    });
  },

  traduzir(msg) {
    const m = msg.toLowerCase();
    if (m.includes('invalid login')) return 'Email ou senha não conferem.';
    if (m.includes('already registered')) return 'Esse email já tem conta. Tenta entrar.';
    if (m.includes('password should be')) return 'A senha precisa de pelo menos 6 caracteres.';
    if (m.includes('email not confirmed')) return 'Falta confirmar o email — olha sua caixa de entrada.';
    if (m.includes('failed to fetch')) return 'Não consegui falar com o servidor. Confere sua internet.';
    return msg;
  },

  /* ---------------- mesas ---------------- */

  async renderMesas() {
    const alvo = $('#lista-mesas');
    alvo.innerHTML = '<p class="vazio-linha">Carregando...</p>';
    let mesas = [];
    try { mesas = await Nuvem.mesas(); }
    catch (e) { alvo.innerHTML = `<p class="vazio-linha">Erro: ${esc(e.message || e)}</p>`; return; }

    if (!mesas.length) {
      alvo.innerHTML = '<p class="vazio-linha">Você ainda não está em nenhuma mesa. Crie uma abaixo, ou entre com um código.</p>';
      return;
    }

    alvo.innerHTML = mesas.map(m => `
      <button class="mesa-item" data-mesa="${esc(m.id)}">
        <span class="mesa-item-nome">${esc(m.nome)}</span>
        <span class="tag ${m.papel === 'mestre' ? 'tag-mestre' : 'tag-jogador'}">${m.papel}</span>
        ${m.papel === 'mestre' ? `<span class="mesa-codigo" title="Código pros jogadores">${esc(m.codigo)}</span>` : ''}
        <span class="mesa-seta">›</span>
      </button>`).join('');

    $$('.mesa-item', alvo).forEach(b => b.addEventListener('click', () => {
      const m = mesas.find(x => x.id === b.dataset.mesa);
      App.entrarNaMesa(m);
    }));
  },

  ligarMesas() {
    $('#btn-criar-mesa').addEventListener('click', async () => {
      const nome = $('#nova-mesa').value.trim();
      if (!nome) return toast('Dá um nome pra mesa.', 'erro');
      const btn = $('#btn-criar-mesa');
      btn.disabled = true;
      try {
        await Nuvem.criarMesa(nome);
        $('#nova-mesa').value = '';
        await this.renderMesas();
        toast('Mesa criada!');
      } catch (e) { toast('Erro: ' + (e.message || e), 'erro'); }
      finally { btn.disabled = false; }
    });

    $('#btn-entrar-mesa').addEventListener('click', async () => {
      const codigo = $('#codigo-mesa').value.trim();
      if (!codigo) return toast('Cola o código da mesa.', 'erro');
      const btn = $('#btn-entrar-mesa');
      btn.disabled = true;
      try {
        await Nuvem.entrarMesa(codigo);
        $('#codigo-mesa').value = '';
        await this.renderMesas();
        toast('Entrou na mesa!');
      } catch (e) { toast(String(e.message || e).replace('.', ''), 'erro'); }
      finally { btn.disabled = false; }
    });

    $('#btn-sair-mesas').addEventListener('click', () => App.sair());
  },

  /* ---------------- menu da conta ---------------- */

  menuConta(botao) {
    document.querySelectorAll('.popover').forEach(el => el.remove());
    const pop = document.createElement('div');
    pop.className = 'popover popover-conta';
    pop.innerHTML = `
      ${App.ehMestre ? `<button data-op="codigo">Código da mesa: <b>${esc(App.mesa.codigo)}</b></button>` : ''}
      <button data-op="jogadores">Quem está na mesa</button>
      <button data-op="trocar">Trocar de mesa</button>
      <button data-op="nome">Mudar meu nome</button>
      <button data-op="outra">Entrar com outra conta</button>
      ${Contas.html()}
      <button data-op="sair" class="perigo">Sair da conta</button>`;
    botao.parentElement.appendChild(pop);

    pop.addEventListener('click', async e => {
      const troca = e.target.closest('[data-conta]');
      if (troca) { pop.remove(); return Contas.trocar(troca.dataset.conta); }
      const op = e.target.closest('button')?.dataset.op;
      if (!op) return;
      pop.remove();
      if (op === 'codigo') {
        try { await navigator.clipboard.writeText(App.mesa.codigo); toast('Código copiado.'); }
        catch { toast('Código: ' + App.mesa.codigo); }
      }
      if (op === 'jogadores') this.modalJogadores();
      if (op === 'trocar') App.trocarMesa();
      if (op === 'nome')   this.modalNome();
      if (op === 'outra')  Contas.novaConta();
      if (op === 'sair')   App.sair();
    });

    setTimeout(() => {
      document.addEventListener('click', function fora(ev) {
        if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', fora); }
      });
    }, 0);
  },

  listaAberta: false,

  /* Quem já entrou na mesa, e quem está com ela aberta agora. */
  async modalJogadores() {
    this.listaAberta = true;
    Modal.abrir({
      titulo: 'Quem está na mesa',
      corpo: '<p class="dialogo fraco">carregando...</p>',
      confirmar: 'Fechar', cancelar: '',
      onConfirmar: () => { this.listaAberta = false; }
    });
    $('[data-modal-cancelar]')?.remove();

    try { this._membros = await Nuvem.membros(App.mesa.id); }
    catch (e) {
      $('#modal-body').innerHTML = `<p class="dialogo">Não consegui carregar: ${esc(e.message || e)}</p>`;
      return;
    }
    this.renderJogadores();
  },

  renderJogadores() {
    const corpo = $('#modal-body');
    if (!corpo || !this._membros) return;
    setTimeout(() => $$('[data-tirar]', corpo).forEach(b =>
      b.addEventListener('click', () => this.tirarDaMesa(b.dataset.tirar))), 0);

    const lista = this._membros.slice().sort((a, b) =>
      (a.papel === 'mestre' ? -1 : b.papel === 'mestre' ? 1 : 0) || a.nome.localeCompare(b.nome, 'pt-BR'));

    const quando = d => d ? new Date(d).toLocaleDateString('pt-BR',
      { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

    corpo.innerHTML = `
      <p class="dialogo">
        <b>${lista.length}</b> ${lista.length === 1 ? 'pessoa' : 'pessoas'} na mesa.
        ${App.ehMestre ? `Código de convite: <b class="mesa-codigo">${esc(App.mesa.codigo)}</b>` : ''}
      </p>
      <div class="lista-jogadores">
        ${lista.map(m => {
          const fichas = Store.estado.personagens.filter(p => p.donoId === m.id && !p.rapido);
          return `
          <div class="jogador">
            <span class="jogador-nome">${esc(m.nome)}</span>
            <span class="tag ${m.papel === 'mestre' ? 'tag-mestre' : 'tag-jogador'}">${m.papel}</span>
            <span class="cresce"></span>
            <span class="jogador-quando">entrou ${esc(quando(m.entrouEm))}</span>
            <span class="jogador-fichas">${fichas.length
              ? fichas.map(f => esc(f.nome || 'sem nome')).join(', ')
              : '<i>sem ficha</i>'}</span>
            ${App.ehMestre && m.papel !== 'mestre'
              ? `<button class="btn-mini perigo" data-tirar="${esc(m.id)}" title="Tirar da mesa">✕</button>` : ''}
          </div>`;
        }).join('')}
      </div>
      <p class="dialogo fraco">Quem está aqui já entrou com o código pelo menos uma vez.</p>`;
  },

  /* Tirar alguém da mesa. O vínculo some; a ficha fica, porque ela é parte
     da campanha — quem saiu é que perde o acesso, já que deixa de ser membro. */
  tirarDaMesa(id) {
    const m = this._membros.find(x => x.id === id);
    if (!m) return;
    const fichas = Store.estado.personagens.filter(p => p.donoId === id && !p.rapido);

    Modal.abrir({
      titulo: 'Tirar da mesa',
      corpo: `
        <p class="dialogo">Tirar <b>${esc(m.nome)}</b> da mesa? Ele perde o acesso a tudo:
           fichas, mapa, celular e anotações.</p>
        ${fichas.length ? `
          <p class="dialogo fraco">${fichas.length === 1 ? 'A ficha' : 'As fichas'}
             <b>${fichas.map(f => esc(f.nome || 'sem nome')).join(', ')}</b> continua${fichas.length === 1 ? '' : 'm'}
             na mesa — ela é parte da campanha.</p>
          <label class="radio"><input type="checkbox" id="tirar-liberar" checked>
            liberar ${fichas.length === 1 ? 'essa ficha' : 'essas fichas'} pra outra pessoa assumir</label>`
          : '<p class="dialogo fraco">Ele não tem ficha nesta mesa.</p>'}
        <p class="dialogo fraco">As mensagens dele continuam na aba Mensagens.
           Se você passar o código de novo, ele consegue voltar.</p>`,
      confirmar: 'Tirar da mesa', perigo: true,
      onConfirmar: async () => {
        const liberar = $('#tirar-liberar')?.checked;
        try {
          if (liberar) {
            for (const f of fichas) { await Nuvem.liberar(f.id); f.donoId = null; }
          }
          await Nuvem.removerMembro(App.mesa.id, id);
          this._membros = this._membros.filter(x => x.id !== id);
          Celular.membros = this._membros;
          Mesa.render();
          toast(`${m.nome} saiu da mesa.`);
        } catch (e) { toast('Não consegui: ' + (e.message || e), 'erro'); return false; }
      }
    });
  },

  modalNome() {
    Modal.abrir({
      titulo: 'Seu nome na mesa',
      corpo: `<label class="campo"><span>Nome</span><input id="novo-nome" value="${esc(App.perfil?.nome || '')}"></label>
              <p class="dialogo fraco">É esse nome que aparece nos logs.</p>`,
      confirmar: 'Salvar',
      onConfirmar: async () => {
        const nome = $('#novo-nome').value.trim();
        if (!nome) return false;
        try {
          await Nuvem.renomearPerfil(nome);
          App.perfil.nome = nome;
          $('#conta-nome').textContent = nome;
          toast('Nome atualizado.');
        } catch (e) { toast('Erro: ' + (e.message || e), 'erro'); return false; }
      }
    });
  }
};
