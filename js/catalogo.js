/* Catálogo de itens dos livros — a lista que o popup do inventário mostra.

   Fonte: tabela `itens_catalogo` do Supabase, que só quem está logado lê
   (sql/v12-catalogo-itens.sql). São estatísticas dos livros da Jambô: não
   podem virar arquivo público do site.

   No desenvolvimento, enquanto a tabela não existe (ou o Supabase não está
   configurado), cai no `catalogo/catalogo-limpo.json` — que o .vercelignore
   barra, então essa queda só acontece na máquina de quem está mexendo.

   Carrega uma vez por sessão e guarda: são ~160 linhas que nunca mudam
   durante o jogo. */

const Catalogo = {
  itens: null,
  promessa: null,
  origem: '',        // 'nuvem' | 'local' | '' — aparece no rodapé do popup

  /* Chamadas simultâneas (abrir o popup duas vezes rápido) compartilham a
     mesma promessa em vez de baterem no banco duas vezes. */
  carregar() {
    if (this.itens) return Promise.resolve(this.itens);
    if (!this.promessa) this.promessa = this.buscar().finally(() => { this.promessa = null; });
    return this.promessa;
  },

  async buscar() {
    try {
      if (Nuvem.cliente) {
        const lista = await Nuvem.catalogoItens();
        if (lista.length) { this.origem = 'nuvem'; return (this.itens = this.corrigirGrupos(lista)); }
      }
    } catch (e) {
      /* tabela ainda não criada, sem sessão, sem rede: tenta o arquivo local */
      console.warn('catálogo do Supabase indisponível:', e.message || e);
    }
    try {
      const r = await fetch('catalogo/catalogo-limpo.json');
      if (r.ok) { this.origem = 'local'; return (this.itens = this.corrigirGrupos(await r.json())); }
    } catch (e) { /* sem arquivo local também: lista vazia, o popup avisa */ }
    this.origem = '';
    return (this.itens = []);
  },

  componentes() {
    return ['Sangue', 'Morte', 'Conhecimento', 'Energia'].map(elemento => ({
      nome: `Componentes ritualísticos de ${elemento}`, grupo: 'Itens paranormais',
      categoria: 0, espacos: 1, livro: 'Livro Básico', pagina: '66–67',
      descricao: `Conjunto de componentes para conjurar rituais de ${elemento}. Medo não utiliza componentes ritualísticos.`
    }));
  },

  /* Corrige também catálogos já cadastrados, antes da migração v17. */
  corrigirGrupos(lista) {
    const paranormais = new Map([
      ['Amarras elementais', 'Livro Básico'], ['Crânio Dominador', 'Arquivos Secretos 3'],
      ['Gaiola do Corvo', 'Arquivos Secretos 3'],
      ...['Ligação Direta Infernal', 'Medidor de Condição Vertebral', 'Pendrive selado', 'Pé de Morto', 'Valete da Salvação']
        .map(nome => [nome, 'Sobrevivendo ao Horror'])
    ]);
    const catalisadores = new Map([
      ...['Ampliador', 'Perturbador', 'Potencializador', 'Prolongador'].map(nome => [nome, 'Sobrevivendo ao Horror']),
      ['Catalisador Sofisticado e Horrorizado', 'Arquivos Secretos 2']
    ]);
    const elementosExtraidos = ['Sangue', 'Morte', 'Conhecimento', 'Energia', 'Medo'];
    const corrigida = lista.filter(i => !(i.livro === 'Sobrevivendo ao Horror' && elementosExtraidos.includes(i.nome)))
      .map(i => catalisadores.get(i.nome) === i.livro ? { ...i, grupo: 'Catalisadores' }
        : paranormais.get(i.nome) === i.livro ? { ...i, grupo: 'Itens paranormais' }
        : i.grupo === 'Catalisador' ? { ...i, grupo: 'Catalisadores' } : i);
    for (const item of this.componentes()) {
      if (!corrigida.some(i => i.nome === item.nome && i.livro === item.livro)) corrigida.push(item);
    }
    return corrigida;
  },

  grupos() {
    return [...new Set((this.itens || []).map(i => i.grupo))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },

  /* A ficha guarda categoria como texto romano ('' a 'IV'); o livro (e o
     banco) numeram de 0 a 4, e categoria 0 é "item comum", que na ficha não
     ocupa nenhum dos quatro limites — por isso vira vazio. */
  categoriaTexto(n) {
    return ['', 'I', 'II', 'III', 'IV'][Number(n) || 0] || '';
  },

  /* Espaços saem como número (0.5, 1, 2). O campo da ficha é texto e a soma
     usa num(), que não entende vírgula — então grava com ponto mesmo. */
  espacosTexto(e) {
    const n = Number(e);
    if (!Number.isFinite(n) || n === 0) return '';
    return String(n);
  },

  descricaoItem(item) {
    if (item.descricao) return item.descricao;
    const candidatos = (this.itens || []).filter(i => this.normal(i.nome).trim() === this.normal(item.nome).trim()
      && (!item.livro || item.livro === i.livro));
    return candidatos.length === 1 ? candidatos[0].descricao || '' : '';
  },

  paraItemDaFicha(i) {
    return {
      nome: i.nome,
      categoria: this.categoriaTexto(i.categoria),
      espacos: this.espacosTexto(i.espacos),
      descricao: i.descricao || '',
      livro: i.livro || '',
      pagina: i.pagina || ''
    };
  },

  /* busca sem acento e sem caixa: "pistola" acha "Pistola", "muniçao" acha
     "Munição" */
  normal(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  },

  filtrar({ busca = '', grupo = '', categoria = '' } = {}) {
    const b = this.normal(busca).trim();
    return (this.itens || []).filter(i =>
      (!grupo || i.grupo === grupo) &&
      (categoria === '' || String(i.categoria) === String(categoria)) &&
      (!b || this.normal(i.nome + ' ' + i.grupo + ' ' + i.livro).includes(b)));
  }
};
