/* Mapa de batalha: tokens arrastáveis + fog of war */

const CELULA = 32;   /* resolução interna do canvas por célula */

const Mapa = {
  lista: [],
  atual: null,
  tokens: [],
  modo: 'mover',          // 'mover' | 'revelar' | 'cobrir'
  pincel: 2,
  encaixar: true,
  arrastando: null,

  /* ---------------- carga ---------------- */

  async carregar() {
    try {
      this.lista = await Nuvem.mapas(App.mesa.id);
      const ativo = this.lista.find(m => m.ativo) || this.lista[0] || null;
      await this.selecionar(ativo);
    } catch (e) {
      console.error(e);
      $('#mapa-palco').innerHTML = `<p class="vazio-linha">Erro ao carregar: ${esc(e.message || e)}</p>`;
    }
  },

  async selecionar(mapa) {
    this.atual = mapa;
    this.tokens = mapa ? await Nuvem.tokens(mapa.id) : [];
    this.render();
  },

  /* ---------------- desenho ---------------- */

  render() {
    this.renderBarra();
    const palco = $('#mapa-palco');

    if (!this.atual) {
      palco.innerHTML = `
        <div class="vazio">
          <div class="vazio-mark">▦</div>
          <h2>Nenhum mapa ainda</h2>
          <p>${App.ehMestre ? 'Suba uma imagem de mapa, defina a grade e comece a revelar o cenário conforme os agentes avançam.'
                            : 'O mestre ainda não colocou nenhum mapa na mesa.'}</p>
          ${App.ehMestre ? '<div class="vazio-btns"><button class="btn btn-primary" id="btn-novo-mapa-vazio">+ Criar mapa</button></div>' : ''}
        </div>`;
      $('#btn-novo-mapa-vazio')?.addEventListener('click', () => this.modalNovo());
      return;
    }

    const m = this.atual;
    palco.innerHTML = `
      <div class="mapa-area" id="mapa-area" style="aspect-ratio:${m.colunas}/${m.linhas}">
        ${m.imagem ? `<img class="mapa-img" src="${esc(m.imagem)}" alt="" draggable="false">`
                   : '<div class="mapa-sem-img">sem imagem</div>'}
        <canvas class="mapa-fog" id="mapa-fog" width="${m.colunas * CELULA}" height="${m.linhas * CELULA}"></canvas>
        <div class="mapa-tokens" id="mapa-tokens"></div>
      </div>`;

    this.desenharFog();
    this.renderTokens();
    this.ligarPalco();
  },

  desenharFog() {
    const cv = $('#mapa-fog');
    if (!cv || !this.atual) return;
    const m = this.atual;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);

    if (m.fog_ligado) {
      const fog = this.fogString();
      /* O mestre enxerga através da névoa (semitransparente); o jogador, não. */
      ctx.fillStyle = App.ehMestre ? 'rgba(8,9,12,.72)' : 'rgb(8,9,12)';
      for (let l = 0; l < m.linhas; l++) {
        for (let c = 0; c < m.colunas; c++) {
          if (fog[l * m.colunas + c] !== '1') ctx.fillRect(c * CELULA, l * CELULA, CELULA, CELULA);
        }
      }
    }

    if (m.grade) {
      ctx.strokeStyle = 'rgba(255,255,255,.13)';
      ctx.lineWidth = 1;
      for (let c = 0; c <= m.colunas; c++) {
        ctx.beginPath(); ctx.moveTo(c * CELULA + .5, 0); ctx.lineTo(c * CELULA + .5, cv.height); ctx.stroke();
      }
      for (let l = 0; l <= m.linhas; l++) {
        ctx.beginPath(); ctx.moveTo(0, l * CELULA + .5); ctx.lineTo(cv.width, l * CELULA + .5); ctx.stroke();
      }
    }
  },

  fogString() {
    const m = this.atual;
    const n = m.colunas * m.linhas;
    let f = m.fog || '';
    if (f.length < n) f = f + '0'.repeat(n - f.length);
    return f.slice(0, n);
  },

  renderTokens() {
    const alvo = $('#mapa-tokens');
    if (!alvo || !this.atual) return;
    const larguraCelula = 100 / this.atual.colunas;

    alvo.innerHTML = this.tokens.map(t => {
      const tam = larguraCelula * (t.escala || 1);
      const p = t.personagem_id ? Store.obter(t.personagem_id) : null;
      const img = t.imagem || p?.imagem || '';
      const nome = t.nome || p?.nome || '';
      const barra = p && num(p.pv.max) > 0
        ? `<span class="token-vida"><i style="width:${pct(p.pv.atual, p.pv.max)}%"></i></span>` : '';
      return `
        <div class="token ${t.oculto ? 'token-oculto' : ''} ${this.podeMover(t) ? 'token-meu' : ''}"
             data-token="${t.id}"
             style="left:${t.x * 100}%; top:${t.y * 100}%; width:${tam}%;
                    ${t.cor ? `--cor:${esc(t.cor)}` : ''}">
          ${img ? `<img src="${esc(img)}" draggable="false" alt="">`
                : `<span class="token-iniciais">${esc(iniciais(nome))}</span>`}
          ${barra}
          <span class="token-nome">${esc(nome)}</span>
        </div>`;
    }).join('');
  },

  podeMover(t) {
    if (App.ehMestre) return true;
    const p = t.personagem_id ? Store.obter(t.personagem_id) : null;
    return Boolean(p && p.donoId === App.sessao?.user?.id);
  },

  /* ---------------- barra de ferramentas ---------------- */

  renderBarra() {
    const barra = $('#mapa-barra');
    if (!App.ehMestre) {
      barra.innerHTML = this.lista.length > 1 ? this.seletor() : '';
      barra.querySelector('#sel-mapa')?.addEventListener('change', e =>
        this.selecionar(this.lista.find(m => m.id === e.target.value)));
      return;
    }

    const m = this.atual;
    barra.innerHTML = `
      ${this.seletor()}
      <button class="btn btn-ghost btn-peq" id="btn-novo-mapa">+ Mapa</button>
      ${m ? `
      <div class="sep"></div>
      <div class="grupo-modo">
        <button class="btn btn-peq ${this.modo === 'mover' ? 'ativo' : ''}" data-modo="mover" title="Arrastar tokens">✋ Mover</button>
        <button class="btn btn-peq ${this.modo === 'revelar' ? 'ativo' : ''}" data-modo="revelar" title="Pintar pra revelar">👁 Revelar</button>
        <button class="btn btn-peq ${this.modo === 'cobrir' ? 'ativo' : ''}" data-modo="cobrir" title="Pintar pra cobrir">🌫 Cobrir</button>
      </div>
      <label class="campo-inline" title="Tamanho do pincel em células">
        pincel <input type="range" id="pincel" min="1" max="6" value="${this.pincel}">
      </label>
      <div class="sep"></div>
      <button class="btn btn-ghost btn-peq" id="btn-fog-tudo">Revelar tudo</button>
      <button class="btn btn-ghost btn-peq" id="btn-fog-nada">Cobrir tudo</button>
      <label class="campo-inline"><input type="checkbox" id="chk-fog" ${m.fog_ligado ? 'checked' : ''}> névoa</label>
      <label class="campo-inline"><input type="checkbox" id="chk-grade" ${m.grade ? 'checked' : ''}> grade</label>
      <label class="campo-inline"><input type="checkbox" id="chk-encaixar" ${this.encaixar ? 'checked' : ''}> encaixar</label>
      <div class="sep"></div>
      <button class="btn btn-peq" id="btn-add-token">+ Token</button>
      <button class="btn btn-ghost btn-peq" id="btn-config-mapa">Ajustes</button>` : ''}`;

    barra.querySelector('#sel-mapa')?.addEventListener('change', e =>
      this.selecionar(this.lista.find(x => x.id === e.target.value)));
    $('#btn-novo-mapa')?.addEventListener('click', () => this.modalNovo());
    if (!m) return;

    barra.querySelectorAll('[data-modo]').forEach(b => b.addEventListener('click', () => {
      this.modo = b.dataset.modo; this.renderBarra();
      $('#mapa-area')?.classList.toggle('pintando', this.modo !== 'mover');
    }));
    $('#pincel')?.addEventListener('input', e => { this.pincel = num(e.target.value, 2); });
    $('#chk-encaixar')?.addEventListener('change', e => { this.encaixar = e.target.checked; });
    $('#chk-fog')?.addEventListener('change', e => this.mudarMapa({ fog_ligado: e.target.checked }));
    $('#chk-grade')?.addEventListener('change', e => this.mudarMapa({ grade: e.target.checked }));
    $('#btn-fog-tudo')?.addEventListener('click', () => this.mudarMapa({ fog: '1'.repeat(m.colunas * m.linhas) }));
    $('#btn-fog-nada')?.addEventListener('click', () => this.mudarMapa({ fog: '0'.repeat(m.colunas * m.linhas) }));
    $('#btn-add-token')?.addEventListener('click', () => this.modalToken());
    $('#btn-config-mapa')?.addEventListener('click', () => this.modalAjustes());
  },

  seletor() {
    if (!this.lista.length) return '';
    return `<select id="sel-mapa" class="sel-mapa">
      ${this.lista.map(m => `<option value="${m.id}" ${this.atual?.id === m.id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}
    </select>`;
  },

  async mudarMapa(campos) {
    Object.assign(this.atual, campos);
    this.desenharFog();
    this.renderBarra();
    try { await Nuvem.salvarMapa(this.atual.id, campos); }
    catch (e) { toast('Não consegui salvar: ' + (e.message || e), 'erro'); }
  },

  /* ---------------- interação no palco ---------------- */

  ligarPalco() {
    const area = $('#mapa-area');
    const cv = $('#mapa-fog');
    if (!area) return;
    area.classList.toggle('pintando', App.ehMestre && this.modo !== 'mover');

    /* --- pintar névoa (só mestre) --- */
    let pintando = false;
    const pintar = e => {
      if (!App.ehMestre || this.modo === 'mover' || !this.atual.fog_ligado) return;
      const r = cv.getBoundingClientRect();
      const c = Math.floor(((e.clientX - r.left) / r.width) * this.atual.colunas);
      const l = Math.floor(((e.clientY - r.top) / r.height) * this.atual.linhas);
      const alvo = this.modo === 'revelar' ? '1' : '0';
      const f = this.fogString().split('');
      const raio = this.pincel - 1;
      for (let dl = -raio; dl <= raio; dl++) {
        for (let dc = -raio; dc <= raio; dc++) {
          const cc = c + dc, ll = l + dl;
          if (cc < 0 || ll < 0 || cc >= this.atual.colunas || ll >= this.atual.linhas) continue;
          f[ll * this.atual.colunas + cc] = alvo;
        }
      }
      this.atual.fog = f.join('');
      this.desenharFog();
    };

    cv.addEventListener('pointerdown', e => {
      if (!App.ehMestre || this.modo === 'mover') return;
      pintando = true; cv.setPointerCapture(e.pointerId); pintar(e);
    });
    cv.addEventListener('pointermove', e => { if (pintando) pintar(e); });
    cv.addEventListener('pointerup', async () => {
      if (!pintando) return;
      pintando = false;
      try { await Nuvem.salvarMapa(this.atual.id, { fog: this.atual.fog }); }
      catch (e) { toast('Não consegui salvar a névoa.', 'erro'); }
    });

    /* --- arrastar token --- */
    let ultimoEnvio = 0;
    area.addEventListener('pointerdown', e => {
      const el = e.target.closest('.token');
      if (!el || (App.ehMestre && this.modo !== 'mover')) return;
      const t = this.tokens.find(x => x.id === el.dataset.token);
      if (!t || !this.podeMover(t)) return;
      e.preventDefault();
      this.arrastando = { t, el };
      el.classList.add('arrastando');
      el.setPointerCapture(e.pointerId);
    });

    area.addEventListener('pointermove', e => {
      if (!this.arrastando) return;
      const r = area.getBoundingClientRect();
      let x = (e.clientX - r.left) / r.width;
      let y = (e.clientY - r.top) / r.height;
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      const { t, el } = this.arrastando;
      t.x = x; t.y = y;
      el.style.left = x * 100 + '%';
      el.style.top  = y * 100 + '%';
      const agora = performance.now();
      if (agora - ultimoEnvio > 70) {     /* ~14 por segundo, só enquanto arrasta */
        ultimoEnvio = agora;
        Nuvem.transmitir('arrastando', { id: t.id, x, y });
      }
    });

    area.addEventListener('pointerup', async () => {
      if (!this.arrastando) return;
      const { t, el } = this.arrastando;
      this.arrastando = null;
      el.classList.remove('arrastando');

      if (this.encaixar && this.atual.grade) {
        const c = Math.floor(t.x * this.atual.colunas) + .5;
        const l = Math.floor(t.y * this.atual.linhas) + .5;
        t.x = c / this.atual.colunas;
        t.y = l / this.atual.linhas;
        el.style.left = t.x * 100 + '%';
        el.style.top  = t.y * 100 + '%';
      }
      Nuvem.transmitir('arrastando', { id: t.id, x: t.x, y: t.y });
      try { await Nuvem.salvarToken(t.id, { x: t.x, y: t.y }); }
      catch (e) { toast('Não consegui mover o token: ' + (e.message || e), 'erro'); }
    });

    /* --- menu do token (mestre) --- */
    area.addEventListener('contextmenu', e => {
      const el = e.target.closest('.token');
      if (!el || !App.ehMestre) return;
      e.preventDefault();
      this.menuToken(this.tokens.find(x => x.id === el.dataset.token));
    });
  },

  /* ---------------- modais ---------------- */

  modalNovo() {
    Modal.abrir({
      titulo: 'Novo mapa',
      corpo: `
        <label class="campo"><span>Nome</span><input id="mp-nome" placeholder="Ex.: Subsolo do hospital"></label>
        <label class="campo"><span>Imagem do mapa</span><input type="file" id="mp-img" accept="image/*"></label>
        <div class="previa" id="mp-previa"><span class="fraco">sem imagem</span></div>
        <div class="grade-2">
          <label class="campo"><span>Colunas</span><input type="number" id="mp-col" value="30" min="4" max="80"></label>
          <label class="campo"><span>Linhas</span><input type="number" id="mp-lin" value="20" min="4" max="80"></label>
        </div>
        <p class="dialogo fraco">A grade define o tamanho das células e a resolução da névoa. 30×20 costuma ser suficiente.</p>`,
      confirmar: 'Criar',
      onConfirmar: async () => {
        const nome = $('#mp-nome').value.trim() || 'Mapa';
        const col = Math.max(4, Math.min(80, num($('#mp-col').value, 30)));
        const lin = Math.max(4, Math.min(80, num($('#mp-lin').value, 20)));
        try {
          let url = '';
          if (Modal._mapaPendente) url = await Nuvem.enviarImagemMapa(Modal._mapaPendente, App.mesa.id);
          const m = await Nuvem.criarMapa(App.mesa.id, nome, url, col, lin);
          await Nuvem.ativarMapa(App.mesa.id, m.id);
          this.lista.push(m);
          await this.selecionar(m);
          toast('Mapa criado.');
        } catch (e) { toast('Erro: ' + (e.message || e), 'erro'); return false; }
        finally { delete Modal._mapaPendente; }
      }
    });

    $('#mp-img').addEventListener('change', async e => {
      try {
        const dados = await lerImagemGrande(e.target.files[0]);
        Modal._mapaPendente = dados;
        $('#mp-previa').innerHTML = `<img src="${dados}">`;
      } catch { toast('Não consegui ler essa imagem.', 'erro'); }
    });
  },

  modalAjustes() {
    const m = this.atual;
    Modal.abrir({
      titulo: 'Ajustes do mapa',
      corpo: `
        <label class="campo"><span>Nome</span><input id="mp-nome" value="${esc(m.nome)}"></label>
        <div class="grade-2">
          <label class="campo"><span>Colunas</span><input type="number" id="mp-col" value="${m.colunas}" min="4" max="80"></label>
          <label class="campo"><span>Linhas</span><input type="number" id="mp-lin" value="${m.linhas}" min="4" max="80"></label>
        </div>
        <p class="dialogo fraco">Mudar a grade reinicia a névoa (as células não teriam como se corresponder).</p>
        <label class="campo"><span>Trocar imagem</span><input type="file" id="mp-img" accept="image/*"></label>
        <button class="btn btn-ghost btn-perigo-texto" id="mp-apagar" type="button">Apagar este mapa</button>`,
      confirmar: 'Salvar',
      onConfirmar: async () => {
        const col = Math.max(4, Math.min(80, num($('#mp-col').value, m.colunas)));
        const lin = Math.max(4, Math.min(80, num($('#mp-lin').value, m.linhas)));
        const campos = { nome: $('#mp-nome').value.trim() || 'Mapa', colunas: col, linhas: lin };
        if (col !== m.colunas || lin !== m.linhas) campos.fog = '0'.repeat(col * lin);
        try {
          if (Modal._mapaPendente) campos.imagem = await Nuvem.enviarImagemMapa(Modal._mapaPendente, App.mesa.id);
          await Nuvem.salvarMapa(m.id, campos);
          Object.assign(m, campos);
          this.render();
        } catch (e) { toast('Erro: ' + (e.message || e), 'erro'); return false; }
        finally { delete Modal._mapaPendente; }
      }
    });

    $('#mp-img').addEventListener('change', async e => {
      try { Modal._mapaPendente = await lerImagemGrande(e.target.files[0]); toast('Imagem pronta — clique em Salvar.'); }
      catch { toast('Não consegui ler essa imagem.', 'erro'); }
    });
    $('#mp-apagar').addEventListener('click', () => {
      Modal.fechar();
      Modal.abrir({
        titulo: 'Apagar mapa', perigo: true, confirmar: 'Apagar',
        corpo: `<p class="dialogo">Apagar <b>${esc(m.nome)}</b> e todos os tokens dele?</p>`,
        onConfirmar: async () => {
          await Nuvem.apagarMapa(m.id);
          this.lista = this.lista.filter(x => x.id !== m.id);
          await this.selecionar(this.lista[0] || null);
        }
      });
    });
  },

  modalToken() {
    const semToken = Store.estado.personagens
      .filter(p => !this.tokens.some(t => t.personagem_id === p.id));
    Modal.abrir({
      titulo: 'Colocar token',
      corpo: `
        <label class="campo"><span>A partir de um personagem</span>
          <select id="tk-pers">
            <option value="">— token avulso —</option>
            ${semToken.map(p => `<option value="${p.id}">${esc(p.nome || 'Sem nome')}</option>`).join('')}
          </select></label>
        <label class="campo"><span>Nome (se for avulso)</span><input id="tk-nome" placeholder="Ex.: Porta trancada"></label>
        <div class="grade-2">
          <label class="campo"><span>Tamanho (células)</span><input type="number" id="tk-escala" value="1" min="0.5" max="6" step="0.5"></label>
          <label class="campo"><span>Cor da borda</span><input type="color" id="tk-cor" value="#c0392b"></label>
        </div>
        <label class="campo"><span>Imagem própria (opcional)</span><input type="file" id="tk-img" accept="image/*"></label>
        <label class="radio"><input type="checkbox" id="tk-oculto"> começar escondido dos jogadores</label>`,
      confirmar: 'Colocar',
      onConfirmar: async () => {
        const pid = $('#tk-pers').value || null;
        const p = pid ? Store.obter(pid) : null;
        const nome = $('#tk-nome').value.trim() || p?.nome || 'Token';
        try {
          let img = '';
          if (Modal._tokenPendente) img = await Nuvem.enviarRetrato(Modal._tokenPendente, App.mesa.id, 'token');
          const t = await Nuvem.criarToken({
            mapa_id: this.atual.id, mesa_id: App.mesa.id, personagem_id: pid,
            nome, imagem: img || null, cor: $('#tk-cor').value,
            x: 0.5, y: 0.5, escala: Math.max(.5, num($('#tk-escala').value, 1)),
            oculto: $('#tk-oculto').checked
          });
          this.tokens.push(t);
          this.renderTokens();
        } catch (e) { toast('Erro: ' + (e.message || e), 'erro'); return false; }
        finally { delete Modal._tokenPendente; }
      }
    });

    $('#tk-img').addEventListener('change', async e => {
      try { Modal._tokenPendente = await lerImagem(e.target.files[0]); toast('Imagem pronta.'); }
      catch { toast('Não consegui ler essa imagem.', 'erro'); }
    });
  },

  menuToken(t) {
    if (!t) return;
    Modal.abrir({
      titulo: 'Token: ' + (t.nome || ''),
      corpo: `
        <div class="grade-2">
          <label class="campo"><span>Nome</span><input id="tk-nome" value="${esc(t.nome || '')}"></label>
          <label class="campo"><span>Tamanho (células)</span><input type="number" id="tk-escala" value="${t.escala}" min="0.5" max="6" step="0.5"></label>
        </div>
        <label class="radio"><input type="checkbox" id="tk-oculto" ${t.oculto ? 'checked' : ''}> escondido dos jogadores</label>
        <button class="btn btn-ghost btn-perigo-texto" id="tk-apagar" type="button">Tirar do mapa</button>`,
      confirmar: 'Salvar',
      onConfirmar: async () => {
        const campos = {
          nome: $('#tk-nome').value.trim(),
          escala: Math.max(.5, num($('#tk-escala').value, 1)),
          oculto: $('#tk-oculto').checked
        };
        Object.assign(t, campos);
        this.renderTokens();
        try { await Nuvem.salvarToken(t.id, campos); }
        catch (e) { toast('Erro: ' + (e.message || e), 'erro'); }
      }
    });
    $('#tk-apagar').addEventListener('click', async () => {
      Modal.fechar();
      await Nuvem.apagarToken(t.id);
      this.tokens = this.tokens.filter(x => x.id !== t.id);
      this.renderTokens();
    });
  },

  /* ---------------- realtime ---------------- */

  mudouMapa(payload) {
    const { eventType, new: novo, old: antigo } = payload;
    if (eventType === 'DELETE') {
      this.lista = this.lista.filter(m => m.id !== antigo.id);
      if (this.atual?.id === antigo.id) this.selecionar(this.lista[0] || null);
      return;
    }
    const i = this.lista.findIndex(m => m.id === novo.id);
    if (i >= 0) this.lista[i] = novo; else this.lista.push(novo);
    if (this.atual?.id === novo.id) {
      const trocouGrade = this.atual.colunas !== novo.colunas || this.atual.linhas !== novo.linhas
                       || this.atual.imagem !== novo.imagem;
      this.atual = novo;
      trocouGrade ? this.render() : (this.desenharFog(), this.renderBarra());
    } else if (novo.ativo && !App.ehMestre) {
      this.selecionar(novo);            // mestre trocou o mapa da mesa
    }
  },

  mudouToken(payload) {
    const { eventType, new: novo, old: antigo } = payload;
    if (!this.atual) return;
    if (eventType === 'DELETE') this.tokens = this.tokens.filter(t => t.id !== antigo.id);
    else if (novo.mapa_id === this.atual.id) {
      const i = this.tokens.findIndex(t => t.id === novo.id);
      if (i >= 0) this.tokens[i] = novo; else this.tokens.push(novo);
    }
    if (!this.arrastando) this.renderTokens();
  },

  /* posição chegando ao vivo enquanto outra pessoa arrasta */
  arrastouRemoto({ id, x, y }) {
    const t = this.tokens.find(x2 => x2.id === id);
    if (!t || this.arrastando?.t.id === id) return;
    t.x = x; t.y = y;
    const el = document.querySelector(`.token[data-token="${id}"]`);
    if (el) { el.style.left = x * 100 + '%'; el.style.top = y * 100 + '%'; }
  }
};

/* Mapas merecem mais resolução que retratos. */
function lerImagemGrande(arquivo) {
  return lerImagemMax(arquivo, 1600, 0.85);
}
