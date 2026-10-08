/* Regras de criação conferidas no básico v1.1 e Sobrevivendo ao Horror v1.2.
   Resumos autorais, com referência de página impressa. */
const Regras = {
  civil: p => ['Sobrevivente', 'Mundano'].includes(p.classe),
  nivel: nex => Number(nex) === 99 ? 20 : Math.max(0, Math.floor(num(nex) / 5)),
  dtRituaisBase(p) { return 10 + this.nivel(p.nex) + num(p.atributos?.PRE); },
  dtRituais(p) { return this.dtRituaisBase(p) + num(p.dtRituaisBonus); },
  patentes: {
    'Recruta': [2,0,0,0,'Baixo'], 'Operador': [3,1,0,0,'Médio'],
    'Agente Especial': [3,2,1,0,'Médio'], 'Oficial de Operações': [3,3,2,1,'Alto'],
    'Agente de Elite': [3,3,3,2,'Ilimitado']
  },
  trilhas: {
    Combatente: [
      ['Aniquilador','Especializa-se em uma arma favorita.','Básico, p. 26'],
      ['Comandante de Campo','Coordena e ajuda os aliados.','Básico, p. 26'],
      ['Guerreiro','Foco em combate corpo a corpo.','Básico, p. 27'],
      ['Operações Especiais','Velocidade e ações em combate.','Básico, p. 27'],
      ['Tropa de Choque','Resiste a dano e protege o grupo.','Básico, p. 27'],
      ['Agente Secreto','Infiltração social e recursos de agência.','Horror, p. 15'],
      ['Caçador','Rastreia e prepara a caçada.','Horror, p. 16'],
      ['Monstruoso','Transformações ligadas a um elemento.','Horror, p. 17–20']
    ],
    Especialista: [
      ['Atirador de Elite','Ataques à distância.','Básico, p. 30'],
      ['Infiltrador','Furtividade e ataques oportunos.','Básico, p. 30'],
      ['Médico de Campo','Tratamento de feridos em missão.','Básico, p. 31'],
      ['Negociador','Interações e apoio à equipe.','Básico, p. 31'],
      ['Técnico','Equipamentos e ferramentas.','Básico, p. 31'],
      ['Bibliotecário','Pesquisa e conhecimento.','Horror, p. 23'],
      ['Perseverante','Improvisação e resistência para escapar.','Horror, p. 24'],
      ['Muambeiro','Ofício, fabricação e capacidade de carga.','Horror, p. 25']
    ],
    Ocultista: [
      ['Conduíte','Amplia a conjuração de rituais.','Básico, p. 34'],
      ['Flagelador','Usa o próprio corpo como recurso.','Básico, p. 34'],
      ['Graduado','Expande seu repertório de rituais.','Básico, p. 34'],
      ['Intuitivo','Resistência à influência paranormal.','Básico, p. 35'],
      ['Lâmina Paranormal','Combina combate e rituais.','Básico, p. 35'],
      ['Exorcista','Enfrenta manifestações paranormais.','Horror, p. 27'],
      ['Possuído','Poderes ligados à entidade que o habita.','Horror, p. 28'],
      ['Parapsicólogo','Cuida da mente com conhecimento paranormal.','Horror, p. 29']
    ],
    Sobrevivente: [
      ['Durão','Estágio 2: +4 PV; estágio 3: mais +2 PV. Estágio 4: 1 PE concede +1d20 em um ataque.','Horror, p. 31'],
      ['Esperto','Estágio 2: treine uma perícia adicional. Estágio 4: escolha duas treinadas, exceto Luta/Pontaria; 1 PE concede +1d4 nesses testes.','Horror, p. 32'],
      ['Esotérico','Estágio 2: ação padrão e 1 PE para sentir o paranormal em alcance curto. Estágio 4: aprenda um ritual de 1º círculo.','Horror, p. 32']
    ]
  },
  origemFixas(origem) {
    const texto = ORIGEM_INFO[origem]?.pericias || '';
    return PERICIAS.filter(p => texto.split(' e ').some(t => t === p.nome || t.startsWith(p.nome + ' ('))).map(p=>p.key);
  },
  obrigatorias(classe) { return CLASSE_INFO[classe]?.obrigatorias || []; },
  limitePE(p) { return (this.civil(p) ? 1 : Math.max(1,this.nivel(p.nex))) + (p.origem === 'Universitário' ? 1 : 0); },
  status(p) {
    const attrs = p.atributos || p.attrs;
    const r = calcularStatus(p.classe, p.nex, attrs, p.estagio);
    if (!r) return null;
    const nivel = this.nivel(p.nex);
    if (p.origem === 'Desgarrado') r.pv += nivel;
    if (p.origem === 'Vítima') r.san += nivel;
    if (p.origem === 'Universitário') r.pe += Math.max(1,Math.ceil(nivel/2));
    if (p.origem === 'Mergulhador') r.pv += 5;
    if (p.origem === 'Cultista Arrependido') r.san -= Math.ceil(PROGRESSAO[p.classe].san[0]/2);
    if (p.classe === 'Sobrevivente' && p.trilha === 'Durão' && num(p.estagio,1) >= 2) r.pv += num(p.estagio) >= 3 ? 6 : 4;
    const aj = ajusteIdade(p); r.pv = Math.max(1,r.pv + aj.pv); r.pe = Math.max(0,r.pe + aj.pe);
    return r;
  },
  equipamento(p) {
    const t = this.civil(p) ? [1,0,0,0,'Não usa patente'] : this.patentes[p.patente];
    if (!t) return null;
    let credito=t[4];
    if (p.origem === 'Magnata' && !this.civil(p)) { const c=['Baixo','Médio','Alto','Ilimitado']; credito=c[Math.min(3,c.indexOf(credito)+1)]; }
    const forca=num((p.atributos || p.attrs)?.FOR);
    return { limites: Object.fromEntries(CATEGORIAS_ITEM.map((c,i)=>[c,t[i]])), credito, cargaMax: forca === 0 ? 2 : forca*5 };
  },
  habilidadesIniciais(p) {
    const o=ORIGEM_INFO[p.origem];
    const lista=o ? [{nome:o.poder,custo:'',pagina:o.fonte,desc:o.efeito}] : [];
    const add=(nome,custo,desc,pagina)=>lista.push({nome,custo,desc,pagina});
    if (p.classe==='Combatente') add('Ataque Especial','2 PE','Ao atacar, receba +5 no teste ou no dano; pode dividir o bônus entre ambos. Evolui com NEX.','Básico, p. 24');
    if (p.classe==='Especialista') {
      add('Eclético','2 PE','Em um teste de perícia, receba os benefícios de treinamento.','Básico, p. 28');
      add('Perito','2 PE',`Some +1d6 em testes destas duas perícias treinadas (exceto Luta/Pontaria): ${(p.perito || []).map(k=>PERICIAS.find(x=>x.key===k)?.nome).join(', ')}. O dado e custo evoluem com NEX.`,'Básico, p. 28');
    }
    if (p.classe==='Ocultista') add('Escolhido pelo Outro Lado','Conforme ritual','Começa com três rituais de 1º círculo e aprende um por avanço de NEX. Libera 2º/3º/4º círculo em NEX 25%/55%/85%.','Básico, p. 32');
    if (this.civil(p)) add('Empenho','1 PE','Em um teste de perícia, receba +2.',p.classe==='Mundano'?'Básico, p. 172':'Horror, p. 31');
    if (p.escolhaOrigem) add('Escolha de origem','',p.escolhaOrigem,o?.fonte || 'Personalizada');
    return lista;
  },
  pendencias(p) {
    const avisos=[];
    if (!p.origem) avisos.push('Escolha a origem: ela dá perícias e um poder.');
    else if (!ORIGEM_INFO[p.origem]) avisos.push('Origem personalizada: confira as duas perícias e o poder com o mestre.');
    if (!CLASSE_INFO[p.classe]) avisos.push('Escolha a classe para consultar suas regras.');
    const treinadas=PERICIAS.filter(x=>num(p.pericias?.[x.key]?.treino)>0).map(x=>x.key);
    const info=CLASSE_INFO[p.classe];
    if(info) {
      const esperado=info.livres + num(p.atributos?.INT) + info.obrigatorias.length + 2 + (p.classe==='Sobrevivente'&&p.trilha==='Esperto'&&num(p.estagio)>=2?1:0);
      if(treinadas.length<esperado) avisos.push(`Pelo padrão de origem e classe, faltam ${esperado-treinadas.length} perícias treinadas. Confira exceções de idade e campanha.`);
    }
    if(!this.civil(p)) {
      const aumentos=[20,50,80,95].filter(n=>num(p.nex)>=n).length;
      if(aumentos && ATRIBUTOS.reduce((n,a)=>n+num(p.atributos?.[a.key]),0)<9+aumentos) avisos.push(`Neste NEX há ${aumentos} aumentos de atributo além da criação; distribua as escolhas pendentes.`);
      if(num(p.nex)>=15) avisos.push(`Confira os ${Math.floor(num(p.nex)/15)} poderes de classe adquiridos por progressão, seus pré-requisitos e as habilidades de trilha. Transcender pode substituir um poder e altera ganhos de SAN.`);
    }
    const maxTreino=num(p.nex)>=70?15:num(p.nex)>=35?10:5;
    if(PERICIAS.some(x=>num(p.pericias?.[x.key]?.treino)>maxTreino)) avisos.push('Há treinamento acima do patamar padrão deste NEX. Confira a habilidade que autoriza a exceção.');
    this.origemFixas(p.origem).forEach(k=>{ if(!treinadas.includes(k)) avisos.push(`Origem: falta treinar ${PERICIAS.find(x=>x.key===k).nome}.`); });
    this.obrigatorias(p.classe).forEach(par=>{if(!par.some(n=>treinadas.includes(slug(n)))) avisos.push(`Classe: treine ${par.join(' ou ')}.`);});
    if (p.classe==='Ocultista') {
      const esperado=2+Math.max(1,this.nivel(p.nex));
      if ((p.rituais || []).filter(r=>r.nome?.trim()).length<esperado) avisos.push(`Escolhido pelo Outro Lado: registre ${esperado} rituais no total neste NEX; confira escolhas extras de poderes/trilha.`);
    }
    if (p.classe==='Especialista' && ((p.perito || []).length!==2 || (p.perito || []).some(k=>!treinadas.includes(k)||['luta','pontaria'].includes(k)))) avisos.push('Perito: registre as duas perícias treinadas, exceto Luta e Pontaria, na habilidade.');
    const precisaTrilha=p.classe==='Sobrevivente'?num(p.estagio,1)>=2:!this.civil(p)&&num(p.nex)>=10;
    if (precisaTrilha && !p.trilha) avisos.push('Escolha sua trilha e registre as habilidades do patamar atual.');
    const origem=ORIGEM_INFO[p.origem];
    if (origem && !(p.habilidades || []).some(h=>h.nome===origem.poder)) avisos.push(`Registre o poder de origem ${origem.poder}. Seus efeitos condicionais são aplicados durante o jogo.`);
    if (!(p.inventario?.itens || []).length) avisos.push('Escolha seu equipamento no catálogo do Inventário; registre os ataques das armas.');
    const eq=this.equipamento(p);
    if (eq) {
      const itens=p.inventario?.itens || [], carga=itens.reduce((n,i)=>n+num(i.espacos),0);
      const limite=num(p.inventario?.cargaMax,eq.cargaMax);
      if(carga>limite) avisos.push(carga>2*limite?'Carga acima do dobro da capacidade: remova itens.':'Sobrecarregado: –5 Defesa e perícias afetadas por carga; –3 m de deslocamento.');
      CATEGORIAS_ITEM.forEach(c=>{ const max=num(p.inventario?.limites?.[c],eq.limites[c]); if(itens.filter(i=>i.categoria===c).length>max) avisos.push(`Itens de categoria ${c} acima do limite ${max}. Confira reduções de categoria por poderes.`); });
    }
    if (this.civil(p) && num(p.nex)!==0) avisos.push('Mundano e Sobrevivente usam NEX 0%. A passagem para agente requer treinamento e ajustes próprios.');
    if (p.classe==='Sobrevivente' && !p.estagio) avisos.push('Ficha antiga de Sobrevivente: selecione o estágio antes de recalcular; seus valores salvos foram preservados.');
    return avisos;
  },
  guia(p) {
    const o=ORIGEM_INFO[p.origem];
    const avisos=this.pendencias(p);
    return `<section class="bloco guia-ficha"><h2 class="titulo-bloco">Guia do personagem <span class="legenda">Leia no seu ritmo • dicas também ao focar os campos</span></h2>
      <div class="guia-grade"><div><b>Como fazer um teste</b><p>O mestre pede uma perícia e uma dificuldade (DT). Role tantos d20 quanto o atributo, escolha o maior e some treino e outros bônus. Com atributo 0, role dois e escolha o menor. Ex.: AGI 2 e Pontaria treinada = maior de 2d20 + 5.</p>
      <details><summary>PV, PE, Sanidade e Defesa</summary><p>PV é sua saúde. PE paga habilidades. SAN representa estabilidade mental. Em SAN 0, você fica enlouquecendo e ainda pode ser ajudado; não perde o personagem imediatamente. Defesa é a dificuldade para acertarem você.</p><p>O limite de PE é por turno e permite usar ao menos uma habilidade no custo mínimo. Bloqueio usa Fortitude treinada para reduzir dano; esquiva soma Reflexos treinado à Defesa contra o ataque. São reações especiais, com limite de uma por rodada.</p></details>
      <details><summary>Origem e classe</summary><p>${o ? `<b>${esc(o.poder)}:</b> ${esc(o.efeito)}<br><small>${esc(o.fonte)}</small>` : 'Escolha uma origem na identidade.'}</p><p>Proficiências: ${esc([p.proficiencias || CLASSE_INFO[p.classe]?.proficiencias || 'Escolha uma classe', ...(p.proficienciasExtras || [])].join(', '))}. Elas indicam os equipamentos que você sabe usar.</p></details>
      <details><summary>Evolução e regras opcionais</summary><p>${p.classe==='Sobrevivente'?'Estágio 2: trilha. Estágio 3: +1 atributo (máximo 3); INT adicional treina uma perícia. Estágio 4: segundo poder de trilha. Estágio 5: Cicatrizado.':'Agentes: trilha em 10%, 40%, 65% e 99%; poderes de classe em 15% e a cada 15%; +1 atributo em 20%, 50%, 80% e 95%; treino veterano em 35% e expert em 70%; versatilidade em 50%.'}</p><p>As escolhas de poderes, pré-requisitos e modificadores de trilha precisam ser registradas em Habilidades. O cálculo inclui classe, origem e os PV de Durão; outros poderes exigem ajuste.</p><p>Combine regras opcionais com o mestre. Separar nível e NEX (Horror p. 98), Determinação no lugar de PE/SAN (p. 104) e criação por idade (Básico p. 172) mudam a montagem. PE e SAN nesta ficha seguem a regra padrão; não são convertidos em PD automaticamente.</p></details></div>
      <div><b>Confira antes de jogar</b><ul>${avisos.length?avisos.map(a=>`<li>${esc(a)}</li>`).join(''):'<li>Nenhuma pendência básica detectada. Confira poderes, pré-requisitos e escolhas da campanha com o mestre.</li>'}</ul>
      <button class="btn btn-ghost btn-peq" data-revisar-guia>Atualizar conferência</button>
      <p>Os avisos orientam a revisão; não certificam todas as combinações de regras.</p></div></div>
      <p class="dica-passo">Trocar a trilha registra a escolha. Adicione seus poderes e ajustes em Habilidades; eles não são inseridos só por selecionar o nome.</p>
    </section>`;
  }
};

/* Evolução do Sobrevivente mantém danos e ajustes feitos pelo jogador. */
Regras.subirEstagio = function(p) {
  const estagio = num(p.estagio,1), proximo = estagio + 1;
  if(proximo>5) return toast('Estágio máximo atingido. Treinamento especial exige combinar a mudança de classe com o mestre.');
  let candidato=JSON.parse(JSON.stringify(p)); candidato.estagio=proximo; candidato.nex=0;
  const treinadas=PERICIAS.filter(x=>num(p.pericias[x.key]?.treino)>0);
  Modal.abrir({titulo:`Avançar para estágio ${proximo}`,corpo:`
    <p class="dialogo">Você continua com NEX 0%. Os ganhos são somados aos valores salvos, preservando ferimentos e bônus extras.</p>
    ${proximo===2?`<label class="campo"><span>Escolha a trilha</span><select id="e-trilha">${this.trilhas.Sobrevivente.map(([n,d])=>`<option value="${n}" ${p.trilha===n?'selected':''}>${n} — ${esc(d)}</option>`).join('')}</select></label>`:''}
    ${proximo===3?`<label class="campo"><span>Aumente um atributo em 1 (máximo 3)</span><select id="e-attr">${ATRIBUTOS.filter(a=>num(p.atributos[a.key])<3).map(a=>`<option value="${a.key}">${a.nome} (${num(p.atributos[a.key])} → ${num(p.atributos[a.key])+1})</option>`).join('')}</select></label>`:''}
    ${[2,3].includes(proximo)?`<label class="campo"><span>Perícia adicional (apenas para Esperto no estágio 2 ou aumento de INT no estágio 3)</span><select id="e-pericia"><option value="">Escolha quando aplicável</option>${PERICIAS.filter(x=>!treinadas.includes(x)).map(x=>`<option value="${x.key}">${esc(x.nome)}</option>`).join('')}</select></label>`:''}
    ${proximo===4?`<p class="dialogo">${esc(this.trilhas.Sobrevivente.find(t=>t[0]===p.trilha)?.[1] || 'Confira sua trilha no guia.')}</p><label class="campo"><span>Escolha da habilidade (Esperto: duas perícias; Esotérico: ritual de 1º círculo)</span><input id="e-escolha" placeholder="Nomes das perícias ou do ritual"></label>`:''}
    ${proximo===5?'<p class="dialogo">Cicatrizado: defina um perigo paranormal que você enfrentou e o elemento correspondente. Uma vez por sessão pode sacrificar PV ou PE permanentes para resistir a certos efeitos (Horror, p. 31).</p><label class="campo"><span>Perigo e elemento do trauma</span><input id="e-escolha"></label>':''}
    <p class="dica-passo">Sobrevivendo ao Horror, p. 30–32.</p>`,confirmar:'Avançar estágio',onConfirmar:()=>{
      candidato=JSON.parse(JSON.stringify(p)); candidato.estagio=proximo; candidato.nex=0;
      if(proximo===2) candidato.trilha=$('#e-trilha').value;
      if(proximo===3) { const k=$('#e-attr').value;if(!k)return false;candidato.atributos[k]=num(candidato.atributos[k])+1; }
      const extra=proximo===2&&candidato.trilha==='Esperto'||proximo===3&&$('#e-attr').value==='INT';
      if(extra) {const k=$('#e-pericia').value;if(!k){toast('Escolha sua perícia adicional.','erro');return false;}candidato.pericias[k].treino=5;}
      if(proximo===4&&!this.trilhas.Sobrevivente.some(t=>t[0]===p.trilha)) {toast('Escolha sua trilha no guia antes de avançar.','erro');return false;}
      const escolha=$('#e-escolha')?.value.trim();
      if((proximo===5||proximo===4&&['Esperto','Esotérico'].includes(p.trilha))&&!escolha){toast('Registre a escolha da habilidade.','erro');return false;}
      if(proximo===4&&p.trilha==='Esperto') {
        const nomes=escolha.split(',').map(n=>slug(n.trim()));
        if(nomes.length!==2||new Set(nomes).size!==2||nomes.some(k=>['luta','pontaria'].includes(k)||!treinadas.some(t=>t.key===k))) {toast('Informe duas perícias treinadas separadas por vírgula, exceto Luta e Pontaria.','erro');return false;}
      }
      const antes=this.status(p),depois=this.status(candidato);
      ['pv','pe','san'].forEach(k=>{const delta=depois[k]-antes[k];candidato[k].max=num(p[k].max)+delta;candidato[k].atual=Math.min(candidato[k].max,num(p[k].atual)+delta);});
      candidato.peRodada=this.limitePE(candidato);
      if(proximo===2||proximo===4) {
        const nomes={Durão:['Durão','Pancada Forte'],Esperto:['Esperto','Entendido'],Esotérico:['Esotérico','Iniciado']};
        candidato.habilidades.push({nome:nomes[candidato.trilha][proximo===2?0:1],custo:'',pagina:'Horror, p. 31–32',desc:this.trilhas.Sobrevivente.find(t=>t[0]===candidato.trilha)[1]+(escolha?` Escolha: ${escolha}.`:'')});
      }
      if(proximo===4&&p.trilha==='Esotérico') candidato.rituais.push({nome:escolha,circulo:'1',custo:'1',elemento:'',desc:'Complete a descrição e os demais campos conforme o ritual escolhido.'});
      if(proximo===5) candidato.habilidades.push({nome:'Cicatrizado',custo:'1 PV ou 1 PE permanente',pagina:'Horror, p. 31',desc:`Trauma: ${escolha}. –1d20 em resistência a esse perigo. Uma vez por sessão, como reação: sacrifique 1 PV permanente para ignorar um dano mental ou gasto de PE; ou 1 PE permanente para reduzir um dano físico à metade.`});
      Object.assign(p,candidato);Store.salvar(p);Ficha.abrir(p.id);toast(`Estágio ${proximo} alcançado.`);
    }});
};
