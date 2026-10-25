/* Painel global de moderação. A interface é discreta, mas a autorização nunca
   depende dela: todas as consultas são validadas e auditadas no Supabase. */

const AdminMestre = {
  itens: [],
  erro(e) {
    const msg = String(e?.message || e || 'Erro desconhecido');
    return /sou_super_mestre|painel_super_mestre|schema cache/i.test(msg)
      ? 'Falta executar sql/migrations/v32-super-mestre.sql no Supabase.' : msg;
  },
  liberado() {
    try { return localStorage.getItem('ouroboros_super_mestre_' + App.sessao?.user?.id) === '1'; }
    catch { return false; }
  },

  async abrir() {
    if (!App.sessao) return;
    if (this.liberado()) return this.carregar();
    Modal.abrir({
      titulo: 'Acesso do Mestre Principal',
      corpo: `<p class="dialogo">Confirme a senha da sua conta para abrir o painel administrativo.</p>
        <label class="campo"><span>Senha</span><input id="super-senha" type="password" autocomplete="current-password" minlength="6"></label>
        <p class="dialogo fraco">A senha é enviada somente ao Supabase Auth e não é armazenada pelo Ouroboros.</p>`,
      confirmar: 'Confirmar',
      onConfirmar: async () => {
        const senha = $('#super-senha').value;
        if (!senha) return false;
        try {
          await Nuvem.confirmarSenha(senha);
          if (!(await Nuvem.ehSuperMestre())) throw new Error('Esta conta não é Mestre Principal.');
          try { localStorage.setItem('ouroboros_super_mestre_' + App.sessao.user.id, '1'); } catch {}
          setTimeout(() => this.carregar(), 0);
        } catch (e) {
          toast(e.message === 'Invalid login credentials' ? 'Senha incorreta.' : this.erro(e), 'erro');
          return false;
        }
      }
    });
    setTimeout(() => $('#super-senha')?.focus(), 0);
  },

  async carregar() {
    const alvo = $('#super-mensagens');
    App.mostrar('super-mestre');
    alvo.innerHTML = '<p class="vazio-linha">Carregando mensagens…</p>';
    try {
      if (!(await Nuvem.ehSuperMestre())) throw new Error('Acesso administrativo negado.');
      this.itens = await Nuvem.mensagensGlobais();
      this.ligar(); this.render();
    } catch (e) {
      alvo.innerHTML = `<p class="vazio-linha">${esc(this.erro(e))}</p>`;
    }
  },

  ligar() {
    if (this._ligado) return;
    this._ligado = true;
    $('#super-busca').addEventListener('input', () => this.render());
    $('#super-escopo').addEventListener('change', () => this.render());
  },

  render() {
    const alvo = $('#super-mensagens');
    const termo = slug($('#super-busca').value);
    const escopo = $('#super-escopo').value;
    const itens = this.itens.filter(m =>
      (escopo === 'todas' || (escopo === 'minhas') === Boolean(m.mesa_propria)) &&
      (!termo || slug([m.mesa_nome, m.mestre_nome, m.remetente, m.destinatario, m.texto].join(' ')).includes(termo)));

    const mesas = new Map();
    itens.forEach(m => {
      if (!mesas.has(m.mesa_id)) mesas.set(m.mesa_id, []);
      mesas.get(m.mesa_id).push(m);
    });
    if (!mesas.size) {
      alvo.innerHTML = '<div class="vazio"><h2>Nenhuma mensagem encontrada</h2><p>Ajuste a busca ou o filtro de mesas.</p></div>';
      return;
    }
    alvo.innerHTML = [...mesas.values()].map(lista => {
      const primeira = lista[0], conversas = new Map();
      lista.forEach(m => {
        const k = [m.remetente, m.destinatario].sort().join('|');
        if (!conversas.has(k)) conversas.set(k, []);
        conversas.get(k).push(m);
      });
      return `<section class="bloco super-mesa">
        <header><h3>${esc(primeira.mesa_nome)}</h3>
          <span class="tag ${primeira.mesa_propria ? 'tag-mestre' : ''}">${primeira.mesa_propria ? 'CRIADA POR MIM' : 'OUTRO MESTRE'}</span>
          <span class="super-mesa-dono">Mestre: ${esc(primeira.mestre_nome || '—')}</span></header>
        ${[...conversas.values()].map(g => `<details class="super-conversa">
          <summary>${esc(g[0].remetente)} ↔ ${esc(g[0].destinatario)} · ${g.length} mensagem(ns)</summary>
          <div class="super-linhas">${g.slice().reverse().map(m => `<div class="super-msg"><b>${esc(m.remetente)}</b><span>${esc(m.texto)}</span><time>${new Date(m.criado_em).toLocaleString('pt-BR')}</time></div>`).join('')}</div>
        </details>`).join('')}
      </section>`;
    }).join('');
  }
};
