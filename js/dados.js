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

const PATENTES = ['Recruta', 'Operador', 'Agente Especial', 'Oficial de Operações', 'Agente de Elite'];

const CATEGORIAS_ITEM = ['I', 'II', 'III', 'IV'];

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
