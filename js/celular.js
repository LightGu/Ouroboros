/* Celular: conversas privadas. O mestre também fala como "outro número". */

const Celular = {
  aberto: false,
  msgs: [],
  personas: [],
  membros: [],
  conversa: null,     // { tipo: 'user'|'persona', id, nome, foto }
  comoPersona: null,  // mestre falando por uma persona
  /* Até onde eu li cada conversa. Vem do banco, numa tabela que só eu
     alcanço — persiste entre recarregamentos e o remetente não enxerga. */
  lido: new Map(),
  liberados: [],      // quem enxerga qual persona, além de quem trocou mensagem

  /* ---------------- carga ---------------- */

  /* allSettled, não all: se uma tabela faltar (migração não rodada), só o
     recurso dela para. Com Promise.all, uma peça quebrada apagava a lista de
     contatos inteira e parecia que as mensagens tinham sumido. */
  async carregar() {
    const partes = await Promise.allSettled([
      Nuvem.mensagens(App.mesa.id),
      Nuvem.personas(App.mesa.id),
      Nuvem.membros(App.mesa.id),
      Nuvem.leituras(App.mesa.id),
      Nuvem.contatosLiberados(App.mesa.id)
    ]);
    const [msgs, personas, membros, lido, liberados] = partes;
    const ok = (r, padrao) => r.status === 'fulfilled' ? r.value : padrao;

    this.msgs      = ok(msgs, []);
    this.personas  = ok(personas, []);
    this.membros   = ok(membros, []);
    this.lido      = ok(lido, new Map());
    this.liberados = ok(liberados, []);

    partes.filter(r => r.status === 'rejected')
          .forEach(r => App.faltaMigracao(r.reason));

    this.render();
    Mensagens.render();
  },

  eu() { return App.sessao.user.id; },

  /* ---------------- quem fala com quem ----------------
     A conversa é sempre entre MIM e um contato. O contato é um usuário
     (outro jogador, ou o mestre) ou uma persona do mestre. */

  /* De quem é este celular agora: eu mesmo, ou uma das minhas personas.
     Trocar de identidade troca a caixa de entrada inteira — é como se o
     mestre tivesse vários aparelhos e escolhesse qual está na mão. */
  souEu()  { return !this.comoPersona; },
  meuLado(m) {
    return this.comoPersona
      ? (m.de_persona === this.comoPersona ? 'de' : m.para_persona === this.comoPersona ? 'para' : null)
      : (m.de_user === this.eu() ? 'de' : m.para_user === this.eu() ? 'para' : null);
  },

  /* O contato é o outro lado da conversa, visto da identidade ativa. */
  contatoDe(m) {
    const lado = this.meuLado(m);
    if (!lado) return null;
    if (lado === 'de')
      return m.para_persona ? { tipo: 'persona', id: m.para_persona } : { tipo: 'user', id: m.para_user };
    return m.de_persona ? { tipo: 'persona', id: m.de_persona } : { tipo: 'user', id: m.de_user };
  },

  minhas() {
    return this.msgs.filter(m => this.meuLado(m));
  },

  nomeDe(tipo, id) {
    if (tipo === 'persona') return this.personas.find(p => p.id === id)?.nome || 'Desconhecido';
    return this.membros.find(m => m.id === id)?.nome || 'Alguém';
  },

  fotoDe(tipo, id) {
    if (tipo === 'persona') return this.personas.find(p => p.id === id)?.foto || '';
    const personagem = Store.estado?.personagens?.find(p => p.donoId === id);
    return personagem ? imagemPorVida(personagem) : '';
  },

  /* Contatos: os outros membros da mesa, mais as personas.
     O jogador só vê a persona depois que ela falou com ele — é o mestre
     que decide quando aquele número "existe". */
  contatos() {
    /* Falando por uma persona, os contatos são os jogadores — uma persona
       não conversa com outra persona. */
    const lista = this.membros
      .filter(m => this.comoPersona ? m.id !== this.eu() || true : m.id !== this.eu())
      .filter(m => this.comoPersona ? m.papel !== 'mestre' : m.id !== this.eu())
      .map(m => ({ tipo: 'user', id: m.id, nome: m.nome, papel: m.papel, foto: this.fotoDe('user', m.id) }));

    if (this.souEu()) {
      /* o jogador só enxerga a persona depois que ela falou com ele:
         é o mestre quem decide quando aquele número passa a existir */
      const permitidas = App.ehMestre ? this.personas : this.personas.filter(p => this.tenhoContato(p.id));
      permitidas.forEach(p => lista.push({ tipo: 'persona', id: p.id, nome: p.nome, foto: p.foto, persona: true }));
    }

    return lista.map(c => {
      const conv = this.daConversa(c);
      const ultima = conv[conv.length - 1];
      return Object.assign(c, { ultima, naoLidas: this.novasDe(c) });
    }).sort((a, b) =>
      (b.ultima ? Date.parse(b.ultima.criado_em) : 0) - (a.ultima ? Date.parse(a.ultima.criado_em) : 0));
  },

  /* Tenho o número se ele já falou comigo, ou se alguém me passou. */
  tenhoContato(personaId) {
    return this.msgs.some(m =>
             (m.de_persona === personaId && m.para_user === this.eu()) ||
             (m.para_persona === personaId && m.de_user === this.eu()))
        || this.liberados.some(l => l.persona_id === personaId && l.user_id === this.eu());
  },

  chaveDe(c) { return (c.tipo === 'persona' ? 'p:' : 'u:') + c.id; },

  /* Não lidas = o que chegou pra mim depois da última vez que abri. */
  novasDe(c) {
    const corte = this.lido.get(this.chaveDe(c)) || 0;
    return this.daConversa(c).filter(m =>
      m.para_user === this.eu() && Date.parse(m.criado_em) > corte).length;
  },

  daConversa(c) {
    return this.minhas().filter(m => {
      const o = this.contatoDe(m);
      return o && o.tipo === c.tipo && o.id === c.id;
    });
  },

  naoLidas() { return this.contatos().reduce((n, c) => n + c.naoLidas, 0); },

  /* ---------------- desenho ---------------- */

  render() {
    const cel = $('#celular');
    if (!cel) return;
    cel.classList.toggle('aberto', this.aberto);

    const n = this.naoLidas();
    const badge = $('#celular-badge');
    badge.hidden = !n;
    badge.textContent = n > 9 ? '9+' : n;

    $('#celular-tela').innerHTML = this.conversa ? this.telaConversa() : this.telaContatos();
    this.ligarTela();
  },

  telaContatos() {
    const lista = this.contatos();
    return `
      <header class="cel-cab">
        <span class="cel-titulo">Mensagens</span>
        ${App.ehMestre ? '<button class="cel-acao" data-nova-persona title="Criar outro número">+ número</button>' : ''}
      </header>
      ${App.ehMestre && this.personas.length ? `
        <div class="cel-como">
          <span>meu número</span>
          <select id="cel-identidade">
            <option value="">${esc(App.perfil?.nome || 'Eu')}</option>
            ${this.personas.map(p => `<option value="${p.id}" ${this.comoPersona === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
          </select>
        </div>` : ''}
      <div class="cel-lista">
        ${lista.length ? lista.map(c => `
          <button class="cel-contato" data-abrir="${c.tipo}:${esc(c.id)}">
            <span class="cel-foto">${c.foto ? `<img src="${esc(c.foto)}" alt="">` : esc(iniciais(c.nome))}</span>
            <span class="cel-info">
              <span class="cel-nome">${esc(c.nome)}${c.persona ? '<i class="cel-tag">número</i>' : ''}</span>
              <span class="cel-previa">${c.ultima ? esc(c.ultima.texto.slice(0, 38)) : '<i>sem conversa</i>'}</span>
            </span>
            ${App.ehMestre && c.persona ? `<span class="cel-acao cel-editar-imagem" data-editar-persona="${esc(c.id)}" role="button" tabindex="0" title="Escolher imagem">imagem</span>` : ''}
            ${c.naoLidas ? (App.ehMestre
                ? `<span class="cel-bolha">${c.naoLidas}</span>`
                : '<span class="cel-novo" title="mensagem nova"></span>') : ''}
          </button>`).join('')
          : '<p class="cel-vazio">Ninguém pra conversar ainda.</p>'}
      </div>`;
  },

  telaConversa() {
    const c = this.conversa;
    const conv = this.daConversa(c);
    return `
      <header class="cel-cab">
        <button class="cel-voltar" data-voltar>‹</button>
        <span class="cel-foto pequena">${c.foto ? `<img src="${esc(c.foto)}" alt="">` : esc(iniciais(c.nome))}</span>
        <span class="cel-titulo">${esc(c.nome)}</span>
        ${c.tipo === 'persona' && this.souEu()
          ? '<button class="cel-acao" data-passar title="Dar este contato a outra pessoa">passar número</button>' : ''}
      </header>
      <div class="cel-conversa" id="cel-conversa">
        ${conv.length ? conv.map(m => {
          /* "minha" é do ponto de vista da IDENTIDADE ativa, não do usuário.
             Falando por uma persona, quem assina é ela e de_user fica nulo —
             olhar só de_user jogava a própria mensagem no lado de quem recebe. */
          const meu = this.meuLado(m) === 'de';
          const hora = new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return `<div class="balao ${meu ? 'meu' : 'dele'}">
                    ${esc(m.texto)}<time>${hora}</time>
                  </div>`;
        }).join('') : '<p class="cel-vazio">Comece a conversa.</p>'}
      </div>
      ${App.ehMestre && this.comoPersona ? `
        <div class="cel-como cel-disfarce">
          <span>falando como</span> <b>${esc(this.nomeDe('persona', this.comoPersona))}</b>
        </div>` : ''}
      <form class="cel-escrever" id="cel-form">
        <input id="cel-texto" placeholder="Mensagem..." autocomplete="off" maxlength="900">
        <button type="submit" title="Enviar">➤</button>
      </form>`;
  },

  ligarTela() {
    const tela = $('#celular-tela');

    $$('[data-abrir]', tela).forEach(b => b.addEventListener('click', () => {
      const [tipo, id] = b.dataset.abrir.split(':');
      this.conversa = { tipo, id, nome: this.nomeDe(tipo, id), foto: this.fotoDe(tipo, id) };
      this.marcarLido(this.conversa);
      this.render();
      this.rolarFim();
    }));

    $('[data-voltar]', tela)?.addEventListener('click', () => { this.conversa = null; this.render(); });
    $('[data-nova-persona]', tela)?.addEventListener('click', () => this.modalPersona());
    $$('[data-editar-persona]', tela).forEach(b => {
      const abrir = e => { e.stopPropagation(); this.modalImagemPersona(b.dataset.editarPersona); };
      b.addEventListener('click', abrir);
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') abrir(e); });
    });
    $('[data-passar]', tela)?.addEventListener('click', () => this.modalPassar(this.conversa));
    $('#cel-identidade', tela)?.addEventListener('change', e => {
      this.comoPersona = e.target.value || null;
      this.conversa = null;          /* caixa de entrada nova, começa da lista */
      this.render();
    });
    $('#cel-form', tela)?.addEventListener('submit', e => { e.preventDefault(); this.enviar(); });
    this.rolarFim();
  },

  rolarFim() {
    const el = $('#cel-conversa');
    if (el) el.scrollTop = el.scrollHeight;
  },

  /* ---------------- ações ---------------- */

  async enviar() {
    const campo = $('#cel-texto');
    const texto = campo.value.trim();
    if (!texto || !this.conversa) return;
    campo.value = '';

    const c = this.conversa;
    const msg = { mesa_id: App.mesa.id, texto };

    if (App.ehMestre && this.comoPersona) msg.de_persona = this.comoPersona;
    else msg.de_user = this.eu();

    if (c.tipo === 'persona') msg.para_persona = c.id;
    else msg.para_user = c.id;

    /* mandar como persona PARA uma persona não faz sentido */
    if (msg.de_persona && msg.para_persona) { toast('Escolha um jogador como destino.', 'erro'); return; }

    try {
      const nova = await Nuvem.enviarMensagem(msg);
      this.msgs.push(nova);
      this.render();
      this.rolarFim();
    } catch (e) {
      toast('Não consegui enviar: ' + (e.message || e), 'erro');
      campo.value = texto;
    }
  },

  /* Passar o número adiante. O jogador só passa o que já tem — a checagem
     de verdade está na função do banco, esta tela é só conveniência. */
  modalPassar(c) {
    const outros = this.membros.filter(m => m.id !== this.eu());
    const jaTem = id => this.liberados.some(l => l.persona_id === c.id && l.user_id === id)
      || this.msgs.some(m => (m.de_persona === c.id && m.para_user === id)
                          || (m.para_persona === c.id && m.de_user === id));
    Modal.abrir({
      titulo: 'Passar o número',
      corpo: `
        <p class="dialogo">Quem mais passa a ter <b>${esc(c.nome)}</b> na lista de contatos.</p>
        <div class="lista-jogadores">
          ${outros.map(m => `
            <label class="jogador">
              <input type="checkbox" value="${esc(m.id)}" ${jaTem(m.id) ? 'checked disabled' : ''}>
              <span class="jogador-nome">${esc(m.nome)}</span>
              <span class="tag ${m.papel === 'mestre' ? 'tag-mestre' : 'tag-jogador'}">${m.papel}</span>
              <span class="cresce"></span>
              ${jaTem(m.id) ? '<span class="jogador-quando">já tem</span>' : ''}
            </label>`).join('')}
        </div>`,
      confirmar: 'Passar',
      onConfirmar: async () => {
        const ids = [...document.querySelectorAll('#modal-body input:checked:not(:disabled)')].map(i => i.value);
        if (!ids.length) { toast('Marque pelo menos uma pessoa.', 'erro'); return false; }
        try {
          for (const id of ids) await Nuvem.liberarContato(c.id, id);
          this.liberados = await Nuvem.contatosLiberados(App.mesa.id);
          toast(`Número passado para ${ids.length} pessoa(s).`);
        } catch (e) { toast(String(e.message || e), 'erro'); return false; }
      }
    });
  },

  modalPersona() {
    Modal.abrir({
      titulo: 'Novo número',
      corpo: `
        <p class="dialogo fraco">Um contato que não é você. O jogador vê esse nome e essa foto,
           e não tem como saber que é o mestre do outro lado.</p>
        <label class="campo"><span>Nome que aparece</span>
          <input id="pers-nome" placeholder="Ex.: Desconhecido, Dr. Aldo, (11) 9****-1234"></label>
        <label class="campo"><span>Foto (opcional)</span><input type="file" id="pers-foto" accept="image/*"></label>
        <div class="previa" id="pers-previa"><span class="fraco">sem foto</span></div>
        <div class="nota-links"><h4>Quem já pode ver este número</h4>
          <p class="ajuda">Deixe vazio pra ninguém ver até você mandar a primeira mensagem.</p>
          ${this.membros.filter(m => m.id !== this.eu()).map(m => `
            <label class="link-nota"><input type="checkbox" class="pers-quem" value="${esc(m.id)}"> ${esc(m.nome)}</label>`).join('')}
        </div>
        ${this.personas.length ? `<div class="nota-links"><h4>Números já criados</h4>
          ${this.personas.map(p => `<button class="link-nota" data-apagar-persona="${p.id}">${esc(p.nome)} ✕</button>`).join('')}
        </div>` : ''}`,
      confirmar: 'Criar',
      onConfirmar: async () => {
        const nome = $('#pers-nome').value.trim();
        if (!nome) { toast('Dá um nome pro número.', 'erro'); return false; }
        try {
          let foto = '';
          if (Modal._fotoPersona) foto = await Nuvem.enviarRetrato(Modal._fotoPersona, App.mesa.id, 'persona');
          const p = await Nuvem.criarPersona(App.mesa.id, nome, foto || null);
          this.personas.push(p);
          const quem = [...document.querySelectorAll('.pers-quem:checked')].map(i => i.value);
          for (const id of quem) await Nuvem.liberarContato(p.id, id);
          if (quem.length) this.liberados = await Nuvem.contatosLiberados(App.mesa.id);
          this.render();
          toast('Número criado' + (quem.length ? ` e liberado pra ${quem.length}.` : '.'));
        } catch (e) { toast('Erro: ' + (e.message || e), 'erro'); return false; }
        finally { delete Modal._fotoPersona; }
      }
    });

    $('#pers-foto').addEventListener('change', async e => {
      try {
        const d = await lerImagem(e.target.files[0]);
        Modal._fotoPersona = d;
        $('#pers-previa').innerHTML = `<img src="${d}">`;
      } catch { toast('Não consegui ler a imagem.', 'erro'); }
    });

    $$('[data-apagar-persona]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.apagarPersona;
      await Nuvem.apagarPersona(id);
      this.personas = this.personas.filter(p => p.id !== id);
      this.msgs = this.msgs.filter(m => m.de_persona !== id && m.para_persona !== id);
      Modal.fechar();
      this.render();
    }));
  },

  modalImagemPersona(id) {
    const persona = this.personas.find(p => p.id === id);
    if (!persona || !App.ehMestre) return;
    let foto = persona.foto || '';
    let lendo = false;
    Modal.abrir({
      titulo: 'Imagem do número',
      corpo: `<label class="campo"><span>Enviar imagem</span><input type="file" id="pers-foto-editar" accept="image/*"></label>
        <label class="campo"><span>Ou colar um link</span><input type="url" id="pers-url-editar" placeholder="https://..." value="${foto.startsWith('http') ? esc(foto) : ''}"></label>
        <div class="previa" id="pers-previa-editar">${foto ? `<img src="${esc(foto)}" alt="Prévia">` : '<span class="fraco">sem foto</span>'}</div>
        <p role="alert" id="pers-erro-editar"></p>`,
      confirmar: async () => {
        const url = $('#pers-url-editar').value.trim();
        if (url) foto = url;
        else if (!foto.startsWith('data:')) foto = '';
        if (lendo || (url && !/^https?:\/\//i.test(url))) {
          $('#pers-erro-editar').textContent = 'Use um link http ou https válido.';
          return false;
        }
        try {
          if (foto.startsWith('data:')) foto = await Nuvem.enviarRetrato(foto, App.mesa.id, 'persona-' + id);
          await Nuvem.salvarPersona(id, foto || null);
          persona.foto = foto;
          this.render();
        } catch (e) {
          $('#pers-erro-editar').textContent = 'Não consegui salvar: ' + (e.message || e);
          return false;
        }
      }
    });
    $('#pers-foto-editar').addEventListener('change', async e => {
      lendo = true;
      try {
        foto = await lerImagem(e.target.files[0]);
        $('#pers-url-editar').value = '';
        $('#pers-previa-editar').innerHTML = `<img src="${foto}" alt="Prévia">`;
      } catch { $('#pers-erro-editar').textContent = 'Não consegui ler a imagem.'; }
      finally { lendo = false; }
    });
    $('#pers-url-editar').addEventListener('change', e => {
      foto = e.target.value.trim();
      $('#pers-previa-editar').innerHTML = foto ? `<img src="${esc(foto)}" alt="Prévia">` : '<span class="fraco">sem foto</span>';
    });
  },

  /* ---------------- abrir e fechar ---------------- */

  alternar() {
    this.aberto = !this.aberto;
    this.render();
  },
  fechar()   { if (this.aberto) { this.aberto = false; this.render(); } },

  recebeu(m) {
    if (this.msgs.some(x => x.id === m.id)) return;
    this.msgs.push(m);
    this.render();
    Mensagens.render();
    if (m.para_user === this.eu()) {
      const quem = m.de_persona ? this.nomeDe('persona', m.de_persona) : this.nomeDe('user', m.de_user);
      toast('📱 ' + quem + ': ' + m.texto.slice(0, 40));
      /* se já estou olhando esta conversa, ela nasce lida */
      const c = this.contatoDe(m);
      const olhando = this.aberto && this.conversa
        && c && c.tipo === this.conversa.tipo && c.id === this.conversa.id;
      if (olhando) this.marcarLido(this.conversa);
      this.render();
      this.vibrar();
    }
  },

  /* Anota que li esta conversa até agora. Falha de rede aqui não atrapalha
     a leitura em si: a marca local já vale, e a próxima abertura tenta de novo. */
  marcarLido(c) {
    if (!c) return;
    const agora = Date.now();
    this.lido.set(this.chaveDe(c), agora);
    Nuvem.marcarLido(App.mesa.id, this.chaveDe(c), agora).catch(e => console.error('leitura:', e));
  },

  /* chacoalhada curta na faixa visível do aparelho */
  vibrar() {
    const alvo = $('#celular-puxador');
    if (!alvo) return;
    alvo.classList.remove('vibrando');
    void alvo.offsetWidth;                 /* reinicia a animação se já estava rodando */
    alvo.classList.add('vibrando');
    setTimeout(() => alvo.classList.remove('vibrando'), 700);
  },

  ligar() {
    if (this._ligado) return;
    this._ligado = true;
    $('#celular-puxador').addEventListener('click', () => this.alternar());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.fechar(); });
  }
};

/* ============================================================
   Aba do mestre: toda conversa da mesa, inclusive entre jogadores.
   Eles não têm como saber que isto existe.
   ============================================================ */

const Mensagens = {
  render() {
    if (!App.ehMestre) return;
    const alvo = $('#mensagens-corpo');
    if (!alvo) return;

    const nome = m => m.de_persona ? Celular.nomeDe('persona', m.de_persona) : Celular.nomeDe('user', m.de_user);
    const dest = m => m.para_persona ? Celular.nomeDe('persona', m.para_persona) : Celular.nomeDe('user', m.para_user);

    /* agrupa por par de conversa, sem olhar quem começou */
    const pares = new Map();
    Celular.msgs.forEach(m => {
      const a = m.de_persona   ? 'p:' + m.de_persona   : 'u:' + m.de_user;
      const b = m.para_persona ? 'p:' + m.para_persona : 'u:' + m.para_user;
      const k = [a, b].sort().join('|');
      if (!pares.has(k)) pares.set(k, []);
      pares.get(k).push(m);
    });

    if (!pares.size) {
      alvo.innerHTML = `<div class="vazio"><div class="vazio-mark">✉</div>
        <h2>Nenhuma mensagem ainda</h2>
        <p>Tudo que for trocado no celular aparece aqui — inclusive conversa entre dois jogadores.
           Eles não são avisados de que você lê.</p></div>`;
      return;
    }

    const grupos = [...pares.values()]
      .sort((x, y) => Date.parse(y[y.length - 1].criado_em) - Date.parse(x[x.length - 1].criado_em));

    alvo.innerHTML = `
      <p class="dialogo fraco espia-aviso">🔒 Só você enxerga esta aba. Abrir uma conversa aqui
         não marca nada como lido — o jogador não percebe.</p>
      <div class="espia-grade">
        ${grupos.map(g => {
          const p = g[0];
          const titulo = `${esc(nome(p))} ↔ ${esc(dest(p))}`;
          return `
          <article class="espia-conversa">
            <header>${titulo} <span class="espia-qtd">${g.length}</span></header>
            <div class="espia-linhas">
              ${g.map(m => `
                <div class="espia-msg">
                  <b>${esc(nome(m))}</b>
                  <span>${esc(m.texto)}</span>
                  <time>${new Date(m.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
                </div>`).join('')}
            </div>
          </article>`;
        }).join('')}
      </div>`;
  }
};
