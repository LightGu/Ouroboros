/* Ficha completa para mesas de Dungeons & Dragons 5e. Mantida separada da
   ficha de Ordem para que cálculos e vocabulários dos sistemas não se misturem. */

const DND_ATRIBUTOS = [
  ['FOR', 'Força'], ['DES', 'Destreza'], ['CON', 'Constituição'],
  ['INT', 'Inteligência'], ['SAB', 'Sabedoria'], ['CAR', 'Carisma']
].map(([key, nome]) => ({ key, nome, sigla: key }));

const DND_PERICIAS = [
  ['Acrobacia', 'DES'], ['Arcanismo', 'INT'], ['Atletismo', 'FOR'],
  ['Atuação', 'CAR'], ['Enganação', 'CAR'], ['Furtividade', 'DES'],
  ['História', 'INT'], ['Intimidação', 'CAR'], ['Intuição', 'SAB'],
  ['Investigação', 'INT'], ['Lidar com Animais', 'SAB'], ['Medicina', 'SAB'],
  ['Natureza', 'INT'], ['Percepção', 'SAB'], ['Persuasão', 'CAR'],
  ['Prestidigitação', 'DES'], ['Religião', 'INT'], ['Sobrevivência', 'SAB']
].map(([nome, attr]) => ({ nome, attr, key: slug(nome) }));

function fichaDndVazia() {
  return {
    raca: '', classe: '', subclasse: '', nivel: 1, antecedente: '', alinhamento: '', xp: 0,
    atributos: { FOR: 10, DES: 10, CON: 10, INT: 10, SAB: 10, CAR: 10 },
    bonusProficiencia: '', inspiracao: false, ca: 10, iniciativaBonus: 0, deslocamento: 9,
    hp: { atual: 0, max: 0, temporario: 0 }, dadosVida: { atual: '', total: '', tipo: '' },
    salvaguardas: {}, pericias: {}, percepcaoPassivaBonus: 0,
    sucessosMorte: 0, falhasMorte: 0, exaustao: 0,
    ataques: [], recursos: [], equipamentos: [], magias: [],
    moedas: { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 },
    conjuracao: { atributo: '', cdBonus: 0, ataqueBonus: 0, espacos: {} },
    proficiencias: '', idiomas: '', sentidos: '', resistencias: '',
    caracteristicas: [], personalidade: '', ideais: '', vinculos: '', defeitos: '',
    aparencia: '', historia: '', aliados: '', tesouros: '', notas: ''
  };
}

function normalizarDnd(d) {
  const b = fichaDndVazia(), x = Object.assign({}, b, d || {});
  x.atributos = Object.assign({}, b.atributos, d?.atributos);
  x.hp = Object.assign({}, b.hp, d?.hp);
  x.dadosVida = Object.assign({}, b.dadosVida, d?.dadosVida);
  x.moedas = Object.assign({}, b.moedas, d?.moedas);
  x.conjuracao = Object.assign({}, b.conjuracao, d?.conjuracao);
  x.conjuracao.espacos = Object.assign({}, d?.conjuracao?.espacos);
  x.salvaguardas = Object.assign({}, d?.salvaguardas);
  x.pericias = Object.assign({}, d?.pericias);
  x.ataques = d?.ataques || [];
  x.recursos = d?.recursos || [];
  x.equipamentos = d?.equipamentos || [];
  x.magias = d?.magias || [];
  x.caracteristicas = d?.caracteristicas || [];
  return x;
}

function modificadorDnd(valor) { return Math.floor((num(valor, 10) - 10) / 2); }
function bonusProficienciaDnd(d) {
  const manual = String(d?.bonusProficiencia ?? '').trim();
  return manual === '' ? 2 + Math.floor((Math.max(1, num(d?.nivel, 1)) - 1) / 4) : num(manual);
}
function sinalDnd(n) { return n >= 0 ? '+' + n : String(n); }
function bonusTesteDnd(d, attr, estado = {}) {
  const mult = estado.expertise ? 2 : estado.proficiente ? 1 : 0;
  return modificadorDnd(d.atributos[attr]) + bonusProficienciaDnd(d) * mult + num(estado.outros);
}

const FichaDnd = {
  atual: null,

  abrir(p, contexto = {}) {
    this.atual = p;
    Ficha.atual = p;
    App.mostrar('ficha');
    Ficha.aplicarCor($('#view-ficha'), p.cor);
    $('#view-ficha').innerHTML = this.html(p);
    if (contexto.mesma) window.scrollTo(0, contexto.y || 0); else window.scrollTo(0, 0);
    this.ligar();
    if (!Store.podeEditar(p)) this.travar();
  },

  campo(caminho, rotulo, valor, tipo = 'text', extra = '') {
    return `<label class="campo"><span>${rotulo}</span><input type="${tipo}" data-dnd-bind="${caminho}" value="${esc(valor ?? '')}" ${extra}></label>`;
  },

  area(caminho, rotulo, valor, linhas = 3) {
    return `<label class="campo"><span>${rotulo}</span><textarea data-dnd-bind="${caminho}" rows="${linhas}">${esc(valor || '')}</textarea></label>`;
  },

  html(p) {
    const d = p.dnd, prof = bonusProficienciaDnd(d);
    const passiva = 10 + bonusTesteDnd(d, 'SAB', d.pericias.percepcao || {}) + num(d.percepcaoPassivaBonus);
    return `<div class="ficha ficha-dnd">
      <div class="ficha-topo">
        <button class="btn btn-ghost" data-dnd-voltar>‹ Voltar pra mesa</button>
        <span class="tag tag-dnd">D&amp;D 5e</span><div class="cresce"></div>
        ${Store.podeEditar(p) ? `<label class="campo campo-privacidade"><span>Privacidade</span><select data-dnd-raiz="fichaPrivada"><option value="true" ${p.fichaPrivada !== false ? 'selected' : ''}>Privada</option><option value="false" ${p.fichaPrivada === false ? 'selected' : ''}>Visível para a mesa</option></select></label>` : ''}
        <span class="salvo" id="indicador-salvo">salvamento automático ativo</span>
        ${Store.podeEditar(p) ? '<button class="btn btn-ghost btn-peq" data-dnd-salvar>Salvar</button>' : ''}
        <button class="btn btn-ghost btn-perigo-texto" data-dnd-excluir>Excluir personagem</button>
      </div>

      <section class="bloco bloco-identidade">
        <div class="retrato-ficha" data-dnd-imagem title="Clique para trocar a imagem">
          ${imagemPorVida(p) ? `<img src="${esc(imagemPorVida(p))}" alt="">` : `<div class="retrato-vazio" style="--h:${corDoNome(p.nome)}">${esc(iniciais(p.nome))}</div>`}
          <span class="retrato-acao">trocar imagem</span>
        </div>
        <div class="identidade-campos">
          <label class="campo campo-destaque"><span>Personagem</span><input data-dnd-raiz="nome" value="${esc(p.nome)}" placeholder="Nome do personagem"></label>
          <div class="grade-4">
            <label class="campo"><span>Jogador</span><input data-dnd-raiz="jogador" value="${esc(p.jogador)}"></label>
            ${this.campo('raca', 'Espécie / raça', d.raca)}
            ${this.campo('antecedente', 'Antecedente', d.antecedente)}
            ${this.campo('alinhamento', 'Alinhamento', d.alinhamento)}
          </div>
          <div class="grade-4">
            ${this.campo('classe', 'Classe', d.classe)}
            ${this.campo('subclasse', 'Subclasse', d.subclasse)}
            ${this.campo('nivel', 'Nível', d.nivel, 'number', 'min="1" max="20"')}
            ${this.campo('xp', 'Experiência', d.xp, 'number', 'min="0"')}
          </div>
        </div>
      </section>

      <section class="bloco">
        <h2 class="titulo-bloco">Atributos <span class="legenda">clique no modificador para rolar</span></h2>
        <div class="dnd-atributos">${DND_ATRIBUTOS.map(a => {
          const mod = modificadorDnd(d.atributos[a.key]);
          return `<div class="dnd-atributo"><b>${a.nome}</b>
            <input type="number" data-dnd-bind="atributos.${a.key}" value="${num(d.atributos[a.key], 10)}">
            <button data-dnd-rolar="${a.key}" data-dnd-rotulo="${a.nome}">${sinalDnd(mod)}</button>
            <small>${a.key}</small></div>`;
        }).join('')}</div>
      </section>

      <section class="bloco">
        <h2 class="titulo-bloco">Combate e sobrevivência</h2>
        <div class="dnd-resumo">
          <div class="dnd-num"><span>Bônus de proficiência</span><b>${sinalDnd(prof)}</b>${this.campo('bonusProficiencia', 'Ajuste manual', d.bonusProficiencia, 'number', 'placeholder="automático"')}</div>
          <div class="dnd-num"><span>Classe de Armadura</span>${this.campo('ca', 'CA', d.ca, 'number')}</div>
          <div class="dnd-num"><span>Iniciativa</span><b>${sinalDnd(modificadorDnd(d.atributos.DES) + num(d.iniciativaBonus))}</b>${this.campo('iniciativaBonus', 'Outros', d.iniciativaBonus, 'number')}</div>
          <div class="dnd-num"><span>Deslocamento</span>${this.campo('deslocamento', 'Metros', d.deslocamento, 'number', 'step="0.5"')}</div>
          <div class="dnd-num"><span>Percepção passiva</span><b>${passiva}</b>${this.campo('percepcaoPassivaBonus', 'Outros', d.percepcaoPassivaBonus, 'number')}</div>
          <label class="dnd-check"><input type="checkbox" data-dnd-bind="inspiracao" ${d.inspiracao ? 'checked' : ''}> Inspiração</label>
        </div>
        <div class="status-grade dnd-status">
          <div class="caixa-status caixa-pv"><h3>Pontos de Vida</h3><div class="grade-3">${this.campo('hp.atual','Atuais',d.hp.atual,'number')}${this.campo('hp.max','Máximo',d.hp.max,'number')}${this.campo('hp.temporario','Temporários',d.hp.temporario,'number')}</div></div>
          <div class="caixa-status"><h3>Dados de Vida</h3><div class="grade-3">${this.campo('dadosVida.atual','Atuais',d.dadosVida.atual)}${this.campo('dadosVida.total','Total',d.dadosVida.total)}${this.campo('dadosVida.tipo','Tipo',d.dadosVida.tipo,'text','placeholder="d8"')}</div></div>
          <div class="caixa-status"><h3>Testes contra a morte</h3><div class="grade-2">${this.campo('sucessosMorte','Sucessos',d.sucessosMorte,'number','min="0" max="3"')}${this.campo('falhasMorte','Falhas',d.falhasMorte,'number','min="0" max="3"')}</div></div>
          <div class="caixa-status"><h3>Condições</h3>${this.campo('exaustao','Exaustão',d.exaustao,'number','min="0" max="6"')}<p class="fraco">${esc((p.condicoes || []).join(' • ') || 'Sem condições')}</p></div>
        </div>
      </section>

      <section class="bloco dnd-testes">
        <h2 class="titulo-bloco">Salvaguardas e perícias</h2>
        <div class="dnd-duas-colunas">
          <div><h3>Salvaguardas</h3>${DND_ATRIBUTOS.map(a => this.linhaTeste(`salvaguardas.${a.key}`, a.nome, a.key, d.salvaguardas[a.key], d)).join('')}</div>
          <div><h3>Perícias</h3>${DND_PERICIAS.map(s => this.linhaTeste(`pericias.${s.key}`, s.nome, s.attr, d.pericias[s.key], d, true)).join('')}</div>
        </div>
      </section>

      ${this.listaAtaques(d)}
      ${this.listaRecursos(d)}
      ${this.blocoMagias(d)}
      ${this.blocoEquipamento(d)}

      <section class="bloco"><h2 class="titulo-bloco">Proficiências e sentidos</h2>
        <div class="grade-2">${this.area('proficiencias','Armaduras, armas, ferramentas e veículos',d.proficiencias)}${this.area('idiomas','Idiomas',d.idiomas)}${this.area('sentidos','Sentidos especiais',d.sentidos)}${this.area('resistencias','Resistências, imunidades e vulnerabilidades',d.resistencias)}</div>
      </section>

      <section class="bloco"><h2 class="titulo-bloco">Interpretação e história</h2>
        <div class="grade-2">${this.area('personalidade','Traços de personalidade',d.personalidade)}${this.area('ideais','Ideais',d.ideais)}${this.area('vinculos','Vínculos',d.vinculos)}${this.area('defeitos','Defeitos',d.defeitos)}${this.area('aparencia','Aparência',d.aparencia)}${this.area('historia','História',d.historia,5)}${this.area('aliados','Aliados e organizações',d.aliados)}${this.area('tesouros','Tesouros',d.tesouros)}${this.area('notas','Anotações',d.notas,5)}</div>
      </section>
    </div>`;
  },

  linhaTeste(caminho, nome, attr, estado, d, permiteExpertise = false) {
    const e = Object.assign({ proficiente: false, expertise: false, outros: 0 }, estado || {});
    const bonus = bonusTesteDnd(d, attr, e);
    return `<div class="dnd-teste">
      <input type="checkbox" data-dnd-bind="${caminho}.proficiente" ${e.proficiente ? 'checked' : ''} title="Proficiente">
      ${permiteExpertise ? `<input type="checkbox" data-dnd-bind="${caminho}.expertise" ${e.expertise ? 'checked' : ''} title="Especialização">` : '<span></span>'}
      <button data-dnd-teste="${caminho}" data-dnd-attr="${attr}" data-dnd-rotulo="${esc(nome)}">${sinalDnd(bonus)}</button>
      <span>${esc(nome)} <i>${attr}</i></span>
      <input type="number" data-dnd-bind="${caminho}.outros" value="${num(e.outros)}" title="Outros bônus">
    </div>`;
  },

  listaAtaques(d) {
    return `<section class="bloco"><h2 class="titulo-bloco">Ataques <button class="btn btn-ghost btn-peq" data-dnd-add="ataques">+ Ataque</button></h2>
      <div class="tabela dnd-tabela-ataques">${d.ataques.map((a,i)=>`<div class="tabela-linha">
        <input data-dnd-bind="ataques.${i}.nome" value="${esc(a.nome||'')}" placeholder="Nome">
        <input data-dnd-bind="ataques.${i}.bonus" value="${esc(a.bonus||'')}" placeholder="+5">
        <input data-dnd-bind="ataques.${i}.dano" value="${esc(a.dano||'')}" placeholder="1d8+3">
        <input data-dnd-bind="ataques.${i}.tipo" value="${esc(a.tipo||'')}" placeholder="cortante">
        <input data-dnd-bind="ataques.${i}.alcance" value="${esc(a.alcance||'')}" placeholder="alcance">
        <textarea data-dnd-bind="ataques.${i}.notas" rows="1" placeholder="propriedades">${esc(a.notas||'')}</textarea>
        <button class="btn-mini" data-dnd-dano="${i}">🎲</button><button class="btn-mini perigo" data-dnd-del="ataques:${i}">✕</button>
      </div>`).join('') || '<p class="vazio-linha">Nenhum ataque cadastrado.</p>'}</div></section>`;
  },

  listaRecursos(d) {
    return `<section class="bloco"><h2 class="titulo-bloco">Características, talentos e recursos <button class="btn btn-ghost btn-peq" data-dnd-add="recursos">+ Recurso</button></h2>
      <div class="dnd-cards">${d.recursos.map((r,i)=>`<article>${this.campo(`recursos.${i}.nome`,'Nome',r.nome)}<div class="grade-3">${this.campo(`recursos.${i}.atual`,'Usos atuais',r.atual,'number')}${this.campo(`recursos.${i}.max`,'Máximo',r.max,'number')}${this.campo(`recursos.${i}.recarga`,'Recarga',r.recarga)}</div>${this.area(`recursos.${i}.descricao`,'Descrição',r.descricao)}<button class="btn btn-ghost btn-peq" data-dnd-del="recursos:${i}">Remover</button></article>`).join('') || '<p class="vazio-linha">Adicione habilidades de classe, espécie e talentos.</p>'}</div></section>`;
  },

  blocoMagias(d) {
    const c=d.conjuracao, attr=c.atributo, mod=attr ? modificadorDnd(d.atributos[attr]) : 0, prof=bonusProficienciaDnd(d);
    const cd=8+prof+mod+num(c.cdBonus), ataque=prof+mod+num(c.ataqueBonus);
    return `<section class="bloco"><h2 class="titulo-bloco">Conjuração <button class="btn btn-ghost btn-peq" data-dnd-add="magias">+ Magia</button></h2>
      <div class="grade-4"><label class="campo"><span>Atributo de conjuração</span><select data-dnd-bind="conjuracao.atributo"><option value="">—</option>${DND_ATRIBUTOS.map(a=>`<option value="${a.key}" ${attr===a.key?'selected':''}>${a.nome}</option>`).join('')}</select></label>
        <div class="dnd-num"><span>CD para evitar magia</span><b>${cd}</b>${this.campo('conjuracao.cdBonus','Outros',c.cdBonus,'number')}</div>
        <div class="dnd-num"><span>Ataque mágico</span><b>${sinalDnd(ataque)}</b>${this.campo('conjuracao.ataqueBonus','Outros',c.ataqueBonus,'number')}</div>
        ${this.campo('conjuracao.classe','Classe conjuradora',c.classe)}</div>
      <h3 class="dnd-subtitulo">Espaços de magia</h3><div class="dnd-espacos">${Array.from({length:9},(_,i)=>i+1).map(n=>`<div><b>${n}º</b><input type="number" data-dnd-bind="conjuracao.espacos.${n}.atual" value="${num(c.espacos[n]?.atual)}" title="Atuais"><i>/</i><input type="number" data-dnd-bind="conjuracao.espacos.${n}.max" value="${num(c.espacos[n]?.max)}" title="Total"></div>`).join('')}</div>
      <div class="tabela dnd-tabela-magias">${d.magias.map((m,i)=>`<div class="tabela-linha">${this.campo(`magias.${i}.nivel`,'Nível',m.nivel,'number','min="0" max="9"')}${this.campo(`magias.${i}.nome`,'Magia',m.nome)}<label class="dnd-check"><input type="checkbox" data-dnd-bind="magias.${i}.preparada" ${m.preparada?'checked':''}> Preparada</label>${this.campo(`magias.${i}.tempo`,'Conjuração',m.tempo)}${this.campo(`magias.${i}.alcance`,'Alcance',m.alcance)}${this.campo(`magias.${i}.duracao`,'Duração',m.duracao)}${this.area(`magias.${i}.descricao`,'Efeito',m.descricao,2)}<button class="btn-mini perigo" data-dnd-del="magias:${i}">✕</button></div>`).join('') || '<p class="vazio-linha">Nenhuma magia cadastrada.</p>'}</div>
    </section>`;
  },

  blocoEquipamento(d) {
    return `<section class="bloco"><h2 class="titulo-bloco">Equipamento <button class="btn btn-ghost btn-peq" data-dnd-add="equipamentos">+ Item</button></h2>
      <div class="dnd-moedas">${Object.entries({pc:'PC',pp:'PP',pe:'PE',po:'PO',pl:'PL'}).map(([k,n])=>this.campo(`moedas.${k}`,n,d.moedas[k],'number')).join('')}</div>
      <div class="tabela dnd-tabela-itens">${d.equipamentos.map((it,i)=>`<div class="tabela-linha">${this.campo(`equipamentos.${i}.nome`,'Item',it.nome)}${this.campo(`equipamentos.${i}.quantidade`,'Qtd.',it.quantidade,'number')}${this.campo(`equipamentos.${i}.peso`,'Peso',it.peso,'number','step="0.1"')}${this.area(`equipamentos.${i}.descricao`,'Descrição',it.descricao,1)}<button class="btn-mini perigo" data-dnd-del="equipamentos:${i}">✕</button></div>`).join('') || '<p class="vazio-linha">Nenhum equipamento cadastrado.</p>'}</div>
    </section>`;
  },

  ligar() {
    const raiz=$('#view-ficha');
    raiz.oninput = e => this.alterar(e);
    raiz.onchange = e => this.alterar(e, true);
    raiz.onclick = e => this.clicar(e);
  },

  alterar(e, redesenhar=false) {
    if (!Store.podeEditar(this.atual)) return;
    const caminho=e.target.dataset.dndBind, raiz=e.target.dataset.dndRaiz;
    if (!caminho && !raiz) return;
    const valor=e.target.type==='checkbox' ? e.target.checked
      : raiz === 'fichaPrivada' ? e.target.value === 'true'
      : e.target.type==='number' ? (e.target.value === '' ? '' : num(e.target.value)) : e.target.value;
    if (raiz) this.atual[raiz]=valor; else setPath(this.atual.dnd,caminho,valor);
    if (caminho==='hp.atual') this.atual.pv.atual=valor;
    if (caminho==='hp.max') this.atual.pv.max=valor;
    Store.salvar(this.atual);
    if (redesenhar && (caminho?.startsWith('atributos.') || caminho==='nivel' || caminho==='bonusProficiencia' || caminho?.endsWith('.proficiente') || caminho?.endsWith('.expertise') || caminho==='conjuracao.atributo')) this.abrir(this.atual,{mesma:true,y:scrollY});
  },

  clicar(e) {
    const p=this.atual,d=p.dnd;
    if (e.target.closest('[data-dnd-voltar]')) return Ficha.voltar();
    if (e.target.closest('[data-dnd-salvar]')) return Ficha.salvarAgora();
    if (e.target.closest('[data-dnd-excluir]')) return Ficha.excluir();
    if (e.target.closest('[data-dnd-imagem]')) return Mesa.trocarImagem(p.id);
    const rolar=e.target.closest('[data-dnd-rolar]');
    if (rolar) return Rolagem.rolarTexto(`1d20${sinalDnd(modificadorDnd(d.atributos[rolar.dataset.dndRolar]))}`,rolar.dataset.dndRotulo,p.nome);
    const teste=e.target.closest('[data-dnd-teste]');
    if (teste) { const estado=this.obter(teste.dataset.dndTeste)||{}; const b=bonusTesteDnd(d,teste.dataset.dndAttr,estado); return Rolagem.rolarTexto(`1d20${sinalDnd(b)}`,teste.dataset.dndRotulo,p.nome); }
    const dano=e.target.closest('[data-dnd-dano]');
    if (dano) { const a=d.ataques[num(dano.dataset.dndDano)]; return a?.dano ? Rolagem.rolarTexto(a.dano,'Dano — '+(a.nome||'ataque'),p.nome) : toast('Preencha o dano primeiro.','erro'); }
    const add=e.target.closest('[data-dnd-add]');
    if (add) { const modelos={ataques:{nome:'',bonus:'',dano:'',tipo:'',alcance:'',notas:''},recursos:{nome:'',atual:0,max:0,recarga:'',descricao:''},equipamentos:{nome:'',quantidade:1,peso:'',descricao:''},magias:{nivel:0,nome:'',preparada:false,tempo:'',alcance:'',duracao:'',descricao:''}}; d[add.dataset.dndAdd].push(modelos[add.dataset.dndAdd]); Store.salvar(p); return this.abrir(p,{mesma:true,y:scrollY}); }
    const del=e.target.closest('[data-dnd-del]');
    if (del) { const [lista,i]=del.dataset.dndDel.split(':'); d[lista].splice(num(i),1); Store.salvar(p); return this.abrir(p,{mesma:true,y:scrollY}); }
  },

  obter(caminho) { return caminho.split('.').reduce((o,k)=>o?.[k],this.atual.dnd); },

  travar() {
    const raiz=$('#view-ficha');
    $$('input, select, textarea',raiz).forEach(el=>el.disabled=true);
    $$('[data-dnd-add], [data-dnd-del], [data-dnd-salvar], [data-dnd-excluir]',raiz).forEach(el=>el.remove());
    $('[data-dnd-imagem]',raiz)?.removeAttribute('data-dnd-imagem');
    $('#indicador-salvo',raiz).textContent='somente leitura';
  }
};
