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

/* Resumos conferidos nos PDFs locais; páginas impressas, não índice do PDF. */
const ORIGEM_INFO = {
  "Acadêmico": {
    "pericias": "Ciências e Investigação",
    "poder": "Saber é Poder",
    "efeito": "Em teste usando INT, 2 PE concedem +5.",
    "fonte": "Ordem Paranormal v1.1, p. 16"
  },
  "Agente de Saúde": {
    "pericias": "Intuição e Medicina",
    "poder": "Técnica Medicinal",
    "efeito": "Some seu INT aos PV que você cura em um personagem.",
    "fonte": "Ordem Paranormal v1.1, p. 16"
  },
  "Amnésico": {
    "pericias": "duas à escolha do mestre",
    "poder": "Vislumbres do Passado",
    "efeito": "Uma vez por sessão, teste INT DT 10 para reconhecer algo do passado. Sucesso concede 1d4 PE temporários e pode revelar informação do mestre.",
    "fonte": "Ordem Paranormal v1.1, p. 16"
  },
  "Artista": {
    "pericias": "Artes e Enganação",
    "poder": "Magnum Opus",
    "efeito": "Uma vez por missão, determine que alguém em uma interação reconhece sua obra: +5 em testes de PRE e perícias de PRE contra essa pessoa.",
    "fonte": "Ordem Paranormal v1.1, p. 17"
  },
  "Atleta": {
    "pericias": "Acrobacia e Atletismo",
    "poder": "110%",
    "efeito": "Em perícia usando FOR ou AGI, exceto Luta e Pontaria, gaste 2 PE para receber +5.",
    "fonte": "Ordem Paranormal v1.1, p. 17"
  },
  "Chef": {
    "pericias": "Fortitude e Profissão (cozinheiro)",
    "poder": "Ingrediente Secreto",
    "efeito": "Ao cozinhar na ação alimentar-se do interlúdio, você e aliados que comem recebem benefícios de dois pratos; benefícios repetidos acumulam.",
    "fonte": "Ordem Paranormal v1.1, p. 17"
  },
  "Criminoso": {
    "pericias": "Crime e Furtividade",
    "poder": "O Crime Compensa",
    "efeito": "Escolha um item encontrado na missão; na próxima missão ele não conta no limite de itens por patente.",
    "fonte": "Ordem Paranormal v1.1, p. 18"
  },
  "Cultista Arrependido": {
    "pericias": "Ocultismo e Religião",
    "poder": "Traços do Outro Lado",
    "efeito": "Escolha um poder paranormal. Sua Sanidade inicial é metade da normal da classe; os ganhos posteriores não são reduzidos.",
    "fonte": "Ordem Paranormal v1.1, p. 18"
  },
  "Desgarrado": {
    "pericias": "Fortitude e Sobrevivência",
    "poder": "Calejado",
    "efeito": "Receba +1 PV por patamar de 5% de NEX.",
    "fonte": "Ordem Paranormal v1.1, p. 18"
  },
  "Engenheiro": {
    "pericias": "Profissão e Tecnologia",
    "poder": "Ferramentas Favoritas",
    "efeito": "Escolha um item que não seja arma: ele conta como uma categoria abaixo para você.",
    "fonte": "Ordem Paranormal v1.1, p. 18"
  },
  "Executivo": {
    "pericias": "Diplomacia e Profissão",
    "poder": "Processo Otimizado",
    "efeito": "Gaste 2 PE para +5 em teste de perícia de um teste estendido ou na ação de revisar documentos.",
    "fonte": "Ordem Paranormal v1.1, p. 18"
  },
  "Investigador": {
    "pericias": "Investigação e Percepção",
    "poder": "Faro para Pistas",
    "efeito": "Uma vez por cena, gaste 1 PE para +5 em um teste de procurar pistas.",
    "fonte": "Ordem Paranormal v1.1, p. 19"
  },
  "Lutador": {
    "pericias": "Luta e Reflexos",
    "poder": "Mão Pesada",
    "efeito": "Some +2 ao dano de ataques corpo a corpo.",
    "fonte": "Ordem Paranormal v1.1, p. 19"
  },
  "Magnata": {
    "pericias": "Diplomacia e Pilotagem",
    "poder": "Patrocinador da Ordem",
    "efeito": "Seu limite de crédito é uma categoria acima do atual.",
    "fonte": "Ordem Paranormal v1.1, p. 20"
  },
  "Mercenário": {
    "pericias": "Iniciativa e Intimidação",
    "poder": "Posição de Combate",
    "efeito": "No primeiro turno de uma cena de ação, 2 PE concedem uma ação de movimento extra.",
    "fonte": "Ordem Paranormal v1.1, p. 20"
  },
  "Militar": {
    "pericias": "Pontaria e Tática",
    "poder": "Para Bellum",
    "efeito": "Some +2 ao dano de armas de fogo.",
    "fonte": "Ordem Paranormal v1.1, p. 20"
  },
  "Operário": {
    "pericias": "Fortitude e Profissão",
    "poder": "Ferramenta de Trabalho",
    "efeito": "Com o mestre, escolha uma arma simples ou tática ligada à profissão. Você é proficiente nela e recebe +1 em ataque, dano e margem de ameaça.",
    "fonte": "Ordem Paranormal v1.1, p. 20"
  },
  "Policial": {
    "pericias": "Percepção e Pontaria",
    "poder": "Patrulha",
    "efeito": "Receba +2 na Defesa.",
    "fonte": "Ordem Paranormal v1.1, p. 20"
  },
  "Religioso": {
    "pericias": "Religião e Vontade",
    "poder": "Acalentar",
    "efeito": "Receba +5 em Religião para acalmar. Ao acalmar alguém, essa pessoa recupera 1d6 + PRE de Sanidade.",
    "fonte": "Ordem Paranormal v1.1, p. 20"
  },
  "Servidor Público": {
    "pericias": "Intuição e Vontade",
    "poder": "Espírito Cívico",
    "efeito": "Ao testar para ajudar, gaste 1 PE para aumentar o bônus concedido em +2.",
    "fonte": "Ordem Paranormal v1.1, p. 20"
  },
  "Teórico da Conspiração": {
    "pericias": "Investigação e Ocultismo",
    "poder": "Eu Já Sabia",
    "efeito": "Receba resistência a dano mental igual ao seu INT.",
    "fonte": "Ordem Paranormal v1.1, p. 21"
  },
  "T.I.": {
    "pericias": "Investigação e Tecnologia",
    "poder": "Motor de Busca",
    "efeito": "Com internet e autorização do mestre, gaste 2 PE para substituir um teste de perícia por Tecnologia.",
    "fonte": "Ordem Paranormal v1.1, p. 21"
  },
  "Trabalhador Rural": {
    "pericias": "Adestramento e Sobrevivência",
    "poder": "Desbravador",
    "efeito": "Gaste 2 PE para +5 em Adestramento ou Sobrevivência. Terreno difícil não reduz seu deslocamento.",
    "fonte": "Ordem Paranormal v1.1, p. 21"
  },
  "Trambiqueiro": {
    "pericias": "Crime e Enganação",
    "poder": "Impostor",
    "efeito": "Uma vez por cena, 2 PE permitem substituir um teste de perícia por Enganação.",
    "fonte": "Ordem Paranormal v1.1, p. 21"
  },
  "Universitário": {
    "pericias": "Atualidades e Investigação",
    "poder": "Dedicação",
    "efeito": "Receba +1 PE inicial e mais +1 em NEX 15%, 25% e assim por diante. Seu limite de PE por turno aumenta em 1.",
    "fonte": "Ordem Paranormal v1.1, p. 21"
  },
  "Vítima": {
    "pericias": "Reflexos e Vontade",
    "poder": "Cicatrizes Psicológicas",
    "efeito": "Receba +1 SAN por patamar de 5% de NEX.",
    "fonte": "Ordem Paranormal v1.1, p. 21"
  },
  "Amigo dos Animais": {
    "pericias": "Adestramento e Percepção",
    "poder": "Companheiro Animal",
    "efeito": "Possui um animal aliado com +2 em uma perícia aprovada pelo mestre. Ele evolui em NEX 35% e 70%; perdê-lo causa perda permanente de 10 SAN e perturbação na cena.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 7"
  },
  "Astronauta": {
    "pericias": "Ciências e Fortitude",
    "poder": "Acostumado ao Extremo",
    "efeito": "Ao sofrer dano de fogo, frio ou mental, gaste 1 PE para reduzir em 5. O custo aumenta em 1 a cada repetição na cena.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 8"
  },
  "Chef do Outro Lado": {
    "pericias": "Ocultismo e Profissão (cozinheiro)",
    "poder": "Fome do Outro Lado",
    "efeito": "Cozinhe ingredientes paranormais no interlúdio para conceder resistência ou causar vulnerabilidade ao elemento. Consumir o prato perde 1 SAN permanente; veja os testes e riscos na fonte.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 8"
  },
  "Colegial": {
    "pericias": "Atualidades e Tecnologia",
    "poder": "Poder da Amizade",
    "efeito": "Escolha seu melhor amigo. Em alcance médio, podendo trocar olhares, receba +2 em perícias. A morte dele reduz PE até o fim da missão.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 9"
  },
  "Cosplayer": {
    "pericias": "Artes e Vontade",
    "poder": "Não É Fantasia, É Cosplay!",
    "efeito": "Use Artes para disfarces. Um cosplay relacionado ao teste concede +2 na perícia.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 9"
  },
  "Diplomata": {
    "pericias": "Atualidades e Diplomacia",
    "poder": "Conexões",
    "efeito": "Receba +2 em Diplomacia. Contatando um NPC capaz de ajudar, 10 minutos e 2 PE permitem substituir uma perícia relacionada ao conhecimento dele por Diplomacia até o fim da cena.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 9"
  },
  "Explorador": {
    "pericias": "Fortitude e Sobrevivência",
    "poder": "Manual do Sobrevivente",
    "efeito": "Gaste 2 PE para +5 em resistência a perigos ambientais, armadilhas e venenos. Sono precário conta como normal.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 9"
  },
  "Experimento": {
    "pericias": "Atletismo e Fortitude",
    "poder": "Mutação",
    "efeito": "Receba RD 2 e +2 em uma perícia originalmente de FOR, AGI ou VIG à escolha. Sofra –1d20 em Diplomacia.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 9"
  },
  "Fanático por Criaturas": {
    "pericias": "Investigação e Ocultismo",
    "poder": "Conhecimento Oculto",
    "efeito": "Identifique características de criaturas por pistas com Ocultismo, sem revelar sua identidade ou tipo específico. Ao passar, receba +2 em todos os testes contra a criatura até o fim da missão.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 10"
  },
  "Fotógrafo": {
    "pericias": "Artes e Percepção",
    "poder": "Através da Lente",
    "efeito": "Ao investigar, perceber ou adquirir pistas usando câmera ou fotos, gaste 2 PE para +5. Andar olhando pela lente reduz seu deslocamento à metade.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 10"
  },
  "Inventor Paranormal": {
    "pericias": "Profissão (engenheiro) e Vontade",
    "poder": "Invenção Paranormal",
    "efeito": "Escolha um ritual de 1º círculo para seu invento: categoria 0, 1 espaço. Ative com Profissão DT 15, +5 por ativação na missão; falha exige manutenção no interlúdio.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 10"
  },
  "Jovem Místico": {
    "pericias": "Ocultismo e Religião",
    "poder": "A Culpa é das Estrelas",
    "efeito": "Escolha um número da sorte de 1 a 6. No começo da cena, gaste 1 PE e role 1d6: acertar concede +2 em perícias na cena. Falhar adiciona outro número na próxima tentativa; acertar reinicia a seleção em um número.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 11"
  },
  "Legista do Turno da Noite": {
    "pericias": "Ciências e Medicina",
    "poder": "Luto Habitual",
    "efeito": "Sofra metade do dano mental de cenas ligadas à rotina de legista, a critério do mestre. Gaste 2 PE para +5 em Medicina para primeiros socorros ou necropsia.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 11"
  },
  "Mateiro": {
    "pericias": "Percepção e Sobrevivência",
    "poder": "Mapa Celeste",
    "efeito": "Vendo o céu, reconheça direções e retorne a locais conhecidos sem se perder. Gaste 2 PE para repetir Sobrevivência e escolher o melhor. Sono precário conta como normal.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 12"
  },
  "Mergulhador": {
    "pericias": "Atletismo e Fortitude",
    "poder": "Fôlego de Nadador",
    "efeito": "Receba +5 PV, prenda a respiração por 2 × VIG rodadas e nade seu deslocamento completo ao passar no teste.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 12"
  },
  "Motorista": {
    "pericias": "Pilotagem e Reflexos",
    "poder": "Mãos no Volante",
    "efeito": "Ignore penalidades de ataque por veículo em movimento. Pilotando, gaste 2 PE para +5 em Pilotagem ou resistência.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 13"
  },
  "Nerd Entusiasta": {
    "pericias": "Ciências e Tecnologia",
    "poder": "O Inteligentão",
    "efeito": "A ação ler do interlúdio concede +2d6 em vez de +1d6.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 13"
  },
  "Profetizado": {
    "pericias": "Vontade e mais uma à escolha",
    "poder": "Luta ou Fuga",
    "efeito": "Receba +2 em Vontade. Uma referência à premonição da sua morte concede 2 PE temporários até o fim da cena; combine a premonição com o mestre.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 13"
  },
  "Psicólogo": {
    "pericias": "Intuição e Profissão (psicólogo)",
    "poder": "Terapia",
    "efeito": "Use Profissão (psicólogo) como Diplomacia. Uma vez por rodada, 2 PE permitem testar Profissão e substituir uma resistência falha contra dano mental sua ou de aliado em alcance curto.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 13"
  },
  "Repórter Investigativo": {
    "pericias": "Atualidades e Investigação",
    "poder": "Encontrar a Verdade",
    "efeito": "Use Investigação para persuadir e mudar atitude. Gaste 2 PE para receber +5 em Investigação.",
    "fonte": "Sobrevivendo ao Horror v1.2, p. 13"
  }
};
const ORIGENS = Object.keys(ORIGEM_INFO).sort((a,b) => a.localeCompare(b, "pt-BR"));

/* ===========================================================
   PERSONAGENS DE IDADE VARIADA  —  regra opcional, OPRPG p. 172
   Transcrita do livro básico. Jovem (17-24) é o padrão do sistema e não
   tem modificador nenhum; as faixas adulta pra cima ganham benefício e,
   em troca, devem escolher desvantagens — é o "Peso da Idade".
   =========================================================== */

const FAIXAS_IDADE = [
  { id: 'crianca', nome: 'Criança', min: 9, max: 12, desvantagens: 0,
    resumo: 'A menor faixa etária possível. O livro não recomenda jogar abaixo de 9 anos.',
    beneficios: [
      ['Força e Vigor 0', 'Você começa com FOR 0 e VIG 0 e só pode aumentar esses atributos até 1.'],
      ['Tampinha', 'Deslocamento 6m e tamanho Pequeno: +5 em Furtividade, −5 em manobras de combate, precisa usar armas leves como armas de uma mão e armas de uma mão como armas de duas mãos, e não pode usar armas de duas mãos.'],
      ['Página em Branco', 'Você recebe apenas um benefício de origem: uma das perícias ou o poder, a sua escolha.'],
      ['Sorte de Principiante', '+2 em Defesa e +5 em todos os testes de resistência. Inimigos normalmente ignoram crianças, justamente por elas serem menos perigosas.']
    ] },
  { id: 'adolescente', nome: 'Adolescente', min: 13, max: 16, desvantagens: 0,
    resumo: 'Já tem algum conhecimento, mas ainda não está plenamente "formado".',
    beneficios: [
      ['Força 0', 'Você começa com FOR 0 e só pode aumentar esse atributo até 2.'],
      ['Anos de Formação', 'Você recebe apenas dois benefícios de origem: as duas perícias, ou uma perícia e o poder.'],
      ['Ímpeto Juvenil', '+5 pontos de esforço. Adolescentes acham que podem tudo, e essa confiança exacerbada acaba deixando-os mais heroicos.']
    ] },
  { id: 'jovem', nome: 'Jovem', min: 17, max: 24, desvantagens: 0,
    resumo: 'Idade comum para agentes recrutas. É o padrão do sistema.',
    beneficios: [] },
  { id: 'adulto', nome: 'Adulto', min: 25, max: 44, desvantagens: 1,
    resumo: 'Idade comum para agentes veteranos. Mais competentes, mas já carregam algumas marcas.',
    beneficios: [
      ['Vivência', 'Um poder de classe adicional a sua escolha. Você ainda precisa preencher os pré-requisitos do poder.']
    ] },
  { id: 'maduro', nome: 'Maduro', min: 45, max: 64, desvantagens: 2,
    nexBonus: 5,
    resumo: 'Provavelmente no auge da carreira: menos energia que os mais novos, compensada com experiência.',
    beneficios: [['NEX +5%', 'Você começa com NEX +5%.']] },
  { id: 'idoso', nome: 'Idoso', min: 65, max: 200, desvantagens: 3,
    nexBonus: 10,
    resumo: 'Poucos agentes chegam lá. Quem chega vira fonte de sabedoria para as novas gerações.',
    beneficios: [
      ['Decrepitude', 'Ao receber a habilidade Aumento de Atributo, você não pode aumentar Agilidade, Força ou Vigor. Seu auge físico já ficou para trás.'],
      ['NEX +10%', 'Você começa com NEX +10%.']
    ] }
];

/* Idade fora de qualquer faixa (abaixo de 9) devolve null de propósito: o
   livro não cobre esse caso e inventar faixa seria pior do que não mostrar. */
function faixaDaIdade(anos) {
  const n = Number(anos);
  if (!n || n < 9) return null;
  return FAIXAS_IDADE.find(f => n >= f.min && n <= f.max) || null;
}

/* As 15 desvantagens do "Peso da Idade". `pvPorNex` e `pePorNex` só existem
   nas duas que mexem em número que a ficha já calcula sozinha — o resto é
   efeito de mesa e fica como texto. */
const DESVANTAGENS_IDADE = [
  { id: 'catarata', nome: 'Catarata',
    efeito: 'Seus olhos já não são os mesmos. Você sofre −5 em testes de Percepção e Pontaria.' },
  { id: 'definhamento', nome: 'Definhamento',
    efeito: 'A idade roubou seu peso. Você sofre −5 em testes de Fortitude e de manobras de combate.' },
  { id: 'devagar', nome: '“Devagar, Jovem!”',
    efeito: 'Você já não anda no mesmo ritmo. Seu deslocamento é reduzido em −3m e você não pode fazer investidas.' },
  { id: 'distraido', nome: 'Distraído',
    efeito: 'Você fica surpreendido na primeira rodada de qualquer cena de ação e perde seu primeiro turno em qualquer cena de investigação.' },
  { id: 'fragil', nome: 'Frágil', pvPorNex: 2,
    efeito: 'Sua vitalidade se foi. Você perde 2 PV por NEX.' },
  { id: 'gota', nome: 'Gota',
    efeito: 'Sempre que faz um teste de Agilidade ou baseado em Agilidade, ou escolhe a ação esquiva, você sofre 1d6 pontos de dano.' },
  { id: 'juntas', nome: 'Juntas Duras',
    efeito: 'Suas articulações doem. Você sofre −5 em testes de Acrobacia e Reflexos.' },
  { id: 'melancolico', nome: 'Melancólico', pePorNex: 1,
    efeito: 'O mundo já não tem mais cor. Você perde 1 PE por NEX.' },
  { id: 'nomeutempo', nome: '“No Meu Tempo”',
    efeito: 'Preso a visões idealizadas de um passado que nunca ocorreu, você se torna presa fácil para manipulação. Sofre −5 em testes de Intuição e Vontade.' },
  { id: 'pulmao', nome: 'Pulmão Ruim',
    efeito: 'Sempre que faz um teste de Força ou baseado em Força, você sofre 1d6 pontos de dano. Além disso, só prende a respiração por um número de rodadas igual a seu Vigor, e sempre que faz uma investida fica fatigado até o fim da cena.' },
  { id: 'rabugento', nome: 'Rabugento',
    efeito: 'Você é duro de aguentar. Sofre −5 em testes de Presença e de perícias baseadas em Presença, com exceção de Intimidação.' },
  { id: 'recurvado', nome: 'Recurvado',
    efeito: 'A idade dobrou suas costas. Você é considerado Pequeno (veja “Tampinha”), mas não recebe o bônus de Furtividade.' },
  { id: 'sonoruim', nome: 'Sono Ruim',
    efeito: 'Sua condição de descanso é sempre uma categoria pior. Condições normais contam como ruins; se já era ruim, você não recupera nenhum PV nem PE.' },
  { id: 'teimoso', nome: 'Teimoso',
    efeito: 'Você faz as coisas sempre do seu jeito. Não pode receber nem fornecer bônus por ajuda.' },
  { id: 'tosse', nome: 'Tosse',
    efeito: 'Em cenas de ação e investigação, role 1d6 no início de cada rodada: num 1, você tem uma crise de tosse e perde o turno. Em cenas de interpretação, role 1d6 sempre que fizer teste de perícia baseada em Presença: num 1, sofre −5 no teste.' }
];

/* Quanto a idade tira de PV e PE. "Por NEX" é por nível de NEX, e em NEX 5%
   você já tem o primeiro — daí o `passos + 1`. */
function ajusteIdade(p) {
  const niveis = Number(p?.nex) === 99 ? 20 : Math.max(1, Math.floor(Number(p?.nex || 5) / 5));
  return (p?.desvantagensIdade || []).reduce((acc, id) => {
    const d = DESVANTAGENS_IDADE.find(x => x.id === id);
    if (d?.pvPorNex) acc.pv -= d.pvPorNex * niveis;
    if (d?.pePorNex) acc.pe -= d.pePorNex * niveis;
    return acc;
  }, { pv: 0, pe: 0 });
}

const PATENTES = ['Recruta', 'Operador', 'Agente Especial', 'Oficial de Operações', 'Agente de Elite'];

const CATEGORIAS_ITEM = ['I', 'II', 'III', 'IV'];
const TIPOS_ITEM = ['Arma', 'Munição', 'Explosivo', 'Proteção', 'Medicamento', 'Equipamento', 'Itens paranormais', 'Catalisadores', 'Amaldiçoado'];

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
  { v: '2', label: '2º círculo', pe: '3',  nex: 25 },
  { v: '3', label: '3º círculo', pe: '6',  nex: 55 },
  { v: '4', label: '4º círculo', pe: '10', nex: 85 }
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
  'Sobrevivente': { pv: [8, 2], pvAttr: 'VIG', pe: [2, 1], peAttr: 'PRE', san: [8, 2] },
  'Mundano':      { pv: [8, 0], pvAttr: 'VIG', pe: [1, 0], peAttr: 'PRE', san: [8, 0] }
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
    livres: 3, obrigatorias: [['Ocultismo'], ['Vontade']],
    proficiencias: 'Armas simples',
    marca: 'Escolhido pelo Outro Lado: lança rituais desde o começo.'
  },
  'Sobrevivente': {
    frase: 'Gente comum no meio do horror. Mais frágil de propósito.',
    livres: 1, obrigatorias: [], pontos: 3,
    proficiencias: 'Armas simples',
    marca: 'Empenho: gasta 1 PE pra somar +2 em qualquer teste de perícia.',
    aviso: 'NEX 0%, estágios de 1 a 5. Ganha +2 PV, +1 PE e +2 SAN por estágio; não usa patentes.'
  },
  'Mundano': {
    frase: 'Civil de NEX 0%. Consulte a regra opcional do livro básico.',
    livres: 1, obrigatorias: [], pontos: 3,
    proficiencias: 'Armas simples',
    marca: 'Empenho: 1 PE concede +2 em um teste de perícia.',
    aviso: 'Regra opcional do básico, p. 171–172. NEX 0%; ao se tornar agente, requer treinamento. Não evolui por estágios.'
  }
};

/* Calcula PV/PE/SAN máximos a partir de classe, NEX e atributos */
function calcularStatus(classe, nex, attrs, estagio = 1) {
  const p = PROGRESSAO[classe];
  if (!p) return null;
  const passos = Math.max(0, (Number(nex) === 99 ? 20 : Math.floor(Number(nex || 5) / 5)) - 1);
  const vig = Number(attrs?.VIG || 0);
  const pre = Number(attrs?.PRE || 0);
  if (classe === 'Mundano') return { pv: 8 + vig, pe: 1 + pre, san: 8 };
  if (classe === 'Sobrevivente') {
    const etapas = Math.max(0, Math.min(4, Math.floor(Number(estagio) || 1) - 1));
    return { pv: 8 + vig + 2 * etapas, pe: 2 + pre + etapas, san: 8 + 2 * etapas };
  }
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
