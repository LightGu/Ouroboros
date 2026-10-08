/* Rolagem de dados + painel compartilhado */

const Rolagem = {
  itens: [],
  aberto: false,

  /* ---------------- motor ---------------- */

  /* Perícia em Ordem Paranormal: rola N d20 (N = atributo) e pega o MAIOR.
     Com atributo 0, rola 2 e pega o MENOR. Soma treino + outros. */
  pericia(p, chave) {
    const per = PERICIAS.find(x => x.key === chave);
    const b = bonusPericia(p, chave);
    const desvantagem = b.dados <= 0;
    const qtd = desvantagem ? 2 : Math.min(20, b.dados);
    const rolados = Array.from({ length: qtd }, d20);
    const escolhido = desvantagem ? Math.min(...rolados) : Math.max(...rolados);

    const descartados = rolados.slice();
    descartados.splice(descartados.indexOf(escolhido), 1);

    return {
      rotulo: per.nome,
      formula: `${qtd}d20 (${desvantagem ? 'menor' : 'maior'})` + (b.bonus ? ` ${b.bonus > 0 ? '+' : '−'} ${Math.abs(b.bonus)}` : ''),
      dados: [escolhido],
      descartados,
      resultado: escolhido + b.bonus,
      critico: escolhido === 20,
      desastre: escolhido === 1
    };
  },

  /* Aceita "2d6+3", "1d12", "2d10 + 1d4 - 2" */
  expressao(texto, rotulo) {
    const termos = String(texto || '').replace(/\s+/g, '').match(/[+-]?(\d*d\d+|\d+)/gi);
    if (!termos || !termos.length) return null;

    let total = 0;
    const dados = [];
    const partes = [];

    for (const t of termos) {
      const sinal = t.startsWith('-') ? -1 : 1;
      const corpo = t.replace(/^[+-]/, '');
      if (/d/i.test(corpo)) {
        const [q, f] = corpo.toLowerCase().split('d');
        const qtd = Math.min(50, Math.max(1, parseInt(q || '1', 10)));
        const faces = Math.min(1000, Math.max(2, parseInt(f, 10)));
        const rolados = Array.from({ length: qtd }, () => 1 + Math.floor(Math.random() * faces));
        dados.push(...rolados);
        total += sinal * rolados.reduce((a, b) => a + b, 0);
        partes.push((sinal < 0 ? '− ' : partes.length ? '+ ' : '') + qtd + 'd' + faces);
      } else {
        const n = parseInt(corpo, 10);
        total += sinal * n;
        partes.push((sinal < 0 ? '− ' : '+ ') + n);
      }
    }
    return { rotulo: rotulo || texto, formula: partes.join(' '), dados, descartados: [], resultado: total };
  },

  /* ---------------- envio ---------------- */

  async enviar(r, personagemNome) {
    if (!r) return toast('Não entendi essa fórmula.', 'erro');
    const secreta = App.ehMestre && $('#rolagem-secreta')?.checked;
    this.abrir();
    try {
      await Nuvem.criarRolagem({
        mesa_id: App.mesa.id,
        autor_id: App.sessao.user.id,
        autor_nome: App.perfil?.nome || 'Agente',
        personagem_nome: personagemNome || '',
        rotulo: r.rotulo, formula: r.formula,
        dados: r.dados, descartados: r.descartados,
        resultado: r.resultado, secreta
      });
    } catch (e) {
      toast('Não consegui registrar a rolagem: ' + (e.message || e), 'erro');
    }
  },

  rolarPericia(p, chave) { return this.enviar(this.pericia(p, chave), p.nome); },
  rolarTexto(texto, rotulo, nome) { return this.enviar(this.expressao(texto, rotulo), nome); },

  /* ---------------- painel ---------------- */

  async carregar() {
    const mesaId = App.mesa?.id;
    const carga = this.carga = (this.carga || 0) + 1;
    try {
      const itens = await Nuvem.rolagens(mesaId);
      if (App.mesa?.id !== mesaId || this.carga !== carga) return;
      this.itens = itens; this.render();
    }
    catch (e) { console.error(e); }
  },

  receber(r) {
    if (this.itens.some(x => x.id === r.id)) return;
    this.itens.unshift(r);
    this.render();
    if (!this.aberto) {
      const b = $('#btn-rolagens');
      b.classList.add('piscando');
      setTimeout(() => b.classList.remove('piscando'), 1600);
    }
  },

  render() {
    const alvo = $('#rolagens-lista');
    if (!this.itens.length) {
      alvo.innerHTML = '<p class="vazio-linha">Nenhuma rolagem ainda. Clica no nome de uma perícia na ficha.</p>';
      return;
    }
    alvo.innerHTML = this.itens.map(r => {
      const d = new Date(r.criado_em);
      const mantidos = (r.dados || []).map(v => `<b class="dado ${v === 20 ? 'critico' : v === 1 ? 'desastre' : ''}">${v}</b>`).join('');
      const fora = (r.descartados || []).map(v => `<span class="dado fora">${v}</span>`).join('');
      return `
        <div class="rolagem ${r.secreta ? 'secreta' : ''}">
          <div class="rolagem-cab">
            <span class="rolagem-quem">${esc(r.personagem_nome || r.autor_nome || '')}</span>
            <span class="rolagem-hora">${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="rolagem-corpo">
            <div class="rolagem-info">
              <span class="rolagem-rotulo">${esc(r.rotulo)}${r.secreta ? ' 🔒' : ''}</span>
              <span class="rolagem-formula">${esc(r.formula || '')}</span>
              <span class="rolagem-dados">${mantidos}${fora}</span>
            </div>
            <span class="rolagem-total">${r.resultado}</span>
          </div>
        </div>`;
    }).join('');
  },

  abrir()  { this.aberto = true;  $('#painel-rolagens').hidden = false; document.body.classList.add('com-painel'); },
  fechar() { this.aberto = false; $('#painel-rolagens').hidden = true;  document.body.classList.remove('com-painel'); },
  alternar() { this.aberto ? this.fechar() : this.abrir(); },

  ligar() {
    $('#linha-secreta').hidden = !App.ehMestre;
    $('#rolagens-limpar').hidden = !App.ehMestre;
    if (this._ligado) return;      /* trocar de mesa não pode empilhar listener */
    this._ligado = true;
    $('#btn-rolagens').addEventListener('click', () => this.alternar());
    $('#rolagens-limpar').addEventListener('click', () => Logs.confirmarLimpeza('rolagens'));
    $('#rolagens-fechar').addEventListener('click', () => this.fechar());
    $('#btn-rolar-livre').addEventListener('click', () => {
      const t = $('#rolagem-livre').value.trim();
      if (!t) return;
      this.rolarTexto(t, t, App.perfil?.nome);
      $('#rolagem-livre').value = '';
    });
    $('#rolagem-livre').addEventListener('keydown', e => {
      if (e.key === 'Enter') $('#btn-rolar-livre').click();
    });
  }
};
