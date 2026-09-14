/* Modelo da ficha + sincronização com o Supabase */

const Store = {
  estado: {
    personagens: [],
    combate: { ativo: false, indice: 0, rodada: 1 }
  },

  mesaId: null,
  ehMestre: false,
  _pendentes: new Map(),
  _salvando: new Set(),
  _versoes: new Map(),

  /* ---------------- carga ---------------- */

  async carregar(mesaId, ehMestre) {
    this.mesaId = mesaId;
    this.ehMestre = ehMestre;
    try {
      this.estado.personagens = await Nuvem.carregarPersonagens(mesaId, ehMestre);
      this.guardarCache();
    } catch (e) {
      const cache = this.lerCache();
      if (cache) {
        this.estado.personagens = cache;
        toast('Sem conexão — mostrando a última versão salva neste aparelho.', 'erro');
      } else {
        throw e;
      }
    }
    this.estado.combate = this.lerCombate();
    return this.estado;
  },

  /* ---------------- gravação ---------------- */

  /* Agrupa as gravações por personagem: digitar na ficha não vira 40 requisições. */
  salvar(p) {
    if (!p || !this.mesaId) return;
    if (!this.podeEditar(p)) return;

    const versao = (this._versoes.get(p.id) || 0) + 1;
    this._versoes.set(p.id, versao);
    this.guardarCache();
    clearTimeout(this._pendentes.get(p.id));
    this._pendentes.set(p.id, setTimeout(() => this._gravar(p.id, versao), 500));
  },

  async _gravar(id, versao) {
    this._pendentes.delete(id);
    if (this._salvando.has(id)) return;
    const p = this.obter(id);
    if (!p || this._versoes.get(id) !== versao) return;
    const copia = JSON.parse(JSON.stringify(p));
    this._salvando.add(id);
    try {
      await Nuvem.salvarPersonagem(copia, this.mesaId);
      if (this.ehMestre) await Nuvem.salvarNotas(copia, this.mesaId);
    } catch (e) {
      console.error(e);
      toast('Não consegui salvar na nuvem: ' + (e.message || e), 'erro');
    } finally {
      this._salvando.delete(id);
      if (this._versoes.get(id) !== versao) this._gravar(id, this._versoes.get(id));
    }
  },

  /* Grava já, sem esperar o agrupamento (usado antes de sair da tela). */
  async salvarAgora(p) {
    if (!p || !this.mesaId || !this.podeEditar(p)) return;
    clearTimeout(this._pendentes.get(p.id));
    this._pendentes.delete(p.id);
    await Nuvem.salvarPersonagem(p, this.mesaId);
    if (this.ehMestre) await Nuvem.salvarNotas(p, this.mesaId);
  },

  async salvarOrdem() {
    this.estado.personagens.forEach((p, i) => { p.ordem = i; });
    this.guardarCache();
    try { await Nuvem.salvarOrdem(this.estado.personagens); }
    catch (e) { toast('Não consegui salvar a ordem: ' + (e.message || e), 'erro'); }
  },

  /* ---------------- CRUD ---------------- */

  async criar(rapido = false) {
    const p = this.fichaVazia();
    p.rapido = rapido;
    p.oculto = rapido && this.ehMestre;   // NPC nasce escondido dos jogadores
    p.donoId = App.sessao.user.id;
    p.ordem = this.estado.personagens.length;
    p.id = await Nuvem.criarPersonagem(p, this.mesaId);
    this.estado.personagens.push(p);
    this.guardarCache();
    return p;
  },

  async criarDoBestiario(criatura) {
    if (!this.ehMestre || !this.mesaId) throw new Error('Abra uma mesa como mestre.');
    const mesaId = this.mesaId, donoId = App.sessao.user.id;
    const p = this.fichaVazia();
    Object.assign(p, { rapido: true, oculto: true, donoId,
      nome: criatura.name, classe: [criatura.type, criatura.element, criatura.vd == null ? '' : 'VD ' + criatura.vd].filter(Boolean).join(' · '),
      bestiarioId: criatura.id, ordem: Math.max(-1, ...this.estado.personagens.map(p => Number(p.ordem) || 0)) + 1 });
    p.id = await Nuvem.criarPersonagem(p, mesaId);
    if (this.mesaId === mesaId && App.sessao?.user?.id === donoId) {
      if (!this.obter(p.id)) this.estado.personagens.push(p);
      this.guardarCache();
    }
    return p;
  },

  obter(id) {
    return this.estado.personagens.find(p => p.id === id);
  },

  async remover(id) {
    const i = this.estado.personagens.findIndex(p => p.id === id);
    if (i < 0) return;
    await Nuvem.removerPersonagem(id);
    this.estado.personagens.splice(i, 1);
    if (this.estado.combate.indice >= this.estado.personagens.length) this.estado.combate.indice = 0;
    this.guardarCache();
  },

  async duplicar(id) {
    const orig = this.obter(id);
    if (!orig) return null;
    const copia = JSON.parse(JSON.stringify(orig));
    copia.nome = (orig.nome || 'Sem nome') + ' (cópia)';
    copia.donoId = App.sessao.user.id;
    copia.ordem = this.estado.personagens.length;
    copia.id = await Nuvem.criarPersonagem(copia, this.mesaId);
    const i = this.estado.personagens.findIndex(p => p.id === id);
    this.estado.personagens.splice(i + 1, 0, copia);
    await this.salvarOrdem();
    return copia;
  },

  reordenar(ids) {
    const mapa = new Map(this.estado.personagens.map(p => [p.id, p]));
    this.estado.personagens = ids.map(id => mapa.get(id)).filter(Boolean);
    this.salvarOrdem();
  },

  /* ---------------- permissão ---------------- */

  podeEditar(p) {
    return this.ehMestre || p.donoId === App.sessao?.user?.id;
  },

  podeVerHistoria(p) {
    return this.podeEditar(p) || p.historiaPublica === true;
  },

  /* ---------------- realtime ---------------- */

  /* Aplica no array em memória uma mudança que veio de outro aparelho. */
  aplicarMudancaRemota(payload) {
    const { eventType, new: novo, old: antigo } = payload;
    if (novo?.atualizado_por === App.sessao?.user?.id) return;

    if (eventType === 'DELETE') {
      const i = this.estado.personagens.findIndex(p => p.id === antigo.id);
      if (i >= 0) this.estado.personagens.splice(i, 1);
    } else {
      const existente = this.obter(novo.id);
      const notas = existente?.notas || '';
      const convertido = Nuvem.paraApp(novo, notas);
      if (existente) Object.assign(existente, convertido);
      else this.estado.personagens.push(convertido);
      this.estado.personagens.sort((a, b) => num(a.ordem) - num(b.ordem));
    }
    this.guardarCache();
  },

  /* ---------------- cache local (só leitura, pra queda de internet) ---------------- */

  guardarCache() {
    try {
      localStorage.removeItem?.('cache_v13_' + App.sessao?.user?.id + '_' + this.mesaId);
      localStorage.setItem('cache_v19_' + App.sessao?.user?.id + '_' + this.mesaId, JSON.stringify(this.estado.personagens.map(p => ({ ...p, historiaCarregada: false, descricao: { ...p.descricao, historico: '', personalidade: '', objetivo: '' } }))));
    } catch (e) { /* cache é conveniência, não pode derrubar o app */ }
  },

  lerCache() {
    try {
      localStorage.removeItem?.('cache_v13_' + App.sessao?.user?.id + '_' + this.mesaId);
      const b = localStorage.getItem('cache_v19_' + App.sessao?.user?.id + '_' + this.mesaId);
      return b ? JSON.parse(b).map(p => this.normalizar(p)) : null;
    } catch { return null; }
  },

  /* O combate é compartilhado: o jogador vê de quem é a vez. Só o mestre escreve. */
  lerCombate() {
    return App.mesa?.combate || { ativo: false, indice: 0, rodada: 1 };
  },

  salvarCombate() {
    if (!this.ehMestre) return;
    if (App.mesa) App.mesa.combate = this.estado.combate;
    Nuvem.salvarCombate(this.mesaId, this.estado.combate)
      .catch(e => toast('Não consegui sincronizar os turnos: ' + (e.message || e), 'erro'));
  },

  /* ---------------- modelo ---------------- */

  fichaVazia() {
    return {
      id: null,
      rapido: false,
      oculto: false,
      historiaPublica: false,
      donoId: null,
      ordem: 0,
      nome: '',
      jogador: '',
      idade: '',
      imagem: '',
      imagemFerido: '',
      imagemCritica: '',
      imagemInconsciente: '',
      origem: '',
      classe: '',
      patente: '',
      nex: 5,
      desl: 9,
      peRodada: '',
      atributos: { AGI: 1, FOR: 1, INT: 1, PRE: 1, VIG: 1 },
      pv:  { atual: 0, max: 0 },
      pe:  { atual: 0, max: 0 },
      san: { atual: 0, max: 0 },
      defesa: { equip: 0, outros: 0 },
      protecao: '',
      resistencias: '',
      pericias: {},
      ataques: [],
      habilidades: [],
      rituais: [],
      desvantagensIdade: [],
      dtRituais: '',
      dtRituaisBonus: 0,
      inventario: { limites: { I: '', II: '', III: '', IV: '' }, credito: '', cargaMax: '', itens: [] },
      prestigio: '',
      municoes: [],
      aliados: [],
      cor: '',
      bonus: { corpo: 0, mente: 0 },
      descricao: { aparencia: '', personalidade: '', historico: '', objetivo: '' },
      notas: '',
      condicoes: []
    };
  },

  normalizar(p) {
    const base = this.fichaVazia();
    const out = Object.assign(base, p || {});
    out.atributos  = Object.assign(base.atributos, p?.atributos);
    // Converte o total antigo em ajuste, preservando a DT já configurada.
    if (p?.dtRituaisBonus === undefined && String(p?.dtRituais ?? '').trim() && Number.isFinite(Number(p.dtRituais))) {
      const nivel = Number(out.nex) === 99 ? 20 : Math.max(0, Math.floor(Number(out.nex || 0) / 5));
      out.dtRituaisBonus = Number(p.dtRituais) - (10 + nivel + Number(out.atributos.PRE || 0));
    }
    out.pv         = Object.assign({ atual: 0, max: 0 }, p?.pv);
    out.pe         = Object.assign({ atual: 0, max: 0 }, p?.pe);
    out.san        = Object.assign({ atual: 0, max: 0 }, p?.san);
    out.defesa     = Object.assign({ equip: 0, outros: 0 }, p?.defesa);
    out.descricao  = Object.assign(base.descricao, p?.descricao);
    out.inventario = Object.assign(base.inventario, p?.inventario);
    out.inventario.limites = Object.assign({ I: '', II: '', III: '', IV: '' }, p?.inventario?.limites);
    out.inventario.itens = p?.inventario?.itens || [];
    out.ataques     = p?.ataques     || [];
    out.habilidades = p?.habilidades || [];
    out.rituais     = p?.rituais     || [];
    out.desvantagensIdade = p?.desvantagensIdade || [];
    out.condicoes   = p?.condicoes   || [];
    out.municoes    = p?.municoes    || [];
    out.aliados     = (p?.aliados || []).map(a => Object.assign(
      { nome: '', tipo: '', foto: '', descricao: '', bonus: [], habilidades: [] }, a));
    out.bonus       = Object.assign({ corpo: 0, mente: 0 }, p?.bonus);
    out.pericias    = p?.pericias    || {};
    PERICIAS.forEach(per => {
      if (!out.pericias[per.key]) out.pericias[per.key] = { treino: 0, outros: 0 };
    });
    return out;
  },

  /* ---------------- backup ---------------- */

  exportar() {
    const blob = new Blob([JSON.stringify({ personagens: this.estado.personagens }, null, 2)],
                          { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `ouroboros-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async importar(texto) {
    const dados = JSON.parse(texto);
    const lista = (dados.personagens || dados).map(p => this.normalizar(p));
    for (const p of lista) {
      p.donoId = App.sessao.user.id;
      p.ordem = this.estado.personagens.length;
      p.id = await Nuvem.criarPersonagem(p, this.mesaId);
      this.estado.personagens.push(p);
    }
    this.guardarCache();
    return lista.length;
  }
};

/* ---------------- derivados ---------------- */

/* Aliado dá bônus em perícia (o cão adestrado dá +2 em Investigação e
   Percepção, por exemplo). Soma aqui pra entrar na rolagem sozinho. */
function bonusAliados(p, periciaKey) {
  return (p.aliados || []).reduce((total, a) =>
    total + (a.bonus || []).reduce((s, b) =>
      s + (b.pericia === periciaKey ? Number(b.valor || 0) : 0), 0), 0);
}

function bonusPericia(p, periciaKey) {
  const per = PERICIAS.find(x => x.key === periciaKey);
  const dados = Number(p.pericias?.[periciaKey]?.treino || 0);
  const outros = Number(p.pericias?.[periciaKey]?.outros || 0);
  const aliado = bonusAliados(p, periciaKey);
  return {
    attr: per.attr,
    dados: Number(p.atributos?.[per.attr] || 0),
    bonus: dados + outros + aliado,
    aliado
  };
}

function formulaPericia(p, periciaKey) {
  const b = bonusPericia(p, periciaKey);
  const qtd = b.dados <= 0 ? '2d20↓' : `${b.dados}d20`;
  return b.bonus ? `${qtd} ${b.bonus > 0 ? '+' : '−'} ${Math.abs(b.bonus)}` : qtd;
}

function defesaTotal(p) {
  return 10 + Number(p.atributos?.AGI || 0) + Number(p.defesa?.equip || 0) + Number(p.defesa?.outros || 0);
}

function pad(n) { return String(n).padStart(2, '0'); }
