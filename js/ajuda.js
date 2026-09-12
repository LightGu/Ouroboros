/* Dicas de regra da ficha: o texto que aparece ao passar o mouse.

   Duas partes aqui: o dicionário `AJUDA`, que é só conteúdo, e o objeto
   `Dica`, que é uma tooltip própria. Não dá pra usar o `title` nativo pra
   isso: ele demora quase um segundo pra abrir, não quebra linha e some
   sozinho depois de uns segundos — ruim justamente pros textos mais longos,
   que são os que a pessoa precisa ler com calma. */

const COMO_ROLA = 'Você rola um d20 por ponto do atributo e fica com o melhor. Atributo 0 rola 2d20 e fica com o pior.';

const AJUDA = {

  atributos: {
    AGI: 'Agilidade — velocidade, equilíbrio e reflexo. Base de Pontaria, Reflexos, Furtividade, Iniciativa, Acrobacia, Crime e Pilotagem. Também entra na Defesa (10 + AGI).',
    FOR: 'Força — músculo e potência. Base de Luta e Atletismo, e soma no dano dos golpes corpo a corpo.',
    INT: 'Intelecto — raciocínio, estudo e memória. Base das perícias de conhecimento e é o que define quantas perícias treinadas a sua classe te dá.',
    PRE: 'Presença — carisma, atenção e firmeza. Base de Percepção, Intuição, Vontade, Diplomacia, Enganação, Intimidação, Artes, Adestramento e Religião. Também entra nos Pontos de Esforço.',
    VIG: 'Vigor — saúde e fôlego. Base de Fortitude e é o que engorda os Pontos de Vida a cada NEX.'
  },

  /* uma linha por perícia: o que ela resolve na mesa */
  pericias: {
    'Acrobacia':     'Equilíbrio, quedas e contorção: atravessar espaço apertado, cair sem se machucar, levantar sem gastar ação.',
    'Adestramento':  'Lidar com bicho: acalmar, montar, mandar o animal fazer alguma coisa. Só treinada.',
    'Artes':         'Tocar, atuar, desenhar, escrever — e também falsificar uma obra ou fazer um bico com isso. Só treinada.',
    'Atletismo':     'Correr, escalar, saltar, nadar e forçar passagem. A perícia das perseguições e das fugas.',
    'Atualidades':   'O que rola no mundo: notícia, política, cultura, marca, quem é quem. Saber de cabeça o nome daquela empresa.',
    'Ciências':      'Química, biologia, física: analisar substância, entender um experimento, ler um laudo. Só treinada.',
    'Crime':         'Arrombar fechadura, bater carteira, sabotar, se virar no mundo do crime. Só treinada.',
    'Diplomacia':    'Convencer na conversa honesta: negociar, pedir favor, acalmar os ânimos, conseguir uma autorização.',
    'Enganação':     'Mentir, blefar, disfarçar — e fintar no combate pra pegar o inimigo desprevenido.',
    'Fortitude':     'Aguentar o corpo: veneno, doença, cansaço, frio, sufocamento e dano massivo.',
    'Furtividade':   'Se esconder, andar sem fazer barulho e seguir alguém sem ser notado.',
    'Iniciativa':    'Define a ordem dos turnos quando a briga começa. Rola uma vez, no início da cena.',
    'Intimidação':   'Assustar, ameaçar, encarar. Faz o outro recuar, entregar o ouro ou falar o que sabe.',
    'Intuição':      'Sentir que tem algo errado: perceber mentira, ler intenção, avaliar quem está na sua frente.',
    'Investigação':  'Procurar pista, vasculhar cena, cruzar informação e pesquisar arquivo. O motor das missões.',
    'Luta':          'Ataques corpo a corpo. Qualquer um pode usar sem treino — treinar só soma +5 no teste.',
    'Medicina':      'Primeiros socorros, estabilizar quem está morrendo, tratar doença e veneno, fazer necropsia.',
    'Ocultismo':     'O Outro Lado: rituais, símbolos, reconhecer criatura e elemento. A perícia do ocultista. Só treinada.',
    'Percepção':     'Notar o que está ali: ouvir passo, achar objeto escondido, reparar no detalhe fora do lugar.',
    'Pilotagem':     'Dirigir e pilotar sob pressão: perseguição, manobra arriscada, terreno ruim. Só treinada.',
    'Pontaria':      'Ataques à distância: arma de fogo, arco, arremesso. Também dá pra usar sem treino.',
    'Profissão':     'O seu ofício — escolha qual. Serve pro trabalho em si e pra ganhar dinheiro entre missões. Só treinada.',
    'Reflexos':      'Desviar na hora: explosão, armadilha, efeito em área. É a defesa contra o que pega todo mundo.',
    'Religião':      'Fé, rito, símbolo sagrado e como circular entre quem acredita. Só treinada.',
    'Sobrevivência': 'Rastrear, se orientar, achar abrigo, água e comida longe da cidade.',
    'Tática':        'Ler o campo, montar plano e coordenar o grupo — vira bônus pros aliados. Só treinada.',
    'Tecnologia':    'Computador, rede e eletrônica: hackear, consertar, arrombar sistema, recuperar arquivo. Só treinada.',
    'Vontade':       'Segurar a mente: medo, efeito mental e a pressão do paranormal. É o teste que mais salva personagem em Ordem.'
  },

  campos: {
    origem:     'De onde o personagem veio antes da Ordem. A origem dá duas perícias treinadas e um poder.',
    classe:     'Define PV, PE e Sanidade por NEX, quantas perícias você treina, as proficiências e as habilidades que ganha.',
    nex:        'Nível de Exposição: o "nível" do agente, de 5% a 99%. Sobe de 5 em 5 e é o que aumenta PV, PE e Sanidade.',
    desl:       'Quantos metros você percorre com uma ação de movimento. O padrão de uma pessoa é 9m.',
    peRodada:   'Teto de PE que dá pra gastar em uma única rodada. Sobe conforme o NEX.',
    patente:    'Seu cargo dentro da Ordem. É ela que define o limite de itens de cada categoria e o seu crédito.',
    pv:         'Pontos de Vida. Na metade você fica machucado; em 0, está morrendo.',
    pe:         'Pontos de Esforço: o combustível das habilidades e dos rituais. Recupera no interlúdio.',
    san:        'Sanidade. Cai no contato com o paranormal. Zerada, o personagem enlouquece de vez e sai do controle do jogador.',
    defesa:     'O número que o inimigo precisa alcançar no teste de ataque pra te acertar.',
    defEquip:   'O bônus da sua proteção (colete, capacete). Some aqui o que a vestimenta dá de Defesa.',
    defOutros:  'Bônus avulsos de Defesa: poder, ritual, cobertura fixa, condição.',
    protecao:   'A vestimenta que você está usando. Sem proficiência com ela, você leva penalidade.',
    resistencias: 'Redução fixa por tipo de dano. "Balístico 5" tira 5 de cada tiro que te acerta.',

    treino:     'Grau de treinamento: Destreinado +0 · Treinado +5 · Veterano +10 · Expert +15.',
    outros:     'Bônus avulsos nessa perícia: item, poder, condição, bônus do mestre.',
    formula:    'Como o teste sai na mesa: quantos d20 você rola (pelo atributo) e quanto soma no resultado.',

    limiteItem: 'Quantos itens dessa categoria a sua patente deixa você carregar.',
    credito:    'O quanto a Ordem libera você requisitar sem precisar justificar. Vem da patente.',
    cargaMax:   'Total de espaços que você aguenta carregar. Passando disso, você fica sobrecarregado.',
    prestigio:  'Pontos ganhos por missão bem resolvida. Gasta entre missões por favor, equipamento e apoio.',

    dtRituais:  'A DT dos rituais que você conjura: quanto o alvo precisa tirar pra resistir.',
    ataqueNome: 'O nome da arma ou do golpe, do jeito que você quer ver no card da mesa.',
    ataqueTeste:'Qual perícia rola pra acertar: Luta no corpo a corpo, Pontaria à distância.',
    ataqueDano: 'Os dados de dano quando acerta. Ex.: 1d12 de uma pistola, 2d6+FOR de uma facada.',
    ataqueEspecial: 'Margem de crítico, alcance e tipo de dano. Ex.: "18/x2, curto, balístico".',
    municao:    'Controle de balas: o card da mesa mostra o que ainda resta no pente.',
    aliado:     'Bicho, contato ou parceiro preso ao personagem. O bônus dele entra sozinho na rolagem da perícia.',
    habilidade: 'Poderes de classe, de origem e de trilha. Ritual tem bloco próprio, logo abaixo.',
    ritual:     'O que você conjura gastando PE. O círculo define o custo base e o NEX mínimo: 1º a partir de 5%, 2º de 45%, 3º de 75%, 4º de 99%.',
    ritualElemento: 'A qual dos Elementos o ritual pertence. É ele que decide contra o que o alvo resiste e o que conta como afinidade.',
    ritualCirculo:  'Quanto mais fundo, mais caro: 1º custa 1 PE, 2º custa 3, 3º custa 6 e 4º custa 10.',
    ritualAlvo:     'Quem ou o que o ritual pega: "1 ser", "esfera de 6m de raio", "1 superfície".',
    ritualResist:   'Que teste o alvo faz pra escapar, e o que ele consegue com isso. Ex.: "Vontade evita", "Reflexos reduz à metade".',
    aparencia:  'Como ele é de olhar: rosto, roupa, marca, o detalhe que os outros lembram.',
    personalidade: 'Como ele age e fala. Serve de lembrete na hora de interpretar.',
    historico:  'De onde ele veio e o que o trouxe até a Ordem.',
    objetivo:   'O que ele quer. É daqui que saem os ganchos de missão.'
  }
};

/* Devolve o atributo pronto pra colar no HTML: dica('texto') → data-ajuda="...".
   Devolve string vazia se não houver texto, pra nunca sujar o markup. */
function dica(texto) {
  return texto ? ` data-ajuda="${esc(texto)}"` : '';
}

/* ---------------- a tooltip em si ---------------- */

const Dica = {
  el: null,
  alvo: null,

  caixa() {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'dica-flutuante';
      this.el.setAttribute('role', 'tooltip');
      this.el.hidden = true;
      document.body.appendChild(this.el);
    }
    return this.el;
  },

  mostrar(alvo) {
    const texto = alvo?.dataset?.ajuda;
    if (!texto) return this.esconder();
    if (this.alvo === alvo) return;

    this.alvo = alvo;
    const cx = this.caixa();
    cx.textContent = texto;
    cx.hidden = false;
    this.posicionar(alvo, cx);
  },

  /* Acima do elemento por padrão; se não couber, vai pra baixo. O x é preso
     na janela pra dica de campo da beirada não vazar pra fora da tela. */
  posicionar(alvo, cx) {
    const r = alvo.getBoundingClientRect();
    const c = cx.getBoundingClientRect();
    const margem = 8;

    let topo = r.top - c.height - margem;
    if (topo < margem) topo = r.bottom + margem;
    if (topo + c.height > window.innerHeight - margem) {
      topo = Math.max(margem, window.innerHeight - c.height - margem);
    }

    let esq = r.left + r.width / 2 - c.width / 2;
    esq = Math.max(margem, Math.min(esq, window.innerWidth - c.width - margem));

    cx.style.left = Math.round(esq) + 'px';
    cx.style.top  = Math.round(topo) + 'px';
  },

  esconder() {
    this.alvo = null;
    if (this.el) this.el.hidden = true;
  }
};

/* Mouse abre e fecha. O focusin cobre dois casos de graça: quem navega por
   Tab e quem está no celular, onde tocar o campo já dá foco — sem hover,
   não haveria como ler a dica. */
document.addEventListener('pointerover', e => {
  const alvo = e.target.closest?.('[data-ajuda]');
  if (alvo) Dica.mostrar(alvo);
  else if (Dica.alvo && !Dica.alvo.contains(e.target)) Dica.esconder();
});

document.addEventListener('pointerdown', () => Dica.esconder());
document.addEventListener('focusin',  e => { const a = e.target.closest?.('[data-ajuda]'); if (a) Dica.mostrar(a); });
document.addEventListener('focusout', () => Dica.esconder());
document.addEventListener('scroll',   () => Dica.esconder(), true);
document.addEventListener('keydown',  e => { if (e.key === 'Escape') Dica.esconder(); });
window.addEventListener('blur',       () => Dica.esconder());
