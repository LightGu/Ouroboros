/* Aba de logs + avisos em tempo real (só o mestre enxerga) */

const Logs = {
  itens: [],
  naoLidos: 0,

  confirmarLimpeza(tipo = 'logs') {
    if (!App.ehMestre || !App.mesa || !['logs', 'rolagens'].includes(tipo)) return;
    const mesaId = App.mesa.id;
    let limpando = false;
    Modal.abrir({
      titulo: tipo === 'logs' ? 'Limpar logs gerais' : 'Limpar rolagens',
      corpo: `<p>Apagar todo o histórico de ${tipo === 'logs' ? 'logs gerais' : 'rolagens, incluindo as secretas'} desta mesa? Esta ação não pode ser desfeita.</p><p id="limpar-historico-erro" role="alert"></p>`,
      confirmar: 'Apagar histórico',
      onConfirmar: async () => {
        if (limpando || App.mesa?.id !== mesaId || !App.ehMestre) return false;
        limpando = true;
        const botao = $('[data-modal-ok]'), erro = $('#limpar-historico-erro');
        botao.disabled = true;
        try {
          await Nuvem.limparHistorico(mesaId, tipo);
          if (App.mesa?.id === mesaId) {
            if (tipo === 'logs') { this.limparBadge(); await this.carregar(); }
            else await Rolagem.carregar();
            toast('Histórico apagado.');
          }
          return $('#limpar-historico-erro') === erro;
        } catch (e) { erro.textContent = 'Não consegui limpar: ' + (e.message || e); return false; }
        finally { limpando = false; botao.disabled = false; }
      }
    });
  },

  async carregar() {
    if (!App.ehMestre) return;
    const mesaId = App.mesa?.id;
    const carga = this.carga = (this.carga || 0) + 1;
    try {
      const itens = await Nuvem.logs(mesaId);
      if (App.mesa?.id !== mesaId || this.carga !== carga) return;
      this.itens = itens;
      this.render();
    } catch (e) {
      if (App.mesa?.id !== mesaId || this.carga !== carga) return;
      $('#logs-lista').innerHTML = `<p class="vazio-linha">Não consegui carregar: ${esc(e.message || e)}</p>`;
    }
  },

  render() {
    const busca = $('#logs-busca').value.trim().toLowerCase();
    const lista = busca
      ? this.itens.filter(l => (
          (l.personagem_nome || '') + ' ' + (l.autor_nome || '') + ' ' +
          (l.detalhe || '') + ' ' + this.rotulo(l.acao)
        ).toLowerCase().includes(busca))
      : this.itens;

    if (!lista.length) {
      $('#logs-lista').innerHTML = `<p class="vazio-linha">${
        this.itens.length ? 'Nada bate com esse filtro.' : 'Nada aconteceu na mesa ainda.'}</p>`;
      return;
    }

    let diaAtual = '';
    const html = lista.map(l => {
      const d = new Date(l.criado_em);
      const dia = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      const cabecalho = dia !== diaAtual ? `<h3 class="logs-dia">${esc(dia)}</h3>` : '';
      diaAtual = dia;
      return cabecalho + `
        <div class="log-item log-${esc(l.acao)}">
          <span class="log-hora">${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          <span class="log-acao">${this.rotulo(l.acao)}</span>
          <span class="log-texto">
            <b>${esc(l.autor_nome || 'alguém')}</b> — ${esc(l.personagem_nome || 'sem nome')}
            <em>${esc(l.detalhe || '')}</em>
          </span>
        </div>`;
    }).join('');

    $('#logs-lista').innerHTML = html;
  },

  rotulo(acao) {
    return { vida: 'VIDA', ficha: 'FICHA', criou: 'CRIOU', removeu: 'REMOVEU' }[acao] || acao.toUpperCase();
  },

  /* chega um log novo pelo realtime */
  receber(log) {
    if (!App.ehMestre) return;
    this.itens.unshift(log);
    if (App.telaAtual === 'logs') { this.render(); return; }

    this.naoLidos++;
    const badge = $('#badge-logs');
    badge.textContent = this.naoLidos;
    badge.hidden = false;

    /* não avisa do que o próprio mestre acabou de fazer */
    if (log.autor_id !== App.sessao.user.id) this.aviso(log);
  },

  /* o pop-upzinho do canto */
  aviso(log) {
    const el = document.createElement('div');
    el.className = 'aviso aviso-' + log.acao;
    el.innerHTML = `
      <span class="aviso-acao">${this.rotulo(log.acao)}</span>
      <span class="aviso-texto"><b>${esc(log.autor_nome || 'alguém')}</b> · ${esc(log.personagem_nome || '')}<br>
        <em>${esc(log.detalhe || '')}</em></span>
      <button class="aviso-x" title="Fechar">✕</button>`;

    el.addEventListener('click', e => {
      if (e.target.closest('.aviso-x')) return el.remove();
      App.mostrar('logs');
      el.remove();
    });

    $('#avisos').prepend(el);
    while ($('#avisos').children.length > 4) $('#avisos').lastElementChild.remove();
    setTimeout(() => el.classList.add('saindo'), 7000);
    setTimeout(() => el.remove(), 7600);
  },

  limparBadge() {
    this.naoLidos = 0;
    $('#badge-logs').hidden = true;
  }
};
