/* Criação de personagem: escolha entre ficha em branco e passo a passo.

   O guiado segue a ordem do livro (conceito → origem → classe → atributos →
   perícias) e só cria o personagem no fim: se a pessoa desistir no meio, nada
   foi gravado na nuvem. Os passos de lore são opcionais de propósito — quem
   está criando personagem na véspera da sessão não quer travar num campo de
   "aparência" antes de conseguir jogar. */

const Criacao = {

  d: null,       /* o rascunho, só existe durante o passo a passo */
  passo: 0,

  /* Toda busca do passo a passo é presa no corpo do modal. Sem isso,
     seletores genéricos como [data-modo] pegam também os botões do mapa,
     que usam o mesmo atributo. */
  raiz() { return $('#modal-body'); },

  /* ---------------- porta de entrada ---------------- */

  inicio() {
    Modal.abrir({
      titulo: 'Novo personagem',
      corpo: `
        <p class="dialogo">Como você quer montar esse agente?</p>
        <div class="escolha-modo">
          <button class="modo" data-modo="guiado">
            <b>Passo a passo</b>
            <span>Sete telas curtas: conceito, origem, classe, atributos e perícias.
                  Explica cada escolha e calcula PV, PE e Sanidade no fim.</span>
            <i>recomendado pra quem está começando</i>
          </button>
          <button class="modo" data-modo="livre">
            <b>Ficha em branco</b>
            <span>Abre a ficha completa direto e você preenche na ordem que quiser.</span>
            <i>pra quem já sabe o que vai fazer</i>
          </button>
        </div>`,
      confirmar: '',
      cancelar: 'Cancelar'
    });
    /* os dois modos já são botões; o rodapé só precisa do cancelar */
    $('#modal-foot').innerHTML = '<button class="btn btn-ghost" data-modal-cancelar>Cancelar</button>';
    $$('[data-modo]', this.raiz()).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.modo === 'livre') return this.livre();
      this.guiado();
    }));
  },

  async livre() {
    Modal.fechar();
    try { Ficha.abrir((await Store.criar(false)).id); }
    catch (e) { toast('Não consegui criar: ' + (e.message || e), 'erro'); }
  },

  guiado() {
    this.d = {
      nome: '', jogador: '', origem: '', classe: '',
      attrs: { AGI: 1, FOR: 1, INT: 1, PRE: 1, VIG: 1 },
      pericias: [], nex: 5, patente: 'Recruta',
      descricao: { aparencia: '', personalidade: '', historico: '', objetivo: '' }
    };
    this.ir(0);
  },

  /* ---------------- navegação ---------------- */

  ir(n) {
    const passo = this.passos[n];
    this.passo = n;
    const ultimo = n === this.passos.length - 1;

    Modal.abrir({
      titulo: passo.titulo,
      largo: true,
      corpo: this.trilha(n) + passo.html(),
      confirmar: ultimo ? 'Criar agente' : 'Continuar ›',
      onConfirmar: () => {
        if (passo.validar && passo.validar.call(this) === false) return false;
        if (!ultimo) { this.ir(n + 1); return false; }   /* false = não fecha o modal */
        return this.finalizar();
      }
    });

    if (passo.ligar) passo.ligar.call(this);
    if (n > 0) {
      $('#modal-foot').insertAdjacentHTML('afterbegin',
        '<button class="btn btn-ghost" id="cri-voltar">‹ Voltar</button>');
      $('#cri-voltar').addEventListener('click', () => {
        if (passo.validar) passo.validar.call(this);   /* guarda o que já foi digitado */
        this.ir(n - 1);
      });
    }
  },

  trilha(n) {
    return `<div class="trilha">
      ${this.passos.map((p, i) => `<span class="trilha-ponto ${i === n ? 'agora' : ''} ${i < n ? 'feito' : ''}"
            title="${esc(p.titulo)}"></span>`).join('')}
      <em>passo ${n + 1} de ${this.passos.length}</em>
    </div>`;
  },

  /* ---------------- cálculos compartilhados ---------------- */

  /* Quantas perícias a pessoa ainda pode marcar: o que a classe dá (mais
     Intelecto) somado às duas que toda origem entrega. */
  totalPericias() {
    const info = CLASSE_INFO[this.d.classe];
    if (!info) return 2;
    return info.livres + num(this.d.attrs.INT) + info.obrigatorias.length + 2;
  },

  /* Todos começam em 1 e há 4 pontos pra distribuir. Zerar um atributo devolve
     um ponto — e isso sai de graça na conta, porque o zero já reduz a soma. */
  pontosGastos() {
    return ATRIBUTOS.reduce((s, a) => s + num(this.d.attrs[a.key]), 0) - 5;
  },

  pontosTotais() {
    return CLASSE_INFO[this.d.classe]?.pontos ?? 4;
  },

  /* ---------------- os passos ---------------- */

  passos: [

    /* 1. conceito ------------------------------------------------ */
    {
      titulo: 'Quem é essa pessoa?',
      html() {
        const d = Criacao.d;
        return `
        <p class="dialogo">Antes das regras, o conceito: uma frase que explique quem ele era
        <b>antes</b> de esbarrar no paranormal. Professor? Policial cansado? Entregador que viu
        o que não devia? O resto da ficha sai daí.</p>
        <div class="grade-2">
          <label class="campo"><span>Nome do personagem *</span>
            <input id="c-nome" value="${esc(d.nome)}" placeholder="Ex.: Ícaro Sampaio"></label>
          <label class="campo"><span>Jogador</span>
            <input id="c-jogador" value="${esc(d.jogador)}" placeholder="quem vai jogar com ele"></label>
        </div>
        <p class="dica-passo">Só o nome é obrigatório. Dá pra mudar tudo depois na ficha.</p>`;
      },
      validar() {
        this.d.nome = $('#c-nome', this.raiz()).value.trim();
        this.d.jogador = $('#c-jogador', this.raiz()).value.trim();
        if (!this.d.nome) { toast('Dá um nome pra ele.', 'erro'); return false; }
      }
    },

    /* 2. origem -------------------------------------------------- */
    {
      titulo: 'De onde ele veio',
      html() {
        const d = Criacao.d;
        return `
        <p class="dialogo">A <b>origem</b> é a vida que ele tinha antes da Ordem. Ela dá
        <b>duas perícias treinadas</b> e <b>um poder</b> — procure as duas no livro e marque
        no próximo passo junto com as da classe.</p>
        <label class="campo"><span>Origem</span>
          <input id="c-origem" value="${esc(d.origem)}" list="dl-origens-cri" placeholder="Ex.: Teórico da Conspiração">
          <datalist id="dl-origens-cri">${ORIGENS.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
        </label>
        <div class="chips">
          ${ORIGENS.map(o => `<button class="chip" data-origem="${esc(o)}">${esc(o)}</button>`).join('')}
        </div>
        <p class="dica-passo">Não achou a sua na lista? Pode digitar qualquer coisa — o campo é livre,
        e origens de outros livros funcionam igual.</p>`;
      },
      ligar() {
        const raiz = Criacao.raiz();
        $$('[data-origem]', raiz).forEach(b => b.addEventListener('click', () => {
          $('#c-origem', raiz).value = b.dataset.origem;
          $$('[data-origem]', raiz).forEach(x => x.classList.toggle('ativo', x === b));
        }));
        const atual = $('#c-origem', raiz).value;
        $$('[data-origem]', raiz).forEach(x => x.classList.toggle('ativo', x.dataset.origem === atual));
      },
      validar() { this.d.origem = $('#c-origem', this.raiz()).value.trim(); }
    },

    /* 3. classe -------------------------------------------------- */
    {
      titulo: 'O que ele faz na equipe',
      html() {
        const d = Criacao.d;
        return `
        <p class="dialogo">A <b>classe</b> é o papel dele em campo. É ela que define quanto PV, PE e
        Sanidade ele ganha a cada NEX, quantas perícias treina e com o que sabe atirar.</p>
        <div class="cartas-classe">
          ${CLASSES.map(c => {
            const i = CLASSE_INFO[c], pr = PROGRESSAO[c];
            return `
            <button class="carta-classe ${d.classe === c ? 'ativo' : ''}" data-classe="${esc(c)}">
              <b>${esc(c)}</b>
              <span class="carta-frase">${esc(i.frase)}</span>
              <span class="carta-nums">PV ${pr.pv[0]}+VIG · PE ${pr.pe[0]}+PRE · SAN ${pr.san[0]}</span>
              <span class="carta-linha">Treina ${i.livres} + INT${i.obrigatorias.length ? ' + as obrigatórias' : ''}</span>
              <span class="carta-linha">${esc(i.proficiencias)}</span>
              <span class="carta-marca">${esc(i.marca)}</span>
              ${i.aviso ? `<span class="carta-aviso">${esc(i.aviso)}</span>` : ''}
            </button>`;
          }).join('')}
        </div>`;
      },
      ligar() {
        $$('[data-classe]', Criacao.raiz()).forEach(b => b.addEventListener('click', () => {
          $$('[data-classe]', Criacao.raiz()).forEach(x => x.classList.toggle('ativo', x === b));
          Criacao.d.classe = b.dataset.classe;
        }));
      },
      validar() {
        if (!this.d.classe) { toast('Escolhe uma classe pra seguir.', 'erro'); return false; }
      }
    },

    /* 4. atributos ----------------------------------------------- */
    {
      titulo: 'Atributos',
      html() {
        const d = Criacao.d;
        const pontos = Criacao.pontosTotais();
        return `
        <p class="dialogo">Todo mundo começa com <b>1 em tudo</b> e tem <b>${pontos} pontos</b> pra
        distribuir, até o máximo de 3. Pode <b>zerar um atributo</b> pra ganhar 1 ponto a mais —
        mas atributo 0 rola 2d20 e fica com o <b>pior</b>.</p>
        <div class="attr-passo" id="attr-passo">
          ${ATRIBUTOS.map(a => `
            <div class="attr-linha" data-linha="${a.key}">
              <div class="attr-id"><b>${a.key}</b><span>${a.nome}</span></div>
              <p class="attr-ajuda">${esc(AJUDA.atributos[a.key])}</p>
              <div class="attr-ctrl">
                <button class="btn-mini" data-p="${a.key}:-1">−</button>
                <span class="attr-num" data-num="${a.key}">${num(d.attrs[a.key])}</span>
                <button class="btn-mini" data-p="${a.key}:1">+</button>
              </div>
            </div>`).join('')}
        </div>
        <div class="attr-resumo">
          <span id="attr-sobra"></span>
          <span id="attr-previa" class="fraco"></span>
        </div>`;
      },
      ligar() {
        const pinta = () => {
          const d = Criacao.d, sobra = Criacao.pontosTotais() - Criacao.pontosGastos();
          const raiz = Criacao.raiz();
          ATRIBUTOS.forEach(a => { $(`[data-num="${a.key}"]`, raiz).textContent = num(d.attrs[a.key]); });
          const el = $('#attr-sobra', raiz);
          el.textContent = sobra === 0 ? 'Pontos distribuídos ✓' : `Pontos restantes: ${sobra}`;
          el.className = sobra === 0 ? 'ok' : (sobra < 0 ? 'erro' : '');
          const s = calcularStatus(d.classe, 5, d.attrs);
          $('#attr-previa', raiz).textContent = s
            ? `Como ${d.classe} em NEX 5%: ${s.pv} PV · ${s.pe} PE · ${s.san} SAN · Defesa ${10 + num(d.attrs.AGI)}`
            : '';
        };
        $$('[data-p]', Criacao.raiz()).forEach(b => b.addEventListener('click', () => {
          const [k, delta] = b.dataset.p.split(':');
          const d = Criacao.d;
          const novo = num(d.attrs[k]) + Number(delta);
          if (novo < 0 || novo > 3) return;
          /* zerar é permitido uma vez só — é a regra do livro */
          if (novo === 0 && ATRIBUTOS.some(a => a.key !== k && num(d.attrs[a.key]) === 0))
            return toast('Só dá pra zerar um atributo.', 'erro');
          const antes = d.attrs[k];
          d.attrs[k] = novo;
          if (Criacao.pontosGastos() > Criacao.pontosTotais()) {
            d.attrs[k] = antes;
            return toast('Acabaram os pontos. Tire de outro atributo primeiro.', 'erro');
          }
          pinta();
        }));
        pinta();
      },
      validar() {
        const sobra = Criacao.pontosTotais() - Criacao.pontosGastos();
        if (sobra > 0) { toast(`Ainda sobra ${sobra} ponto${sobra > 1 ? 's' : ''} pra distribuir.`, 'erro'); return false; }
      }
    },

    /* 5. perícias ------------------------------------------------ */
    {
      titulo: 'Perícias treinadas',
      html() {
        const d = Criacao.d;
        const info = CLASSE_INFO[d.classe] || { obrigatorias: [], livres: 0 };
        const obrig = info.obrigatorias.map(par => par.join(' ou ')).join(' · ');
        return `
        <p class="dialogo">Treinar dá <b>+5</b> nos testes daquela perícia. Como <b>${esc(d.classe)}</b>
        com Intelecto ${num(d.attrs.INT)}, você marca <b>${Criacao.totalPericias()}</b> no total —
        isso já inclui as <b>2 da origem</b>.</p>
        ${obrig ? `<p class="dica-passo">Sua classe pede obrigatoriamente: <b>${esc(obrig)}</b>.</p>` : ''}
        <p class="dica-passo">As marcadas com <i>*</i> só podem ser usadas se treinadas — sem treino,
        você nem rola o dado.</p>
        <div class="grade-pericias" id="grade-pericias">
          ${PERICIAS.map(per => `
            <label class="per-item" data-item="${per.key}">
              <input type="checkbox" data-per-chk="${per.key}" ${d.pericias.includes(per.key) ? 'checked' : ''}>
              <span class="per-txt"><b>${esc(per.nome)}${per.treinada ? '<i class="ast">*</i>' : ''}</b>
                <em>${per.attr}</em>
                <small>${esc(AJUDA.pericias[per.nome] || '')}</small></span>
            </label>`).join('')}
        </div>
        <div class="attr-resumo"><span id="per-sobra"></span></div>`;
      },
      ligar() {
        const limite = Criacao.totalPericias();
        const raiz = Criacao.raiz();
        const marcadas = () => $$('[data-per-chk]', raiz).filter(c => c.checked);
        const pinta = () => {
          const n = marcadas().length, sobra = limite - n;
          const el = $('#per-sobra', raiz);
          el.textContent = sobra === 0 ? 'Todas escolhidas ✓' : `Faltam ${sobra} de ${limite}`;
          el.className = sobra === 0 ? 'ok' : '';
          /* trava o que sobrou quando o limite fecha, pra ninguém treinar demais */
          $$('[data-per-chk]', raiz).forEach(c => {
            c.disabled = sobra <= 0 && !c.checked;
            c.closest('.per-item').classList.toggle('travado', c.disabled);
            c.closest('.per-item').classList.toggle('marcado', c.checked);
          });
        };
        $$('[data-per-chk]', raiz).forEach(c => c.addEventListener('change', pinta));
        pinta();
      },
      validar() {
        this.d.pericias = $$('[data-per-chk]', this.raiz()).filter(c => c.checked).map(c => c.dataset.perChk);
        const falta = Criacao.totalPericias() - this.d.pericias.length;
        if (falta > 0) { toast(`Ainda dá pra treinar mais ${falta}.`, 'erro'); return false; }
      }
    },

    /* 6. lore (opcional) ----------------------------------------- */
    {
      titulo: 'História (opcional)',
      html() {
        const d = Criacao.d;
        return `
        <p class="dialogo">Nada aqui é obrigatório — dá pra pular e preencher depois, ou deixar
        pro mestre amarrar na campanha. Mas duas linhas já ajudam muito na primeira sessão.</p>
        <div class="grade-2">
          <label class="campo"><span>Aparência</span>
            <textarea id="c-aparencia" rows="3" placeholder="O detalhe que os outros lembram dele.">${esc(d.descricao.aparencia)}</textarea></label>
          <label class="campo"><span>Personalidade</span>
            <textarea id="c-personalidade" rows="3" placeholder="Como ele age sob pressão.">${esc(d.descricao.personalidade)}</textarea></label>
          <label class="campo"><span>Histórico</span>
            <textarea id="c-historico" rows="3" placeholder="O que o trouxe até a Ordem.">${esc(d.descricao.historico)}</textarea></label>
          <label class="campo"><span>Objetivo</span>
            <textarea id="c-objetivo" rows="3" placeholder="O que ele quer — é daqui que saem os ganchos.">${esc(d.descricao.objetivo)}</textarea></label>
        </div>
        <p class="dica-passo">Dica de mestre: um objetivo concreto vale mais que três parágrafos de passado.</p>`;
      },
      validar() {
        this.d.descricao = {
          aparencia: $('#c-aparencia', this.raiz()).value,
          personalidade: $('#c-personalidade', this.raiz()).value,
          historico: $('#c-historico', this.raiz()).value,
          objetivo: $('#c-objetivo', this.raiz()).value
        };
      }
    },

    /* 7. revisão ------------------------------------------------- */
    {
      titulo: 'Conferindo',
      html() {
        const d = Criacao.d;
        const s = calcularStatus(d.classe, d.nex, d.attrs) || { pv: 0, pe: 0, san: 0 };
        const nomes = d.pericias.map(k => PERICIAS.find(p => p.key === k)?.nome).filter(Boolean);
        return `
        <p class="dialogo">Último olhar. O que estiver errado dá pra corrigir voltando — e tudo
        continua editável na ficha depois.</p>
        <div class="grade-2">
          <label class="campo"${dica(AJUDA.campos.nex)}><span>NEX %</span>
            <input type="number" id="c-nex" value="${num(d.nex)}" min="0" max="99" step="5"></label>
          <label class="campo"${dica(AJUDA.campos.patente)}><span>Patente</span>
            <input id="c-patente" value="${esc(d.patente)}" list="dl-patentes-cri">
            <datalist id="dl-patentes-cri">${PATENTES.map(o => `<option value="${esc(o)}">`).join('')}</datalist></label>
        </div>
        <div class="revisao">
          <div><span>Personagem</span><b>${esc(d.nome)}</b></div>
          <div><span>Origem</span><b>${esc(d.origem || '—')}</b></div>
          <div><span>Classe</span><b>${esc(d.classe)}</b></div>
          <div><span>Atributos</span><b>${ATRIBUTOS.map(a => `${a.key} ${num(d.attrs[a.key])}`).join(' · ')}</b></div>
          <div><span>Treinadas</span><b>${nomes.length ? esc(nomes.join(', ')) : '—'}</b></div>
          <div><span>Vai nascer com</span><b id="c-status">${s.pv} PV · ${s.pe} PE · ${s.san} SAN · Defesa ${10 + num(d.attrs.AGI)}</b></div>
        </div>
        <p class="dica-passo">Falta o equipamento: os limites de item e o crédito vêm da patente,
        e estão na tabela do livro. Abra a ficha e preencha o inventário antes da sessão.</p>`;
      },
      ligar() {
        const atualiza = () => {
          const d = Criacao.d;
          d.nex = num($('#c-nex', Criacao.raiz()).value, 5);
          const s = calcularStatus(d.classe, d.nex, d.attrs);
          if (s) $('#c-status', Criacao.raiz()).textContent =
            `${s.pv} PV · ${s.pe} PE · ${s.san} SAN · Defesa ${10 + num(d.attrs.AGI)}`;
        };
        $('#c-nex', Criacao.raiz()).addEventListener('input', atualiza);
      },
      validar() {
        this.d.nex = num($('#c-nex', this.raiz()).value, 5);
        this.d.patente = $('#c-patente', this.raiz()).value.trim();
      }
    }
  ],

  /* ---------------- gravar ---------------- */

  async finalizar() {
    const d = this.d;
    try {
      const p = await Store.criar(false);
      p.nome = d.nome;
      p.jogador = d.jogador;
      p.origem = d.origem;
      p.classe = d.classe;
      p.patente = d.patente;
      p.nex = d.nex;
      p.atributos = { ...d.attrs };
      p.descricao = { ...d.descricao };
      d.pericias.forEach(k => { p.pericias[k] = { treino: 5, outros: 0 }; });

      const s = calcularStatus(d.classe, d.nex, d.attrs);
      if (s) {
        p.pv = { atual: s.pv, max: s.pv };
        p.pe = { atual: s.pe, max: s.pe };
        p.san = { atual: s.san, max: s.san };
      }

      await Store.salvarAgora(p);
      Mesa.render();
      toast(`${p.nome} entrou na mesa.`);
      Ficha.abrir(p.id);
      this.d = null;
    } catch (e) {
      toast('Não consegui criar: ' + (e.message || e), 'erro');
      return false;
    }
  }
};
