/* Saldos dos personagens. Escritas são sempre RPCs atômicas e autorizadas no banco. */

const Financas = {
  saldos: new Map(),
  verbaDiariaCentavos: 10000,
  carregando: false,

  formatar(centavos) {
    return (Number(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  centavosDoCampo(seletor) {
    const campo = $(seletor);
    const valor = campo?.valueAsNumber;
    return Number.isFinite(valor) ? Math.round(valor * 100) : NaN;
  },

  saldo(personagemId) { return Number(this.saldos.get(personagemId) || 0); },
  podeVer(p) { return Store.ehMestre || p.donoId === App.sessao?.user?.id; },
  ativos() { return Store.estado.personagens.filter(p => !p.rapido); },

  async carregar(mesaId = Store.mesaId, ehMestre = Store.ehMestre) {
    if (!mesaId) return;
    const carga = this.carga = (this.carga || 0) + 1;
    const dados = await Nuvem.carregarFinancas(mesaId, ehMestre);
    if (Store.mesaId !== mesaId || carga !== this.carga) return;
    this.saldos = new Map(dados.saldos.map(s => [s.personagem_id, Number(s.saldo_centavos)]));
    this.verbaDiariaCentavos = Number(dados.verbaDiariaCentavos);
  },

  async recarregar() {
    await this.carregar(Store.mesaId, Store.ehMestre);
    if (App.telaAtual === 'mesa') Mesa.render();
  },

  renderPainel() {
    const painel = $('#financas-painel');
    if (!painel) return;
    painel.hidden = !Store.ehMestre;
    $('#financas-verba-atual').textContent = `Verba diária: ${this.formatar(this.verbaDiariaCentavos)}`;
  },

  mudancaRemota(payload) {
    const linha = payload.new || payload.old;
    if (!linha?.personagem_id) return;
    if (payload.eventType === 'DELETE') this.saldos.delete(linha.personagem_id);
    else this.saldos.set(linha.personagem_id, Number(linha.saldo_centavos));
    if (App.telaAtual === 'mesa') Mesa.render();
  },

  configurar() {
    if (!Store.ehMestre) return;
    Modal.abrir({
      titulo: 'Configurar verba diária',
      corpo: `<p class="dialogo">Este será o valor somado ao saldo de cada personagem ativo.</p>
        <label class="campo"><span>Valor da verba</span><input id="fin-verba" type="number" min="0" max="1000000000" step="0.01" value="${(this.verbaDiariaCentavos / 100).toFixed(2)}" required></label>
        <p id="fin-erro" class="auth-erro" role="alert"></p>`,
      confirmar: 'Salvar valor',
      onConfirmar: async () => {
        const valor = this.centavosDoCampo('#fin-verba');
        if (!Number.isSafeInteger(valor) || valor < 0) { $('#fin-erro').textContent = 'Informe um valor válido.'; return false; }
        const botao = $('[data-modal-ok]'); botao.disabled = true;
        try {
          await Nuvem.configurarVerbaDiaria(Store.mesaId, valor);
          this.verbaDiariaCentavos = valor; this.renderPainel(); toast('Verba diária atualizada.');
        } catch (e) { $('#fin-erro').textContent = 'Não consegui salvar: ' + (e.message || e); return false; }
        finally { botao.disabled = false; }
      }
    });
  },

  adicionarVerba() {
    if (!Store.ehMestre) return;
    const ativos = this.ativos(), operacao = crypto.randomUUID();
    let enviando = false;
    Modal.abrir({
      titulo: 'Adicionar Verba Diária',
      corpo: `<p class="dialogo">Adicionar <b>${this.formatar(this.verbaDiariaCentavos)}</b> ao saldo individual de <b>${ativos.length} personagem(ns)</b>? O valor será acumulado.</p>
        <label class="campo"><span>Motivo (opcional)</span><input id="fin-motivo" maxlength="500" placeholder="Ex.: verba do dia 12"></label>
        <p id="fin-erro" class="auth-erro" role="alert"></p>`,
      confirmar: 'Adicionar a todos',
      onConfirmar: async () => {
        if (enviando) return false;
        enviando = true; const botao = $('[data-modal-ok]'); botao.disabled = true;
        try {
          const r = await Nuvem.aplicarVerbaDiaria(Store.mesaId, $('#fin-motivo').value.trim(), operacao);
          await this.recarregar();
          toast(`${this.formatar(r.valor_centavos)} adicionado a ${r.afetados} personagem(ns).`);
        } catch (e) { $('#fin-erro').textContent = 'Não consegui adicionar: ' + (e.message || e); return false; }
        finally { enviando = false; botao.disabled = false; }
      }
    });
  },

  descontarTodos() {
    if (!Store.ehMestre) return;
    const ativos = this.ativos(), operacao = crypto.randomUUID();
    let enviando = false;
    Modal.abrir({
      titulo: 'Descontar de Todos',
      corpo: `<p class="dialogo">O desconto será aplicado ao saldo individual de <b>${ativos.length} personagem(ns)</b>.</p>
        <label class="campo"><span>Valor por personagem</span><input id="fin-valor" type="number" min="0.01" max="1000000000" step="0.01" placeholder="25,00" required></label>
        <label class="campo"><span>Motivo (opcional)</span><input id="fin-motivo" maxlength="500" placeholder="Ex.: refeições e hospedagem"></label>
        <div id="fin-confirmacao" class="dialogo fraco">Informe o valor para conferir os saldos.</div>
        <p id="fin-erro" class="auth-erro" role="alert"></p>`,
      confirmar: 'Descontar de todos', perigo: true,
      onConfirmar: async () => {
        if (enviando) return false;
        const valor = this.centavosDoCampo('#fin-valor');
        if (!Number.isSafeInteger(valor) || valor <= 0) { this.mostrarPreviaDesconto(); return false; }
        const insuficientes = ativos.filter(p => this.saldo(p.id) < valor);
        if (insuficientes.length) { this.mostrarPreviaDesconto(); return false; }
        enviando = true; const botao = $('[data-modal-ok]'); botao.disabled = true;
        try {
          const r = await Nuvem.descontarTodos(Store.mesaId, valor, $('#fin-motivo').value.trim(), operacao);
          await this.recarregar();
          toast(`${this.formatar(r.valor_centavos)} descontado de ${r.afetados} personagem(ns).`);
        } catch (e) { $('#fin-erro').textContent = 'Operação não executada: ' + (e.message || e); return false; }
        finally { enviando = false; botao.disabled = false; }
      }
    });
    $('#fin-valor').addEventListener('input', () => this.mostrarPreviaDesconto());
  },

  mostrarPreviaDesconto() {
    const valor = this.centavosDoCampo('#fin-valor'), ativos = this.ativos();
    const el = $('#fin-confirmacao'), erro = $('#fin-erro');
    erro.textContent = '';
    if (!Number.isSafeInteger(valor) || valor <= 0) { el.textContent = 'Informe um valor maior que zero.'; return; }
    const insuficientes = ativos.filter(p => this.saldo(p.id) < valor);
    if (insuficientes.length) {
      el.innerHTML = `<b>Operação bloqueada.</b> Saldo insuficiente: ${insuficientes.map(p => `${esc(p.nome || 'Sem nome')} (${this.formatar(this.saldo(p.id))})`).join(', ')}.`;
      return;
    }
    el.innerHTML = `Confirma o desconto de <b>${this.formatar(valor)}</b> de <b>${ativos.length} personagem(ns)</b>?`;
  },

  ajustar(personagemId) {
    if (!Store.ehMestre) return;
    const p = Store.obter(personagemId);
    if (!p || p.rapido) return;
    const operacao = crypto.randomUUID(); let enviando = false;
    Modal.abrir({
      titulo: `Saldo de ${p.nome || 'personagem'}`,
      corpo: `<p class="dialogo">Saldo atual: <b>${this.formatar(this.saldo(p.id))}</b></p>
        <label class="campo"><span>Operação</span><select id="fin-tipo"><option value="1">Adicionar</option><option value="-1">Remover</option></select></label>
        <label class="campo"><span>Valor</span><input id="fin-valor" type="number" min="0.01" max="1000000000" step="0.01" required></label>
        <label class="campo"><span>Motivo (opcional)</span><input id="fin-motivo" maxlength="500"></label>
        <p id="fin-erro" class="auth-erro" role="alert"></p>`,
      confirmar: 'Confirmar ajuste',
      onConfirmar: async () => {
        if (enviando) return false;
        const absoluto = this.centavosDoCampo('#fin-valor');
        const valor = absoluto * Number($('#fin-tipo').value);
        if (!Number.isSafeInteger(absoluto) || absoluto <= 0) { $('#fin-erro').textContent = 'Informe um valor maior que zero.'; return false; }
        if (valor < 0 && this.saldo(p.id) < absoluto) { $('#fin-erro').textContent = `Saldo insuficiente. Disponível: ${this.formatar(this.saldo(p.id))}.`; return false; }
        enviando = true; const botao = $('[data-modal-ok]'); botao.disabled = true;
        try {
          const r = await Nuvem.ajustarSaldoPersonagem(p.id, valor, $('#fin-motivo').value.trim(), operacao);
          this.saldos.set(p.id, Number(r.saldo_centavos)); Mesa.render(); toast('Saldo atualizado.');
        } catch (e) { $('#fin-erro').textContent = 'Não consegui ajustar: ' + (e.message || e); return false; }
        finally { enviando = false; botao.disabled = false; }
      }
    });
  },

  async historico() {
    if (!Store.ehMestre) return;
    Modal.abrir({ titulo: 'Histórico financeiro', largo: true,
      corpo: '<div id="fin-historico" class="fin-historico"><p class="vazio-linha">Carregando…</p></div>',
      confirmar: 'Fechar', cancelar: 'Voltar', onConfirmar: () => {} });
    const raiz = $('#fin-historico');
    try {
      const itens = await Nuvem.historicoFinanceiro(Store.mesaId);
      if ($('#fin-historico') !== raiz) return;
      raiz.innerHTML = itens.length ? itens.map(t => {
        const d = new Date(t.criado_em), positivo = Number(t.valor_centavos) > 0;
        return `<div class="fin-transacao"><time>${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</time>
          <b>${esc(t.personagem_nome)}</b><strong class="${positivo ? 'positivo' : 'negativo'}">${positivo ? '+' : '−'} ${this.formatar(Math.abs(Number(t.valor_centavos)))}</strong>
          <span>${esc(t.motivo || 'Sem motivo')} · por ${esc(t.responsavel_nome)}</span><small>Saldo após: ${this.formatar(t.saldo_apos_centavos)}</small></div>`;
      }).join('') : '<p class="vazio-linha">Nenhuma transação registrada.</p>';
    } catch (e) { raiz.innerHTML = `<p class="vazio-linha">Não consegui carregar: ${esc(e.message || e)}</p>`; }
  }
};

document.addEventListener('click', e => {
  if (e.target.closest('#btn-verba-diaria')) return Financas.adicionarVerba();
  if (e.target.closest('#btn-descontar-todos')) return Financas.descontarTodos();
  if (e.target.closest('#btn-configurar-verba')) return Financas.configurar();
  if (e.target.closest('#btn-historico-financeiro')) return Financas.historico();
});
