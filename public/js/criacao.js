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
            <span>Escolhas explicadas: conceito, origem, classe, atributos, perícias e equipamento.
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
    this.criado = null;
    this.d = {
      nome: '', jogador: '', origem: '', classe: '',
      attrs: { AGI: 1, FOR: 1, INT: 1, PRE: 1, VIG: 1 },
      pericias: [], nex: 5, estagio: 1, patente: 'Recruta', perito: [], rituais: [], itens: [], escolhaOrigem: '',
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
        <b>duas perícias treinadas</b> e <b>um poder</b>. As perícias fixas serão marcadas para você e o poder será registrado na ficha.</p>
        <label class="campo"><span>Origem</span>
          <input id="c-origem" value="${esc(d.origem)}" list="dl-origens-cri" placeholder="Ex.: Teórico da Conspiração">
          <datalist id="dl-origens-cri">${ORIGENS.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
        </label>
        <div class="chips chips-origem">
          ${ORIGENS.map(o => {
            const i = ORIGEM_INFO[o];
            const info = i
              ? ` data-ajuda="${esc(i.efeito)}" data-ajuda-sub="Treina ${esc(i.pericias)}" data-ajuda-titulo="${esc(i.poder)}"`
              : '';
            return `<button class="chip" data-origem="${esc(o)}"${info}>${esc(o)}</button>`;
          }).join('')}
        </div>
        <p class="dica-passo">Passe o mouse em qualquer uma pra ver as perícias que ela treina e o poder que ela dá.
        Não achou a sua na lista? Pode digitar qualquer coisa — o campo é livre,
        e origens de outros livros funcionam igual.</p>
        <div class="origem-detalhe" id="c-origem-detalhe" hidden></div>`;
      },
      ligar() {
        const raiz = Criacao.raiz();

        /* A dica passa rápido demais pra anotar. Depois de escolher, o mesmo
           resumo fica fixo embaixo da lista — é o que a pessoa vai copiar pro
           passo das perícias. Vale também pra origem digitada à mão. */
        const detalhe = $('#c-origem-detalhe', raiz);
        const fixar = nome => {
          const i = ORIGEM_INFO[nome];
          detalhe.hidden = !i;
          if (!i) return;
          detalhe.innerHTML = `<span class="od-sub">Treina ${esc(i.pericias)}</span>
            <b class="od-poder">${esc(i.poder)}</b>
            <span class="od-efeito">${esc(i.efeito)}</span><small>${esc(i.fonte || "")}</small>`;
        };

        const marcar = nome => {
          $$('[data-origem]', raiz).forEach(x => x.classList.toggle('ativo', x.dataset.origem === nome));
          fixar(nome);
        };

        $$('[data-origem]', raiz).forEach(b => b.addEventListener('click', () => {
          $('#c-origem', raiz).value = b.dataset.origem;
          marcar(b.dataset.origem);
        }));
        $('#c-origem', raiz).addEventListener('input', e => marcar(e.target.value.trim()));
        marcar($('#c-origem', raiz).value.trim());
      },
      validar() {
        const origem = $('#c-origem', this.raiz()).value.trim();
        if (origem !== this.d.origem) this.d.pericias = [];
        this.d.origem = origem;
        if (!origem) { toast('Escolha ou escreva sua origem.', 'erro'); return false; }
      }
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
          if (Criacao.d.classe !== b.dataset.classe) { Criacao.d.pericias = []; Criacao.d.perito = []; Criacao.d.rituais = []; }
          Criacao.d.classe = b.dataset.classe;
          Criacao.d.nex = Regras.civil(Criacao.d) ? 0 : 5;
          Criacao.d.patente = Regras.civil(Criacao.d) ? '' : 'Recruta';
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
          const s = Regras.status(d);
          $('#attr-previa', raiz).textContent = s
            ? `Como ${d.classe} em NEX ${d.nex}%: ${s.pv} PV · ${s.pe} PE · ${s.san} SAN · Defesa ${10 + num(d.attrs.AGI) + (d.origem === 'Policial' ? 2 : 0)}`
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
          if (Number(delta) > 0 && Criacao.pontosGastos() > Criacao.pontosTotais()) {
            d.attrs[k] = antes;
            return toast('Acabaram os pontos. Tire de outro atributo primeiro.', 'erro');
          }
          pinta();
        }));
        pinta();
      },
      validar() {
        const sobra = Criacao.pontosTotais() - Criacao.pontosGastos();
        if (sobra !== 0) { toast(sobra > 0 ? `Distribua os ${sobra} pontos restantes.` : `Retire ${-sobra} pontos: a classe escolhida tem menos pontos iniciais.`, 'erro'); return false; }
      }
    },

    /* 5. perícias ------------------------------------------------ */
    {
      titulo: 'Perícias treinadas',
      html() {
        const d = Criacao.d;
        const info = CLASSE_INFO[d.classe] || { obrigatorias: [], livres: 0 };
        const obrig = info.obrigatorias.map(par => par.join(' ou ')).join(' · ');
        const fixas = [...new Set([...Regras.origemFixas(d.origem), ...info.obrigatorias.filter(p=>p.length===1).map(p=>slug(p[0]))])];
        d.pericias = [...new Set([...fixas, ...d.pericias])];
        return `
        <p class="dialogo">Treinar dá <b>+5</b> nos testes daquela perícia. Como <b>${esc(d.classe)}</b>
        com Intelecto ${num(d.attrs.INT)}, você marca <b>${Criacao.totalPericias()}</b> no total —
        isso já inclui as <b>2 da origem</b>. Perícias repetidas entre origem e classe liberam escolhas adicionais; não dão +10.</p>
        ${obrig ? `<p class="dica-passo">Sua classe pede obrigatoriamente: <b>${esc(obrig)}</b>.</p>` : ''}
        <p class="dica-passo">As marcadas com <i>*</i> só podem ser usadas se treinadas — sem treino,
        você nem rola o dado.</p>
        <div class="grade-pericias" id="grade-pericias">
          ${PERICIAS.map(per => `
            <label class="per-item" data-item="${per.key}">
              <input type="checkbox" data-per-chk="${per.key}" ${d.pericias.includes(per.key) ? 'checked' : ''} ${fixas.includes(per.key) ? 'data-fixa disabled' : ''}>
              <span class="per-txt"><b>${esc(per.nome)}${per.treinada ? '<i class="ast">*</i>' : ''}</b>
                <em>${per.attr}${fixas.includes(per.key) ? ' · recebida da origem/classe' : ''}</em>
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
          el.textContent = sobra === 0 ? 'Todas escolhidas ✓' : sobra > 0 ? `Faltam ${sobra} de ${limite}` : `Retire ${-sobra} perícias para respeitar o limite ${limite}`;
          el.className = sobra === 0 ? 'ok' : '';
          /* trava o que sobrou quando o limite fecha, pra ninguém treinar demais */
          $$('[data-per-chk]', raiz).forEach(c => {
            c.disabled = c.hasAttribute('data-fixa') || (sobra <= 0 && !c.checked);
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
        if (falta !== 0) { toast(falta > 0 ? `Escolha mais ${falta} perícias.` : `Retire ${-falta} perícias.`, 'erro'); return false; }
        const faltando = Regras.obrigatorias(this.d.classe).find(par => !par.some(n=>this.d.pericias.includes(slug(n))));
        if (faltando) { toast(`Sua classe exige ${faltando.join(' ou ')}. Troque uma das escolhas livres.`, 'erro'); return false; }
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
        const s = Regras.status(d) || { pv: 0, pe: 0, san: 0 };
        const nomes = d.pericias.map(k => PERICIAS.find(p => p.key === k)?.nome).filter(Boolean);
        return `
        <p class="dialogo">Último olhar. O que estiver errado dá pra corrigir voltando — e tudo
        continua editável na ficha depois.</p>
        <p class="dica-passo">Criação inicial: ${Regras.civil(d) ? 'NEX 0%' : 'NEX 5%' }${d.classe === 'Sobrevivente' ? ', estágio 1' : ''}. Depois você pode evoluir pela ficha e acompanhar as novas escolhas no guia.</p>
        <div class="revisao">
          <div><span>Personagem</span><b>${esc(d.nome)}</b></div>
          <div><span>Origem</span><b>${esc(d.origem || '—')}</b></div>
          <div><span>Classe</span><b>${esc(d.classe)}</b></div>
          <div><span>Atributos</span><b>${ATRIBUTOS.map(a => `${a.key} ${num(d.attrs[a.key])}`).join(' · ')}</b></div>
          <div><span>Treinadas</span><b>${nomes.length ? esc(nomes.join(', ')) : '—'}</b></div>
          <div><span>Vai nascer com</span><b id="c-status">${s.pv} PV · ${s.pe} PE · ${s.san} SAN · Defesa ${10 + num(d.attrs.AGI) + (d.origem === 'Policial' ? 2 : 0)}</b></div>
        </div>
        <p class="dica-passo">${d.itens.length} itens escolhidos. Poderes condicionais, escolhas narrativas e ataques das armas devem ser conferidos na ficha. Bônus de origem em PV, PE, SAN e Defesa já entram nesta prévia.</p>`;
      },

    }
  ],

  /* ---------------- gravar ---------------- */

  async finalizar() {
    if (this.salvando) return false;
    this.salvando = true;
    const d = this.d;
    try {
      const p = this.criado || await Store.criar(false);
      this.criado = p;
      p.nome = d.nome;
      p.jogador = d.jogador;
      p.origem = d.origem;
      p.classe = d.classe;
      p.patente = d.patente;
      p.nex = d.nex;
      p.estagio = d.classe === "Sobrevivente" ? 1 : null;
      p.perito = [...d.perito];
      p.proficiencias = CLASSE_INFO[d.classe].proficiencias;
      p.escolhaOrigem = d.escolhaOrigem;
      p.habilidades = Regras.habilidadesIniciais(d);
      p.rituais = d.rituais.map(r=>({...r}));
      p.inventario = { ...Regras.equipamento(d), itens: d.itens.map(i=>({...i})) };
      p.peRodada = Regras.limitePE(d);
      p.dtRituais = 10 + Regras.limitePE({...d, origem: ""}) + num(d.attrs.PRE);
      p.defesa.outros = d.origem === "Policial" ? 2 : 0;
      if (d.origem === "Teórico da Conspiração") p.resistencias = `Mental ${num(d.attrs.INT)}`;
      if (d.origem === "Experimento") p.resistencias = "Todos 2";
      p.pericias = {};
      PERICIAS.forEach(per => { p.pericias[per.key] = {treino: 0, outros: 0}; });
      p.atributos = { ...d.attrs };
      p.descricao = { ...d.descricao };
      d.pericias.forEach(k => { p.pericias[k] = { treino: 5, outros: 0 }; });

      const s = Regras.status(d);
      if (s) {
        p.pv = { atual: s.pv, max: s.pv };
        p.pe = { atual: s.pe, max: s.pe };
        p.san = { atual: s.san, max: s.san };
      }

      if (d.origem === 'Diplomata') p.pericias.diplomacia.outros = 2;
      if (d.origem === 'Profetizado') p.pericias.vontade.outros = 2;
      await Store.salvarAgora(p);
      Mesa.render();
      toast(`${p.nome} entrou na mesa.`);
      Ficha.abrir(p.id);
      this.d = null;
      this.criado = null;
    } catch (e) {
      toast('Não consegui criar: ' + (e.message || e), 'erro');
      return false;
    } finally { this.salvando = false; }
  }
};

/* Escolhas que antes eram perdidas entre a criação e a ficha. */
Criacao.passos.splice(5, 0, {
  titulo: 'Poderes e escolhas',
  html() {
    const d=Criacao.d, o=ORIGEM_INFO[d.origem];
    return `<p class="dialogo">O poder da origem e as habilidades iniciais da classe serão registrados. Quando um poder pede uma escolha, anote-a aqui para lembrar durante o jogo.</p>
      <div class="origem-detalhe"><b>${esc(o?.poder || 'Origem personalizada')}</b><p>${esc(o?.efeito || 'Descreva com o mestre as regras da sua origem.')}</p><small>${esc(o?.fonte || '')}</small></div>
      <label class="campo"><span>Escolhas da origem / detalhes do poder</span><textarea id="c-escolha-origem" rows="3" placeholder="Ex.: arma de trabalho do Operário; poder paranormal do Cultista; perícia do companheiro animal; número da sorte…">${esc(d.escolhaOrigem)}</textarea></label>
      ${d.classe==='Especialista'?`<p class="dialogo"><b>Perito:</b> escolha duas perícias treinadas, exceto Luta e Pontaria. Gastando 2 PE, você soma 1d6 ao teste de uma delas.</p><div class="grade-pericias">${PERICIAS.filter(p=>d.pericias.includes(p.key)&&!['luta','pontaria'].includes(p.key)).map(p=>`<label class="per-item"><input type="checkbox" data-perito="${p.key}" ${d.perito.includes(p.key)?'checked':''}><span>${esc(p.nome)}</span></label>`).join('')}</div>`:''}
      ${d.classe==='Ocultista'?`<p class="dialogo"><b>Escolhido pelo Outro Lado:</b> escolha três rituais diferentes de 1º círculo. Consulte o capítulo de rituais para escolher os efeitos. O custo básico é 1 PE; aprender um ritual não preenche automaticamente seus efeitos.</p>${[0,1,2].map(i=>`<div class="grade-2"><label class="campo"><span>Ritual ${i+1} — nome</span><input data-ritual-nome="${i}" value="${esc(d.rituais[i]?.nome || '')}" placeholder="Nome do ritual de 1º círculo"></label><label class="campo"><span>Elemento</span><select data-ritual-elemento="${i}">${ELEMENTOS.filter(e=>!['medo','varia'].includes(e.id)).map(e=>`<option value="${e.id}" ${d.rituais[i]?.elemento===e.id?'selected':''}>${e.nome}</option>`).join('')}</select></label></div>`).join('')}`:`<p class="dica-passo">${esc(CLASSE_INFO[d.classe].marca)} Uma habilidade no custo mínimo pode ser usada mesmo quando esse custo supera seu limite de PE por turno.</p>`}`;
  },
  validar() {
    const d=this.d, raiz=this.raiz();
    d.escolhaOrigem=$('#c-escolha-origem',raiz).value.trim();
    if (d.classe==='Especialista') {
      d.perito=$$('[data-perito]:checked',raiz).map(c=>c.dataset.perito);
      if(d.perito.length!==2) {toast('Escolha exatamente duas perícias para Perito.','erro');return false;}
    }
    if(d.classe==='Ocultista') {
      d.rituais=[0,1,2].map(i=>({nome:$(`[data-ritual-nome="${i}"]`,raiz).value.trim(),elemento:$(`[data-ritual-elemento="${i}"]`,raiz).value,circulo:'1',custo:'1',execucao:'',alcance:'',alvo:'',duracao:'',resistencia:'',pagina:'',desc:''}));
      if(d.rituais.some(r=>!r.nome||!r.elemento)||new Set(d.rituais.map(r=>slug(r.nome))).size!==3) {toast('Informe três rituais diferentes e seus elementos.','erro');return false;}
    }
    if(['Cultista Arrependido','Amnésico','Operário','Engenheiro','Amigo dos Animais','Experimento','Inventor Paranormal','Profetizado','Jovem Místico','Colegial'].includes(d.origem) && !d.escolhaOrigem) {
      toast('Essa origem pede uma escolha. Registre o detalhe combinado com o mestre.','erro'); return false;
    }
  }
}, {
  titulo: 'Equipamento inicial',
  html() {
    const d=Criacao.d;
    if(!Regras.civil(d)&&!Regras.patentes[d.patente]) d.patente='Recruta';
    const eq=Regras.equipamento(d);
    return `<p class="dialogo">${Regras.civil(d)?'Você pode escolher um item de categoria I e itens de categoria 0 compatíveis com sua origem. Civis não usam patentes.':'Sua patente define os itens que a Ordem libera. Categoria 0 não tem limite de quantidade, mas ainda ocupa espaço.'}</p>
      ${!Regras.civil(d)?`<label class="campo"><span>Patente combinada com o mestre</span><select id="c-patente">${PATENTES.map(p=>`<option ${p===d.patente?'selected':''}>${p}</option>`).join('')}</select></label>`:''}
      <p class="dica-passo" id="c-equip-limites">${CATEGORIAS_ITEM.map(c=>`${c}: ${eq.limites[c]}`).join(' · ')} · Crédito ${esc(eq.credito)} · Carga ${eq.cargaMax} espaços</p>
      <label class="campo"><span>Buscar no catálogo</span><input id="c-item-busca" placeholder="Ex.: lanterna, proteção, arma"></label>
      <div id="c-itens-catalogo" class="cri-itens-catalogo"><p>Carregando itens…</p></div>
      <div id="c-itens-escolhidos"></div>
      <p class="dica-passo">Pode continuar sem equipamento e completá-lo depois em Inventário. Os limites validados aqui são os padrões; ajuste exceções de poderes na ficha.</p>`;
  },
  ligar() {
    const raiz=this.raiz(), d=this.d;
    const lista=$('#c-itens-catalogo',raiz), selecionados=$('#c-itens-escolhidos',raiz);
    const pintar=()=>{
      const eq=Regras.equipamento(d);
      $('#c-equip-limites',raiz).textContent=`${CATEGORIAS_ITEM.map(c=>`${c}: ${eq.limites[c]}`).join(' · ')} · Crédito ${eq.credito} · Carga ${eq.cargaMax} espaços`;
      selecionados.innerHTML=`<p>${d.itens.length} itens · ${d.itens.reduce((n,i)=>n+num(i.espacos),0)} / ${eq.cargaMax} espaços</p>${d.itens.map((i,n)=>`<button class="btn btn-ghost btn-peq" data-remover-item="${n}" aria-label="Remover ${esc(i.nome)}">${esc(i.nome)} ×</button>`).join('')}`;
    };
    const buscar=()=>{
      const itens=Catalogo.filtrar({busca:$('#c-item-busca',raiz).value});
      lista.innerHTML=itens.length?itens.slice(0,35).map(i=>`<button class="btn btn-ghost cri-item" data-item-id="${Catalogo.itens.indexOf(i)}"><b>${esc(i.nome)}</b><span>Categoria ${esc(Catalogo.categoriaTexto(i.categoria)||'0')} · ${num(i.espacos)} espaços</span></button>`).join(''):'<p>Nenhum item disponível. Você pode preencher o Inventário na ficha.</p>';
    };
    $('#c-patente',raiz)?.addEventListener('change',e=>{d.patente=e.target.value;pintar();});
    $('#c-item-busca',raiz).addEventListener('input',buscar);
    lista.addEventListener('click',e=>{
      const b=e.target.closest('[data-item-id]');if(!b)return;
      const i=Catalogo.itens[Number(b.dataset.itemId)];if(!i)return;
      const item=Catalogo.paraItemDaFicha(i),eq=Regras.equipamento(d);
      if(item.categoria&&d.itens.filter(x=>x.categoria===item.categoria).length>=eq.limites[item.categoria]) return toast('Limite dessa categoria atingido.','erro');
      if(d.itens.reduce((n,x)=>n+num(x.espacos),0)+num(item.espacos)>eq.cargaMax) return toast('Não cabe sem sobrecarga. Retire outro item primeiro.','erro');
      d.itens.push(item);pintar();
    });
    selecionados.addEventListener('click',e=>{const b=e.target.closest('[data-remover-item]');if(b){d.itens.splice(Number(b.dataset.removerItem),1);pintar();}});
    pintar();
    Catalogo.carregar().then(()=>{if(lista.isConnected)buscar();}).catch(()=>{if(lista.isConnected)lista.textContent='Catálogo indisponível. Complete o inventário na ficha.';});
  },
  validar() {
    const eq=Regras.equipamento(this.d), itens=this.d.itens;
    if(CATEGORIAS_ITEM.some(c=>itens.filter(i=>i.categoria===c).length>eq.limites[c])||itens.reduce((n,i)=>n+num(i.espacos),0)>eq.cargaMax){toast('Revise os itens: a patente ou os atributos mudaram e os limites foram excedidos.','erro');return false;}
  }
});
