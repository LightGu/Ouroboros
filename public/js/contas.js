/* Várias contas logadas ao mesmo tempo, alternando sem deslogar.

   O Supabase guarda uma sessão só por vez. Aqui eu guardo os tokens de cada
   conta numa lista à parte e troco a sessão ativa com setSession(). O token
   de acesso expira em 1h, mas o de renovação continua valendo — então voltar
   pra uma conta parada há horas funciona. */

const Contas = {
  CHAVE: 'ouroboros_contas',

  lista() {
    try { return JSON.parse(localStorage.getItem(this.CHAVE) || '[]'); }
    catch { return []; }
  },

  gravar(lista) {
    try { localStorage.setItem(this.CHAVE, JSON.stringify(lista)); } catch {}
  },

  /* chamado a cada login bem-sucedido */
  async lembrar() {
    const { data } = await Nuvem.cliente.auth.getSession();
    const s = data.session;
    if (!s) return;
    const lista = this.lista().filter(c => c.id !== s.user.id);
    lista.push({
      id: s.user.id,
      email: s.user.email,
      nome: App.perfil?.nome || s.user.email,
      access_token: s.access_token,
      refresh_token: s.refresh_token
    });
    this.gravar(lista);
  },

  async trocar(id) {
    const c = this.lista().find(x => x.id === id);
    if (!c) return toast('Conta não encontrada.', 'erro');

    const { error } = await Nuvem.cliente.auth.setSession({
      access_token: c.access_token, refresh_token: c.refresh_token
    });
    if (error) {
      toast('A sessão dessa conta expirou — entre de novo.', 'erro');
      this.esquecer(id);
      return this.novaConta();
    }

    /* estado da mesa anterior não pode vazar pra conta nova */
    Celular.conversa = null; Celular.comoPersona = null; Celular.lido.clear();
    Ficha.atual = null;
    await App.aposLogin();
    toast('Agora como ' + (c.nome || c.email) + '.');
  },

  esquecer(id) {
    this.gravar(this.lista().filter(c => c.id !== id));
  },

  /* Vai pra tela de login sem deslogar nada.

     Não dá pra chamar signOut aqui, nem com scope 'local': ele invalida o
     token guardado das OUTRAS contas também, e voltar pra elas passa a dar
     "Auth session missing". Como o signInWithPassword seguinte já substitui
     a sessão ativa, deslogar antes é desnecessário. */
  async novaConta() {
    await Nuvem.desassinar();
    App.mesa = null;
    App.mostrar('auth');
    toast('Entre com a outra conta. As guardadas continuam aí.');
  },

  /* usado no menu da conta */
  html() {
    const atual = App.sessao?.user?.id;
    const outras = this.lista();
    if (outras.length < 2) return '';
    return `<div class="contas-troca">
      <span class="contas-rotulo">Trocar de conta</span>
      ${outras.map(c => `
        <button data-conta="${esc(c.id)}" class="${c.id === atual ? 'atual' : ''}">
          <span class="conta-bolinha"></span>${esc(c.nome || c.email)}
        </button>`).join('')}
    </div>`;
  }
};
