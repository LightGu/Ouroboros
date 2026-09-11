/* Cena de interlúdio: marca as ações de cada agente e aplica a recuperação */

const CONFORTOS = [
  { id: 'precario',    nome: 'Precário',    mult: 0.5, ex: 'dentro do carro, barraca' },
  { id: 'normal',      nome: 'Normal',      mult: 1,   ex: 'quarto simples com cama e banheiro' },
  { id: 'confortavel', nome: 'Confortável', mult: 2,   ex: 'hotel ou pousada três estrelas' },
  { id: 'luxuoso',     nome: 'Luxuoso',     mult: 3,   ex: 'hotel de luxo, spa, tratamento vip' }
];

const PRATOS = [
  { id: '',            nome: 'nenhum',         efeito: '' },
  { id: 'favorito',    nome: 'Prato Favorito', efeito: '+2 Sanidade se relaxar' },
  { id: 'nutritivo',   nome: 'Prato Nutritivo',efeito: 'recuperação de PV sobe um degrau se dormir' },
  { id: 'energetico',  nome: 'Prato Energético',efeito:'recuperação de PE sobe um degrau se dormir' },
  { id: 'rapido',      nome: 'Prato Rápido',   efeito: '+5 no teste de revisar caso' }
];

const ACOES = [
  { id: 'alimentar',  nome: 'Alimentar-se', dica: 'Escolhe um prato. Um por interlúdio.' },
  { id: 'dormir',     nome: 'Dormir',       dica: 'Recupera PV e PE pelo limite de PE por rodada. Uma vez por interlúdio.' },
  { id: 'exercitar',  nome: 'Exercitar-se', dica: '+1d6 num teste de AGI, FOR ou VIG até o fim da missão.' },
  { id: 'ler',        nome: 'Ler',          dica: '+1d6 num teste de INT ou PRE até o fim da missão.' },
  { id: 'manutencao', nome: 'Manutenção',   dica: 'Conserta um item quebrado até o PV máximo dele.' },
  { id: 'relaxar',    nome: 'Relaxar',      dica: 'Como dormir, mas recupera Sanidade. Uma vez por interlúdio.' },
  { id: 'revisar',    nome: 'Revisar Caso', dica: 'Teste de perícia por uma pista que passou batido. Pode repetir.' }
];

const Interludio = {
  cfg: {},            // id do personagem -> { participa, conforto, prato, acoes[] }
  conforto: 'normal', // padrão da cena
  regrasAbertas: false,

  /* Tabela 1.2: o limite de PE por rodada é o NEX dividido por 5. */
  limitePE(p) {
    const escrito = num(p.peRodada, 0);
    if (escrito > 0) return escrito;
    return Math.max(1, Math.floor(num(p.nex, 5) / 5));
  },

  doAgente(id) {
    if (!this.cfg[id]) this.cfg[id] = { participa: true, conforto: null, prato: '', acoes: [] };
    return this.cfg[id];
  },

  elegíveis() {
    return Store.estado.personagens.filter(p => !p.rapido);
  },

  /* ---------------- conta ---------------- */

  recuperacao(p) {
    const c = this.doAgente(p.id);
    const limite = this.limitePE(p);
    const conf = CONFORTOS.find(x => x.id === (c.conforto || this.conforto)) || CONFORTOS[1];
    const dormiu = c.acoes.includes('dormir');
    const relaxou = c.acoes.includes('relaxar');

    /* "aumenta em uma vez": o degrau sobe 1 (confortável 2x vira 3x) */
    const multPV = conf.mult + (c.prato === 'nutritivo'  ? 1 : 0);
    const multPE = conf.mult + (c.prato === 'energetico' ? 1 : 0);

    return {
      limite, conf,
      pv:  dormiu  ? Math.floor(limite * multPV) : 0,
      pe:  dormiu  ? Math.floor(limite * multPE) : 0,
      san: relaxou ? Math.floor(limite * conf.mult) + (c.prato === 'favorito' ? 2 : 0) : 0
    };
  },

  /* Cada agente que relaxa dá +1 de Sanidade a todos os participantes. */
  bonusGrupo() {
    return this.elegíveis().filter(p =>
      this.doAgente(p.id).participa && this.doAgente(p.id).acoes.includes('relaxar')).length;
  },

  totalSan(p) {
    const c = this.doAgente(p.id);
    if (!c.participa) return 0;
    return this.recuperacao(p).san + this.bonusGrupo();
  },

  /* ---------------- desenho ---------------- */

  render() {
    if (!App.ehMestre) return;
    this.renderBarra();
    const alvo = $('#interludio-corpo');
    const lista = this.elegíveis();

    if (!lista.length) {
      alvo.innerHTML = `<div class="vazio"><div class="vazio-mark">☾</div>
        <h2>Nenhum agente na mesa</h2>
        <p>Crie as fichas dos personagens pra montar uma cena de interlúdio.</p></div>`;
      return;
    }

    const grupo = this.bonusGrupo();
    alvo.innerHTML = `
      ${this.comoNarrar()}
      ${this.regrasAbertas ? this.regras() : ''}
      ${grupo ? `<p class="interludio-grupo">${grupo} agente(s) relaxando — todo participante ganha
                  <b>+${grupo} de Sanidade</b> além da própria recuperação.</p>` : ''}
      <div class="interludio-grade">
        ${lista.map(p => this.cartao(p)).join('')}
      </div>`;

    this.ligarCartoes();
  },

  cartao(p) {
    const c = this.doAgente(p.id);
    const r = this.recuperacao(p);
    const san = this.totalSan(p);
    const demais = c.acoes.length;

    return `
    <article class="interludio-card ${c.participa ? '' : 'fora'}" data-ag="${p.id}">
      <header class="il-cab">
        <label class="il-participa">
          <input type="checkbox" data-participa ${c.participa ? 'checked' : ''}>
          <span class="il-nome">${esc(p.nome || 'Sem nome')}</span>
        </label>
        <span class="il-limite" title="Limite de PE por rodada (NEX ÷ 5)">limite ${r.limite}</span>
      </header>

      <div class="il-conforto">
        <span>Conforto</span>
        <select data-conforto>
          <option value="">igual à cena (${esc(CONFORTOS.find(x => x.id === this.conforto).nome)})</option>
          ${CONFORTOS.map(k => `<option value="${k.id}" ${c.conforto === k.id ? 'selected' : ''}>${k.nome} · ${k.mult}×</option>`).join('')}
        </select>
      </div>

      <div class="il-acoes">
        ${ACOES.map(a => `
          <button class="il-acao ${c.acoes.includes(a.id) ? 'on' : ''}"
                  data-acao="${a.id}" title="${esc(a.dica)}">${a.nome}</button>`).join('')}
      </div>

      ${c.acoes.includes('alimentar') ? `
        <div class="il-prato">
          <span>Prato</span>
          <select data-prato>
            ${PRATOS.map(x => `<option value="${x.id}" ${c.prato === x.id ? 'selected' : ''}>${x.nome}</option>`).join('')}
          </select>
          ${c.prato ? `<em>${esc(PRATOS.find(x => x.id === c.prato).efeito)}</em>` : ''}
        </div>` : ''}

      ${demais > 2 ? `<p class="il-aviso">⚠ ${demais} ações marcadas — a regra permite <b>duas</b> por interlúdio.</p>` : ''}

      <div class="il-ganho">
        ${r.pv  ? `<span class="g g-pv">+${r.pv} PV</span>` : ''}
        ${r.pe  ? `<span class="g g-pe">+${r.pe} PE</span>` : ''}
        ${san   ? `<span class="g g-san">+${san} SAN</span>` : ''}
        ${c.acoes.includes('exercitar') ? '<span class="g g-bon">+1d6 corpo</span>' : ''}
        ${c.acoes.includes('ler')       ? '<span class="g g-bon">+1d6 mente</span>' : ''}
        ${!r.pv && !r.pe && !san && !c.acoes.length ? '<span class="fraco">nenhuma ação marcada</span>' : ''}
      </div>

      ${c.acoes.includes('revisar') ? `
        <p class="il-lembrete">Revisar caso: teste de perícia com DT sua${c.prato === 'rapido' ? ', <b>+5</b> pelo Prato Rápido' : ''}.
          Pode repetir na mesma cena.</p>` : ''}
      ${c.acoes.includes('manutencao') ? '<p class="il-lembrete">Manutenção: escolha o item consertado.</p>' : ''}
    </article>`;
  },

  renderBarra() {
    $('#interludio-barra').innerHTML = `
      <div class="il-conforto-cena">
        <span>Conforto da cena</span>
        <select id="il-conforto-geral">
          ${CONFORTOS.map(k => `<option value="${k.id}" ${this.conforto === k.id ? 'selected' : ''}>${k.nome} · ${k.mult}× — ${k.ex}</option>`).join('')}
        </select>
      </div>
      <div class="cresce"></div>
      <button class="btn btn-ghost btn-peq" id="il-regras">${this.regrasAbertas ? 'Esconder regras' : 'Ver regras'}</button>
      <button class="btn btn-ghost btn-peq" id="il-limpar">Limpar</button>
      <button class="btn btn-primary btn-peq" id="il-aplicar">Aplicar interlúdio</button>`;

    $('#il-conforto-geral').addEventListener('change', e => { this.conforto = e.target.value; this.render(); });
    $('#il-regras').addEventListener('click', () => { this.regrasAbertas = !this.regrasAbertas; this.render(); });
    $('#il-limpar').addEventListener('click', () => { this.cfg = {}; this.render(); });
    $('#il-aplicar').addEventListener('click', () => this.aplicar());
  },

  /* Lembrete de narração — fica sempre à vista, é o que você lê de relance
     no meio da sessão. A parte mecânica está atrás do botão "Ver regras". */
  comoNarrar() {
    return `
    <div class="il-narrar">
      <h3>Como narrar</h3>
      <p><b>Abra pelo lugar.</b> Descreva o esconderijo, o hotel barato, a casa da tia de alguém —
         som de chuveiro, televisão ligada num canal qualquer, cheiro de comida. O contraste com a
         cena anterior é o efeito. Quanto mais mundano, melhor funciona.</p>
      <p><b>Dê a vez a cada um.</b> Pergunte o que o agente faz, não o que o jogador escolhe na lista.
         "Você passou a noite lendo" vale menos que "o que você estava procurando naquele livro?".
         São até duas ações por pessoa.</p>
      <p><b>É a cena dos personagens, não do caso.</b> É aqui que aparece a ligação com quem ficou em
         casa, a mão tremendo, a conversa que ninguém queria ter. Deixe correr solto e não puxe pra trama.</p>
      <p><b>Feche antes de esfriar.</b> Quando as conversas começarem a repetir, corte com algo do mundo:
         o telefone toca, alguém bate na porta, chega uma mensagem. O interlúdio acaba quando você diz.</p>
      <p class="il-atencao"><b>Quem não pode:</b> agentes ao relento, sem acampamento montado.
         E se forçarem interlúdio demais, use isso — a próxima cena chega mais urgente,
         com algo que já aconteceu enquanto eles descansavam.</p>
    </div>`;
  },

  regras() {
    return `
    <div class="il-regras">
      <p>Cenas de interlúdio são o intervalo entre a ação e a investigação: os agentes descansam,
         acalmam os ânimos e planejam. Você decide quando começa e termina, e não tem duração fixa em horas.
         Quem está ao relento, sem acampamento, não pode fazer interlúdio.
         Forçar interlúdios demais pode aumentar a urgência das próximas cenas.</p>
      <p><b>Cada agente faz até duas ações.</b></p>
      <dl>
        ${ACOES.map(a => `<dt>${a.nome}</dt><dd>${esc(a.dica)}</dd>`).join('')}
      </dl>
      <p class="fraco">Dormir e relaxar recuperam <b>limite de PE por rodada × conforto</b>
         (precário ½, normal 1×, confortável 2×, luxuoso 3×). O limite é o NEX dividido por 5.</p>
    </div>`;
  },

  ligarCartoes() {
    $$('.interludio-card').forEach(el => {
      const id = el.dataset.ag;
      const c = this.doAgente(id);

      $('[data-participa]', el).addEventListener('change', e => { c.participa = e.target.checked; this.render(); });
      $('[data-conforto]', el).addEventListener('change', e => { c.conforto = e.target.value || null; this.render(); });
      $('[data-prato]', el)?.addEventListener('change', e => { c.prato = e.target.value; this.render(); });

      $$('[data-acao]', el).forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.acao;
        const i = c.acoes.indexOf(a);
        if (i >= 0) { c.acoes.splice(i, 1); if (a === 'alimentar') c.prato = ''; }
        else c.acoes.push(a);
        this.render();
      }));
    });
  },

  /* ---------------- aplicar ---------------- */

  aplicar() {
    const participantes = this.elegíveis().filter(p => this.doAgente(p.id).participa);
    if (!participantes.length) return toast('Ninguém marcado pra participar.', 'erro');

    const linhas = participantes.map(p => {
      const r = this.recuperacao(p);
      const san = this.totalSan(p);
      const c = this.doAgente(p.id);
      return { p, r, san, c, nada: !r.pv && !r.pe && !san && !c.acoes.includes('exercitar') && !c.acoes.includes('ler') };
    });

    if (linhas.every(l => l.nada)) return toast('Nenhuma ação com efeito marcado.', 'erro');

    Modal.abrir({
      titulo: 'Aplicar interlúdio',
      corpo: `
        <p class="dialogo">Vai entrar nas fichas:</p>
        <ul class="lista-calc">
          ${linhas.filter(l => !l.nada).map(l => `<li><b>${esc(l.p.nome || 'Sem nome')}</b> —
            ${[l.r.pv && `+${l.r.pv} PV`, l.r.pe && `+${l.r.pe} PE`, l.san && `+${l.san} SAN`,
               l.c.acoes.includes('exercitar') && '+1d6 corpo',
               l.c.acoes.includes('ler') && '+1d6 mente'].filter(Boolean).join(', ')}</li>`).join('')}
        </ul>
        <p class="dialogo fraco">Recuperação nunca passa do máximo da ficha. Os bônus de +1d6 ficam
           guardados no card até alguém usar.</p>`,
      confirmar: 'Aplicar',
      onConfirmar: async () => {
        let mexidos = 0;
        for (const l of linhas) {
          if (l.nada) continue;
          const p = l.p;
          if (l.r.pv)  p.pv.atual  = Math.min(num(p.pv.max),  num(p.pv.atual)  + l.r.pv);
          if (l.r.pe)  p.pe.atual  = Math.min(num(p.pe.max),  num(p.pe.atual)  + l.r.pe);
          if (l.san)   p.san.atual = Math.min(num(p.san.max), num(p.san.atual) + l.san);

          /* os bônus acumulam até o teto: Vigor pro corpo, Intelecto pra mente */
          p.bonus = p.bonus || { corpo: 0, mente: 0 };
          if (l.c.acoes.includes('exercitar'))
            p.bonus.corpo = Math.min(num(p.atributos.VIG), num(p.bonus.corpo) + 1);
          if (l.c.acoes.includes('ler'))
            p.bonus.mente = Math.min(num(p.atributos.INT), num(p.bonus.mente) + 1);

          Store.salvar(p);
          mexidos++;
        }
        this.cfg = {};
        this.render();
        Mesa.render();
        toast(`Interlúdio aplicado em ${mexidos} agente(s).`);
      }
    });
  }
};
