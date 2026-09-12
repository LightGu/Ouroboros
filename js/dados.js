/* Constantes da ficha de agente — Ordem Paranormal RPG */

const ATRIBUTOS = [
  { key: 'AGI', nome: 'Agilidade' },
  { key: 'FOR', nome: 'Força' },
  { key: 'INT', nome: 'Intelecto' },
  { key: 'PRE', nome: 'Presença' },
  { key: 'VIG', nome: 'Vigor' }
];

/* nome, atributo base, treinada = só pode ser usada se treinada */
const PERICIAS = [
  ['Acrobacia',      'AGI', false],
  ['Adestramento',   'PRE', true ],
  ['Artes',          'PRE', true ],
  ['Atletismo',      'FOR', false],
  ['Atualidades',    'INT', false],
  ['Ciências',       'INT', true ],
  ['Crime',          'AGI', true ],
  ['Diplomacia',     'PRE', false],
  ['Enganação',      'PRE', false],
  ['Fortitude',      'VIG', false],
  ['Furtividade',    'AGI', false],
  ['Iniciativa',     'AGI', false],
  ['Intimidação',    'PRE', false],
  ['Intuição',       'PRE', false],
  ['Investigação',   'INT', false],
  ['Luta',           'FOR', false],
  ['Medicina',       'INT', false],
  ['Ocultismo',      'INT', true ],
  ['Percepção',      'PRE', false],
  ['Pilotagem',      'AGI', true ],
  ['Pontaria',       'AGI', false],
  ['Profissão',      'INT', true ],
  ['Reflexos',       'AGI', false],
  ['Religião',       'PRE', true ],
  ['Sobrevivência',  'INT', false],
  ['Tática',         'INT', true ],
  ['Tecnologia',     'INT', true ],
  ['Vontade',        'PRE', false]
].map(([nome, attr, treinada]) => ({ nome, attr, treinada, key: slug(nome) }));

const TREINO = [
  { v: 0,  label: 'Destreinado' },
  { v: 5,  label: 'Treinado' },
  { v: 10, label: 'Veterano' },
  { v: 15, label: 'Expert' }
];

const CLASSES = ['Combatente', 'Especialista', 'Ocultista', 'Sobrevivente', 'Mundano'];

const ORIGENS = [
  'Acadêmico', 'Agente de Saúde', 'Amnésico', 'Artista', 'Atleta', 'Chef', 'Criminoso',
  'Cultista Arrependido', 'Desgarrado', 'Engenheiro', 'Executivo', 'Explorador', 'Fanático',
  'Ginasta', 'Investigador', 'Inventor', 'Lutador', 'Magnata', 'Máquina', 'Mercenário',
  'Militar', 'Operário', 'Policial', 'Político', 'Profetizado', 'Religioso',
  'Servidor Público', 'T.I.', 'Teórico da Conspiração', 'Trabalhador Rural',
  'Trombadinha', 'Universitário', 'Vítima'
].sort((a, b) => a.localeCompare(b, 'pt-BR'));

/* Resumo de cada origem: as duas perícias que ela treina e o poder que ela
   entrega. Aparece na dica ao passar o mouse no passo "De onde ele veio" da
   criação guiada.

   ATENÇÃO A QUEM FOR EDITAR: o livro básico NÃO está na pasta de PDFs — lá só
   existem os Arquivos Secretos e o Sobrevivendo ao Horror. Estes textos foram
   escritos de fora, então trate os números como aproximação até conferir no
   livro. Corrigir é só mexer aqui; nada mais depende dessa tabela. */
const ORIGEM_INFO = {
  'Acadêmico': { pericias: 'Ciências e Investigação', poder: 'Saber é Poder',
    efeito: 'Gastando PE você soma um bônus grande num teste de perícia baseada em Intelecto. A origem dos que resolvem no raciocínio.' },
  'Agente de Saúde': { pericias: 'Intuição e Medicina', poder: 'Técnica Medicinal',
    efeito: 'Seus usos de Medicina rendem mais: cura acima do normal e mais chance de tirar alguém de Morrendo. O médico de campo do grupo.' },
  'Amnésico': { pericias: 'duas à escolha do mestre', poder: 'Lampejo do Passado',
    efeito: 'Uma vez por sessão uma memória volta e você fica treinado numa perícia qualquer até o fim da cena. Coringa, e um prato cheio de história.' },
  'Artista': { pericias: 'Artes e Enganação', poder: 'Musa Inspiradora',
    efeito: 'Gastando PE você inspira quem te vê ou ouve, dando bônus em testes ao grupo. Suporte que trabalha na base do carisma.' },
  'Atleta': { pericias: 'Acrobacia e Atletismo', poder: 'Impulso Atlético',
    efeito: 'Gasta PE pra aumentar o deslocamento no turno. Quem chega primeiro, foge melhor e alcança o que ninguém alcança.' },
  'Chef': { pericias: 'Fortitude e Profissão', poder: 'Ingrediente Secreto',
    efeito: 'A refeição que você prepara no interlúdio devolve mais PE e PV ao grupo. Vale muito mais do que parece numa campanha longa.' },
  'Criminoso': { pericias: 'Crime e Furtividade', poder: 'Dedos Leves',
    efeito: 'Arromba, furta e abre fechadura mais rápido e sem chamar atenção. Resolve por fora o que o grupo não consegue por dentro.' },
  'Cultista Arrependido': { pericias: 'Ocultismo e Religião', poder: 'Conhecimento Proibido',
    efeito: 'Você já conhece um ritual de 1º círculo, mesmo sem ser Ocultista. Traz o Outro Lado pra qualquer classe.' },
  'Desgarrado': { pericias: 'Fortitude e Sobrevivência', poder: 'Sem Raízes',
    efeito: 'Viveu sem casa e sem rede de apoio: aguenta fome, frio e noite mal dormida sem penalidade. Difícil de quebrar pelo desgaste.' },
  'Engenheiro': { pericias: 'Profissão e Tecnologia', poder: 'Projetista',
    efeito: 'Improvisa reparo e melhora equipamento com o que tiver à mão. Mantém o material do grupo funcionando no meio do nada.' },
  'Executivo': { pericias: 'Diplomacia e Profissão', poder: 'Patrocínio',
    efeito: 'Seu crédito junto à Ordem é maior: consegue requisitar mais coisa sem justificar. Equipa o time.' },
  'Explorador': { pericias: 'Percepção e Sobrevivência', poder: 'Desbravador',
    efeito: 'Se vira em qualquer terreno: rastreia, acha caminho e não se perde. A origem das missões longe da cidade.' },
  'Fanático': { pericias: 'Religião e Vontade', poder: 'Fé Inabalável',
    efeito: 'Sua convicção segura o baque mental: resiste melhor a medo e a efeito que mexa com a cabeça. Sanidade é o recurso mais frágil do jogo.' },
  'Ginasta': { pericias: 'Acrobacia e Reflexos', poder: 'Equilibrista',
    efeito: 'Cai, escala e passa por lugar apertado sem se machucar. Mobilidade pura, útil em perseguição e em armadilha.' },
  'Investigador': { pericias: 'Investigação e Percepção', poder: 'Faro para Pistas',
    efeito: 'Acha pista que passaria batido e junta as peças mais rápido. A origem que mais empurra a história pra frente.' },
  'Inventor': { pericias: 'Profissão e Tecnologia', poder: 'Engenhoca',
    efeito: 'Monta um dispositivo improvisado que resolve um problema específico da cena. Criativo, depende de combinar com o mestre.' },
  'Lutador': { pericias: 'Luta e Fortitude', poder: 'Golpe de Mestre',
    efeito: 'Briga treinada: acerta mais e bate mais forte no corpo a corpo. Direto ao ponto.' },
  'Magnata': { pericias: 'Diplomacia e Pilotagem', poder: 'Dinheiro é Poder',
    efeito: 'Dinheiro abre portas que a Ordem não abre: contato, transporte, acesso. Resolve fora do combate.' },
  'Máquina': { pericias: 'Fortitude e Luta', poder: 'Extensão do Corpo',
    efeito: 'Corpo modificado ou prótese que conta como parte de você. Aguenta pancada e bate com o que tem.' },
  'Mercenário': { pericias: 'Iniciativa e Intimidação', poder: 'Matador de Aluguel',
    efeito: 'Age antes dos outros e impõe medo. Quem controla o primeiro turno controla a luta.' },
  'Militar': { pericias: 'Pontaria e Tática', poder: 'Treinamento de Combate',
    efeito: 'Formação de caserna: arma de fogo, disciplina sob fogo e leitura de campo. A origem mais direta pro Combatente.' },
  'Operário': { pericias: 'Fortitude e Profissão', poder: 'Ferramenta de Trabalho',
    efeito: 'Ferramenta pesada vira arma na sua mão e trabalho braçal não te cansa. Prático e barato.' },
  'Policial': { pericias: 'Percepção e Pontaria', poder: 'Patrulheiro',
    efeito: 'Treino de rua: arma, abordagem e reconhecer quem está mentindo. Investiga e atira.' },
  'Político': { pericias: 'Diplomacia e Enganação', poder: 'Discurso Caloroso',
    efeito: 'Convence, desarma e vira uma sala a seu favor. Resolve cena social sem tirar a arma.' },
  'Profetizado': { pericias: 'Religião e Vontade', poder: 'Sina',
    efeito: 'Uma profecia te cerca: de vez em quando o destino mexe um resultado a seu favor. Rende muita história.' },
  'Religioso': { pericias: 'Religião e Vontade', poder: 'Palavra de Conforto',
    efeito: 'Acalma quem está perdendo a cabeça e ajuda o grupo a segurar a Sanidade. Suporte mental.' },
  'Servidor Público': { pericias: 'Intuição e Vontade', poder: 'Espírito Cívico',
    efeito: 'Conhece a máquina por dentro: consegue informação, documento e acesso oficial. Abre porta na burocracia.' },
  'T.I.': { pericias: 'Investigação e Tecnologia', poder: 'Hacker',
    efeito: 'Invade sistema, rastreia registro e tira da rede o que não deveria estar lá. Investigação moderna.' },
  'Teórico da Conspiração': { pericias: 'Investigação e Ocultismo', poder: 'Eu Já Sabia!',
    efeito: 'Passou a vida juntando peças que ninguém levava a sério — e estava certo. Reconhece o paranormal antes dos outros.' },
  'Trabalhador Rural': { pericias: 'Adestramento e Sobrevivência', poder: 'Vida na Fazenda',
    efeito: 'Lida com bicho e com terra: monta, doma e sabe ler o mato. Combina com quem quer um animal de estimação.' },
  'Trombadinha': { pericias: 'Crime e Reflexos', poder: 'Mãos Rápidas',
    efeito: 'Furta, escapa e some no meio da multidão. Rápido e escorregadio.' },
  'Universitário': { pericias: 'Atualidades e Investigação', poder: 'Dedicação',
    efeito: 'Ainda está aprendendo, mas aprende rápido: pode se virar em perícia que não treinou. Versátil e barato de montar.' },
  'Vítima': { pericias: 'Reflexos e Vontade', poder: 'Sobrevivente',
    efeito: 'Já encontrou o paranormal e escapou. Reage melhor ao susto e resiste onde os outros congelam.' }
};

const PATENTES = ['Recruta', 'Operador', 'Agente Especial', 'Oficial de Operações', 'Agente de Elite'];

const CATEGORIAS_ITEM = ['I', 'II', 'III', 'IV'];

/* Vocabulário dos rituais, conferido nos Arquivos Secretos. O bloco impresso
   no livro é sempre: Nome / ELEMENTO Círculo / Execução / Alcance / Alvo /
   Duração / Resistência — os campos abaixo seguem essa mesma ordem. */
const ELEMENTOS = [
  { id: '',              nome: '—',             cor: '#6b6b78' },
  { id: 'sangue',        nome: 'Sangue',        cor: '#c0392b' },
  { id: 'morte',         nome: 'Morte',         cor: '#4b7f52' },
  { id: 'conhecimento',  nome: 'Conhecimento',  cor: '#c9a227' },
  { id: 'energia',       nome: 'Energia',       cor: '#8b5cf6' },
  { id: 'medo',          nome: 'Medo',          cor: '#3d6ea8' },
  { id: 'varia',         nome: 'Varia',         cor: '#8a8a96' }
];
const corDoElemento = id => (ELEMENTOS.find(e => e.id === id) || ELEMENTOS[0]).cor;

/* Custo base em PE e o NEX mínimo pra aprender cada círculo. */
const CIRCULOS = [
  { v: '',  label: '—',         pe: '',   nex: 0  },
  { v: '1', label: '1º círculo', pe: '1',  nex: 5  },
  { v: '2', label: '2º círculo', pe: '3',  nex: 45 },
  { v: '3', label: '3º círculo', pe: '6',  nex: 75 },
  { v: '4', label: '4º círculo', pe: '10', nex: 99 }
];
const circuloInfo = v => CIRCULOS.find(c => c.v === String(v || '')) || CIRCULOS[0];

const EXECUCOES   = ['', 'padrão', 'movimento', 'completa', 'livre', 'reação'];
const ALCANCES    = ['', 'pessoal', 'toque', 'curto', 'médio', 'longo', 'ilimitado'];
const DURACOES    = ['', 'instantânea', 'cena', 'sustentada', 'permanente'];
const RESISTENCIAS_RITUAL = ['', 'nenhuma', 'Fortitude', 'Reflexos', 'Vontade'];

/* Cores que o jogador escolhe ao assumir um personagem. Todas legíveis
   sobre o fundo escuro e distinguíveis entre si. */
const CORES = [
  { id: 'vermelho', nome: 'Vermelho', hex: '#e0483a' },
  { id: 'laranja',  nome: 'Laranja',  hex: '#e0872a' },
  { id: 'amarelo',  nome: 'Amarelo',  hex: '#dfc12f' },
  { id: 'verde',    nome: 'Verde',    hex: '#46b364' },
  { id: 'ciano',    nome: 'Ciano',    hex: '#2fb8c9' },
  { id: 'azul',     nome: 'Azul',     hex: '#4a7fe0' },
  { id: 'roxo',     nome: 'Roxo',     hex: '#9b6ef0' },
  { id: 'rosa',     nome: 'Rosa',     hex: '#e055a0' }
];
const hexDaCor = id => (CORES.find(c => c.id === id) || {}).hex || '';

/* PV / PE / SAN por classe: [inicial, por NEX] — inicial soma o atributo indicado */
const PROGRESSAO = {
  'Combatente':   { pv: [20, 4], pvAttr: 'VIG', pe: [2, 2], peAttr: 'PRE', san: [12, 3] },
  'Especialista': { pv: [16, 3], pvAttr: 'VIG', pe: [3, 3], peAttr: 'PRE', san: [16, 4] },
  'Ocultista':    { pv: [12, 2], pvAttr: 'VIG', pe: [4, 4], peAttr: 'PRE', san: [20, 5] },
  'Sobrevivente': { pv: [16, 3], pvAttr: 'VIG', pe: [3, 3], peAttr: 'PRE', san: [16, 4] },
  'Mundano':      { pv: [12, 2], pvAttr: 'VIG', pe: [2, 2], peAttr: 'PRE', san: [12, 3] }
};

/* O que cada classe entrega na criação — usado pelo passo a passo guiado.
   `livres` é quantas perícias treinadas a classe dá ALÉM das obrigatórias, e
   o total ainda soma Intelecto. `obrigatorias` são os pares em que o livro
   manda escolher um dos dois. */
const CLASSE_INFO = {
  'Combatente': {
    frase: 'A linha de frente. Aguenta porrada e distribui.',
    livres: 1, obrigatorias: [['Luta', 'Pontaria'], ['Fortitude', 'Reflexos']],
    proficiencias: 'Armas simples e táticas, proteções leves',
    marca: 'Ataque Especial: gasta PE pra somar +5 no ataque ou no dano.'
  },
  'Especialista': {
    frase: 'O faz-tudo. Resolve fora do combate o que os outros não resolvem.',
    livres: 7, obrigatorias: [],
    proficiencias: 'Armas simples, proteções leves',
    marca: 'Eclético (age como treinado em qualquer perícia) e Perito (+1d6 nas duas melhores).'
  },
  'Ocultista': {
    frase: 'Quem mexe com o Outro Lado. Frágil de corpo, forte de poder.',
    livres: 3, obrigatorias: [['Ocultismo', 'Vontade']],
    proficiencias: 'Armas simples',
    marca: 'Escolhido pelo Outro Lado: lança rituais desde o começo.'
  },
  'Sobrevivente': {
    frase: 'Gente comum no meio do horror. Mais frágil de propósito.',
    livres: 1, obrigatorias: [], pontos: 3,
    proficiencias: 'Armas simples',
    marca: 'Empenho: gasta 1 PE pra somar +2 em qualquer teste de perícia.',
    aviso: 'No livro o sobrevivente evolui por estágios e é bem mais frágil. Aqui ele usa a progressão por NEX desta mesa.'
  },
  'Mundano': {
    frase: 'Civil sem treinamento nenhum. Classe caseira desta mesa.',
    livres: 2, obrigatorias: [],
    proficiencias: 'Armas simples',
    marca: 'Sem habilidade de classe — o que ele tem é a origem e a cabeça.',
    aviso: 'Não é uma classe oficial de Ordem Paranormal: é uma opção criada nesta mesa.'
  }
};

/* Calcula PV/PE/SAN máximos a partir de classe, NEX e atributos */
function calcularStatus(classe, nex, attrs) {
  const p = PROGRESSAO[classe];
  if (!p) return null;
  const passos = Math.max(0, Math.floor((Number(nex || 5) - 5) / 5));
  const vig = Number(attrs?.VIG || 0);
  const pre = Number(attrs?.PRE || 0);
  return {
    pv:  (p.pv[0]  + vig) + passos * (p.pv[1]  + vig),
    pe:  (p.pe[0]  + pre) + passos * (p.pe[1]  + pre),
    san: (p.san[0]      ) + passos * (p.san[1]      )
  };
}

function slug(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/* Aliados prontos, transcritos dos livros. Aliado é o mecanismo que o sistema
   usa para bicho de estimação: fica preso ao personagem e dá bônus de perícia
   mais uma habilidade — não é uma ficha separada. */
const ALIADOS_PRONTOS = [
  {
    nome: 'Cão adestrado', tipo: 'Animal',
    descricao: 'Um cão corajoso e grande, treinado para ajudar em investigação e combate.',
    fonte: 'Sobrevivendo ao Horror, p. 42',
    bonus: [{ pericia: 'investigacao', valor: 2 }, { pericia: 'percepcao', valor: 2 }],
    habilidades: [{ nome: 'Ladrar e Morder', custo: '1 PE',
                    efeito: 'O cão assume postura defensiva ao seu redor. Você recebe +2 na Defesa por 1 rodada.' }]
  },
  {
    nome: 'Companheiro animal', tipo: 'Animal',
    descricao: 'Um bicho que cresceu com você. Escolha a perícia em que ele ajuda — o mestre aprova.',
    fonte: 'origem Amigo dos Animais',
    bonus: [{ pericia: '', valor: 2 }],
    habilidades: []
  }
];
