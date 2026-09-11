/* Orquestração: sessão, navegação entre telas, realtime */

const App = {
  sessao: null,
  perfil: null,
  mesa: null,
  ehMestre: false,
  telaAtual: 'auth',

  /* ---------------- boot ---------------- */

  async iniciar() {
    if (!Nuvem.configurado()) return this.telaConfig();
    if (!window.supabase) return this.telaConfig('Não consegui carregar a biblioteca do Supabase. Você está sem internet?');

    Nuvem.iniciar();
    Telas.ligarAuth();
    Telas.ligarMesas();
    this.ligarTopbar();

    const sessao = await Nuvem.sessao();
    if (sessao) await this.aposLogin();
    else this.mostrar('auth');

    $('#carregando').hidden = true;
  },

  telaConfig(msg) {
    $('#carregando').hidden = true;
    $('#view-auth').hidden = false;
    $('#view-auth').innerHTML = `
      <div class="cartao-auth">
        <div class="auth-marca"><svg class="brand-mark" aria-hidden="true"><use href="#ouroboros"/></svg><h1>FALTA CONFIGURAR</h1></div>
        <p class="dialogo">${msg ? esc(msg) : 'Abra <b>js/config.js</b> e cole a URL do projeto e a chave publicável do Supabase (Project Settings → API).'}</p>
        <p class="dialogo fraco">Depois recarregue a página.</p>
      </div>`;
  },

  async aposLogin() {
    const sessao = await Nuvem.sessao();
    this.sessao = sessao;
    this.perfil = await Nuvem.perfil(sessao.user.id);
    $('#conta-nome').textContent = this.perfil?.nome || sessao.user.email;

    const mesas = await Nuvem.mesas();
    if (mesas.length === 1) return this.entrarNaMesa(mesas[0]);

    await Telas.renderMesas();
    this.mostrar('mesas');
  },

  async entrarNaMesa(mesa) {
    this.mesa = mesa;
    this.ehMestre = mesa.papel === 'mestre';
    $('#mesa-nome').textContent = mesa.nome;
    $('#aba-logs').hidden = !this.ehMestre;
    $('#aba-sons').hidden = !this.ehMestre;
    $('#aba-campanha').hidden = !this.ehMestre;
    $('#aba-interludio').hidden = !this.ehMestre;
    $('#aba-mensagens').hidden = !this.ehMestre;
    $('#celular').hidden = false;
    $('#btn-rapido').hidden = !this.ehMestre;   /* NPC é coisa de mestre */

    try {
      await Store.carregar(mesa.id, this.ehMestre);
    } catch (e) {
      toast('Não consegui carregar a mesa: ' + (e.message || e), 'erro');
      return this.mostrar('mesas');
    }

    Nuvem.assinar(mesa.id, {
      aoMudarPersonagem: p => this.mudancaRemota(p),
      aoChegarLog: l => Logs.receber(l),
      aoRolar: r => Rolagem.receber(r),
      aoMudarMapa: p => Mapa.mudouMapa(p),
      aoMudarToken: p => Mapa.mudouToken(p),
      aoMudarMesa: m => this.mesaMudou(m),
      aoArrastar: d => Mapa.arrastouRemoto(d),
      aoMudarSom: p => Sons.mudou(p),
      aoMudarAnotacao: p => Campanha.mudou(p),
      aoMudarPresenca: ids => this.presencaMudou(ids),
      aoChegarMensagem: m => Celular.recebeu(m),
      aoLigar: () => this.reconectou(),
      aoCair: () => this.marcarConexao(false)
    });

    if (this.ehMestre) Logs.carregar();
    Rolagem.ligar();
    Rolagem.carregar();
    Mapa.carregar();
    Sons.ligar();
    Sons.carregar();
    Campanha.carregar();
    Celular.ligar();
    Celular.carregar();
    Mesa.render();
    this.mostrar('mesa');
  },

  /* O mestre mexeu nos turnos: todo mundo acompanha. */
  mesaMudou(nova) {
    if (!this.mesa) return;
    this.mesa.combate = nova.combate;
    this.mesa.nome = nova.nome;
    Store.estado.combate = nova.combate || Store.estado.combate;
    if (this.telaAtual === 'mesa') Mesa.render();
  },

  /* Canal (re)ligado: pega o que mudou enquanto ele esteve fora. */
  async reconectou() {
    this.marcarConexao(true);
    if (!this.mesa) return;
    if (Ficha.atual) return;              // não atropela quem está digitando
    try {
      this.mesa.combate = await Nuvem.lerCombate(this.mesa.id);
      await Store.carregar(this.mesa.id, this.ehMestre);
      await Mapa.carregar();
      await Sons.carregar();
      await Campanha.carregar();
      await Celular.carregar();
      if (this.telaAtual === 'mesa') Mesa.render();
      if (this.ehMestre) Logs.carregar();
    } catch (e) { console.error(e); }
  },

  /* quem está com a aba aberta agora */
  online: new Set(),

  /* A presença do Supabase não dispara 'sync' neste projeto — o canal aceita
     o track() mas presenceState() fica vazio. Mantido desligado até investigar;
     a lista de jogadores usa a data de entrada, que é confiável. */
  presencaMudou(ids) {
    this.online = ids;
    if (Telas.listaAberta) Telas.renderJogadores();
  },

  marcarConexao(ok) {
    const el = $('#conexao');
    if (!el) return;
    el.className = 'conexao ' + (ok ? 'on' : 'off');
    el.title = ok ? 'Ao vivo — mudanças aparecem na hora' : 'Sem tempo real — reconectando...';
  },

  /* Alguém mexeu em algo pelo aparelho dele. */
  mudancaRemota(payload) {
    const id = payload.new?.id || payload.old?.id;

    /* Se a ficha está aberta e é editável por mim, não sobrescrevo o que estou digitando. */
    if (Ficha.atual && Ficha.atual.id === id && Store.podeEditar(Ficha.atual)) return;

    Store.aplicarMudancaRemota(payload);
    if (this.telaAtual === 'mesa') Mesa.render();
    if (Ficha.atual && Ficha.atual.id === id) Ficha.abrir(id);
  },

  /* ---------------- navegação ---------------- */

  mostrar(tela) {
    this.telaAtual = tela;
    ['auth', 'mesas', 'mesa', 'ficha', 'mapa', 'sons', 'campanha', 'interludio', 'mensagens', 'logs'].forEach(t => {
      $('#view-' + t).hidden = t !== tela;
    });
    $('#topbar').hidden = tela === 'auth' || tela === 'mesas';
    $$('.aba').forEach(a => a.classList.toggle('ativa', a.dataset.aba === tela));
    if (tela === 'logs') { Logs.limparBadge(); Logs.render(); }
    if (tela === 'mapa') Mapa.render();
    if (tela === 'sons') Sons.render();
    if (tela === 'campanha') Campanha.render();
    if (tela === 'interludio') Interludio.render();
    if (tela === 'mensagens') Mensagens.render();
    if (tela !== 'campanha') $('#painel-nota').hidden = true;
  },

  async trocarMesa() {
    await Nuvem.desassinar();
    this.mesa = null;
    Ficha.atual = null;
    Store.estado.personagens = [];
    await Telas.renderMesas();
    this.mostrar('mesas');
  },

  async sair() {
    await Nuvem.sair();
    location.reload();
  },

  /* ---------------- topbar ---------------- */

  ligarTopbar() {
    $$('.aba').forEach(b => b.addEventListener('click', () => this.mostrar(b.dataset.aba)));
    $('#btn-conta').addEventListener('click', e => { e.stopPropagation(); Telas.menuConta($('#btn-conta')); });

    $('#btn-novo').addEventListener('click', async () => {
      try { Ficha.abrir((await Store.criar(false)).id); }
      catch (e) { toast('Não consegui criar: ' + (e.message || e), 'erro'); }
    });

    $('#btn-rapido').addEventListener('click', () => Mesa.modalRapido(null));

    $('#btn-turnos').addEventListener('click',     () => Mesa.iniciarTurnos());
    $('#btn-parar').addEventListener('click',      () => Mesa.pararTurnos());
    $('#btn-proximo').addEventListener('click',    () => Mesa.passarTurno(1));
    $('#btn-anterior').addEventListener('click',   () => Mesa.passarTurno(-1));
    $('#btn-iniciativa').addEventListener('click', () => Mesa.rolarIniciativa());

    $('#btn-exportar').addEventListener('click', () => { Store.exportar(); toast('Backup baixado.'); });
    $('#btn-importar').addEventListener('click', () => $('#file-importar').click());
    $('#file-importar').addEventListener('change', e => this.importarArquivo(e));

    $('#logs-busca').addEventListener('input', () => Logs.render());
    $('#btn-logs-atualizar').addEventListener('click', () => Logs.carregar());
  },

  importarArquivo(e) {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      Modal.abrir({
        titulo: 'Importar backup',
        corpo: `<p class="dialogo">Adicionar os personagens de <b>${esc(arquivo.name)}</b> nesta mesa?</p>
                <p class="dialogo fraco">Eles entram como novos — nada do que já está na mesa é apagado.</p>`,
        confirmar: 'Importar',
        onConfirmar: async () => {
          try {
            const n = await Store.importar(leitor.result);
            Mesa.render();
            toast(`${n} personagem(ns) importado(s).`);
          } catch (err) {
            toast('Arquivo inválido ou falha ao gravar.', 'erro');
            console.error(err);
          }
        }
      });
      e.target.value = '';
    };
    leitor.readAsText(arquivo);
  }
};

/* atalhos de teclado durante os turnos */
document.addEventListener('keydown', e => {
  const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (digitando || App.telaAtual !== 'mesa' || !Store.estado.combate.ativo) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); Mesa.passarTurno(1); }
  if (e.key === 'ArrowLeft')                   { e.preventDefault(); Mesa.passarTurno(-1); }
});

App.iniciar();
