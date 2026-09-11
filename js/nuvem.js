/* Camada de acesso ao Supabase: auth, mesas, personagens, logs, retratos */

const Nuvem = {
  cliente: null,
  canal: null,

  configurado() {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  },

  iniciar() {
    if (!this.configurado()) return false;
    this.cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return true;
  },

  /* ---------------- auth ---------------- */

  async sessao() {
    const { data } = await this.cliente.auth.getSession();
    return data.session;
  },

  async cadastrar(nome, email, senha) {
    const { data, error } = await this.cliente.auth.signUp({
      email, password: senha, options: { data: { nome } }
    });
    if (error) throw error;
    return data;
  },

  async entrar(email, senha) {
    const { data, error } = await this.cliente.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
    return data;
  },

  async sair() {
    await this.desassinar();
    await this.cliente.auth.signOut();
  },

  async perfil(userId) {
    const { data } = await this.cliente.from('perfis').select('*').eq('id', userId).maybeSingle();
    return data;
  },

  async renomearPerfil(nome) {
    const { error } = await this.cliente.from('perfis')
      .update({ nome }).eq('id', App.sessao.user.id);
    if (error) throw error;
  },

  /* ---------------- mesas ---------------- */

  async mesas() {
    const { data, error } = await this.cliente.rpc('minhas_mesas');
    if (error) throw error;
    return data || [];
  },

  async criarMesa(nome) {
    const { data, error } = await this.cliente.rpc('criar_mesa', { p_nome: nome });
    if (error) throw error;
    return data;
  },

  async entrarMesa(codigo) {
    const { data, error } = await this.cliente.rpc('entrar_na_mesa', { p_codigo: codigo });
    if (error) throw error;
    return data;
  },

  async membros(mesaId) {
    const { data, error } = await this.cliente
      .from('membros').select('user_id, papel, perfis(nome)').eq('mesa_id', mesaId);
    if (error) throw error;
    return (data || []).map(m => ({ id: m.user_id, papel: m.papel, nome: m.perfis?.nome || 'Agente' }));
  },

  /* ---------------- personagens ---------------- */

  /* linha do banco -> objeto usado pela interface */
  paraApp(linha, notas = '') {
    const p = Store.normalizar(Object.assign({}, linha.dados, { id: linha.id }));
    p.rapido  = linha.rapido;
    p.oculto  = linha.oculto;
    p.donoId  = linha.dono_id;
    p.ordem   = linha.ordem;
    p.notas   = notas;
    return p;
  },

  /* objeto da interface -> linha do banco (notas ficam de fora de propósito) */
  paraBanco(p, mesaId) {
    const dados = JSON.parse(JSON.stringify(p));
    delete dados.notas;
    delete dados.donoId;
    delete dados.ordem;
    delete dados.oculto;
    return {
      id: p.id,
      mesa_id: mesaId,
      dono_id: p.donoId || null,
      ordem: num(p.ordem),
      rapido: Boolean(p.rapido),
      oculto: Boolean(p.oculto),
      dados
    };
  },

  async carregarPersonagens(mesaId, ehMestre) {
    const { data, error } = await this.cliente
      .from('personagens').select('*').eq('mesa_id', mesaId).order('ordem');
    if (error) throw error;

    let notas = {};
    if (ehMestre) {
      const { data: n } = await this.cliente.from('notas_mestre').select('*').eq('mesa_id', mesaId);
      (n || []).forEach(x => { notas[x.personagem_id] = x.texto; });
    }
    return (data || []).map(l => this.paraApp(l, notas[l.id] || ''));
  },

  async criarPersonagem(p, mesaId) {
    const linha = this.paraBanco(p, mesaId);
    delete linha.id;                       // deixa o banco gerar o uuid
    const { data, error } = await this.cliente.from('personagens').insert(linha).select().single();
    if (error) throw error;
    return data.id;
  },

  async salvarPersonagem(p, mesaId) {
    const { error } = await this.cliente
      .from('personagens').update(this.paraBanco(p, mesaId)).eq('id', p.id);
    if (error) throw error;
  },

  async salvarNotas(p, mesaId) {
    const { error } = await this.cliente.from('notas_mestre')
      .upsert({ personagem_id: p.id, mesa_id: mesaId, texto: p.notas || '' });
    if (error) throw error;
  },

  async removerPersonagem(id) {
    const { error } = await this.cliente.from('personagens').delete().eq('id', id);
    if (error) throw error;
  },

  async salvarOrdem(lista) {
    const atualizacoes = lista.map((p, i) =>
      this.cliente.from('personagens').update({ ordem: i }).eq('id', p.id));
    const res = await Promise.all(atualizacoes);
    const falha = res.find(r => r.error);
    if (falha) throw falha.error;
  },

  /* ---------------- retratos ---------------- */

  async enviarRetrato(dataUrl, mesaId, personagemId) {
    const blob = await (await fetch(dataUrl)).blob();
    const caminho = `${mesaId}/${personagemId}-${Date.now()}.jpg`;
    const { error } = await this.cliente.storage
      .from('retratos').upload(caminho, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data } = this.cliente.storage.from('retratos').getPublicUrl(caminho);
    return data.publicUrl;
  },

  /* ---------------- logs ---------------- */

  async logs(mesaId, limite = 200) {
    const { data, error } = await this.cliente
      .from('logs').select('*').eq('mesa_id', mesaId)
      .order('criado_em', { ascending: false }).limit(limite);
    if (error) throw error;
    return data || [];
  },

  /* ---------------- rolagens ---------------- */

  async criarRolagem(r) {
    const { error } = await this.cliente.from('rolagens').insert(r);
    if (error) throw error;
  },

  async rolagens(mesaId, limite = 60) {
    const { data, error } = await this.cliente.from('rolagens').select('*')
      .eq('mesa_id', mesaId).order('criado_em', { ascending: false }).limit(limite);
    if (error) throw error;
    return data || [];
  },

  /* ---------------- combate compartilhado ---------------- */

  async salvarCombate(mesaId, combate) {
    const { error } = await this.cliente.from('mesas').update({ combate }).eq('id', mesaId);
    if (error) throw error;
  },

  async lerCombate(mesaId) {
    const { data } = await this.cliente.from('mesas').select('combate').eq('id', mesaId).maybeSingle();
    return data?.combate || { ativo: false, indice: 0, rodada: 1 };
  },

  /* ---------------- mapas e tokens ---------------- */

  async mapas(mesaId) {
    const { data, error } = await this.cliente.from('mapas').select('*')
      .eq('mesa_id', mesaId).order('criado_em');
    if (error) throw error;
    return data || [];
  },

  async criarMapa(mesaId, nome, imagem, colunas, linhas) {
    const { data, error } = await this.cliente.from('mapas')
      .insert({ mesa_id: mesaId, nome, imagem, colunas, linhas, fog: '0'.repeat(colunas * linhas) })
      .select().single();
    if (error) throw error;
    return data;
  },

  async salvarMapa(id, campos) {
    const { error } = await this.cliente.from('mapas').update(campos).eq('id', id);
    if (error) throw error;
  },

  async apagarMapa(id) {
    const { error } = await this.cliente.from('mapas').delete().eq('id', id);
    if (error) throw error;
  },

  async ativarMapa(mesaId, id) {
    await this.cliente.from('mapas').update({ ativo: false }).eq('mesa_id', mesaId);
    const { error } = await this.cliente.from('mapas').update({ ativo: true }).eq('id', id);
    if (error) throw error;
  },

  async tokens(mapaId) {
    const { data, error } = await this.cliente.from('tokens').select('*').eq('mapa_id', mapaId);
    if (error) throw error;
    return data || [];
  },

  async criarToken(t) {
    const { data, error } = await this.cliente.from('tokens').insert(t).select().single();
    if (error) throw error;
    return data;
  },

  async salvarToken(id, campos) {
    const { error } = await this.cliente.from('tokens').update(campos).eq('id', id);
    if (error) throw error;
  },

  async apagarToken(id) {
    const { error } = await this.cliente.from('tokens').delete().eq('id', id);
    if (error) throw error;
  },

  async enviarImagemMapa(dataUrl, mesaId) {
    const blob = await (await fetch(dataUrl)).blob();
    const caminho = `${mesaId}/mapa-${Date.now()}.jpg`;
    const { error } = await this.cliente.storage
      .from('retratos').upload(caminho, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    return this.cliente.storage.from('retratos').getPublicUrl(caminho).data.publicUrl;
  },

  /* ---------------- sons ---------------- */

  async sons(mesaId) {
    const { data, error } = await this.cliente.from('sons').select('*')
      .eq('mesa_id', mesaId).order('ordem');
    if (error) throw error;
    return data || [];
  },

  async enviarSom(arquivo, mesaId) {
    const ext = (arquivo.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
    const caminho = `${mesaId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await this.cliente.storage
      .from('sons').upload(caminho, arquivo, { contentType: arquivo.type || 'audio/mpeg' });
    if (error) throw error;
    return { caminho, url: this.cliente.storage.from('sons').getPublicUrl(caminho).data.publicUrl };
  },

  async criarSom(som) {
    const { data, error } = await this.cliente.from('sons').insert(som).select().single();
    if (error) throw error;
    return data;
  },

  async salvarSom(id, campos) {
    const { error } = await this.cliente.from('sons').update(campos).eq('id', id);
    if (error) throw error;
  },

  async apagarSom(som) {
    if (som.caminho) await this.cliente.storage.from('sons').remove([som.caminho]);
    const { error } = await this.cliente.from('sons').delete().eq('id', som.id);
    if (error) throw error;
  },

  async salvarOrdemSons(lista) {
    const res = await Promise.all(lista.map((s, i) =>
      this.cliente.from('sons').update({ ordem: i }).eq('id', s.id)));
    const falha = res.find(r => r.error);
    if (falha) throw falha.error;
  },

  /* ---------------- caderno de campanha ---------------- */

  async anotacoes(mesaId) {
    const { data, error } = await this.cliente.from('anotacoes').select('*')
      .eq('mesa_id', mesaId).order('atualizado_em', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async criarAnotacao(a) {
    const { data, error } = await this.cliente.from('anotacoes').insert(a).select().single();
    if (error) throw error;
    return data;
  },

  async salvarAnotacao(id, campos) {
    const { error } = await this.cliente.from('anotacoes').update(campos).eq('id', id);
    if (error) throw error;
  },

  async apagarAnotacao(id) {
    const { error } = await this.cliente.from('anotacoes').delete().eq('id', id);
    if (error) throw error;
  },

  /* Arrastar token: manda por broadcast (não toca no banco) e só grava no fim. */
  transmitir(evento, dados) {
    if (this.canal) this.canal.send({ type: 'broadcast', event: evento, payload: dados });
  },

  /* ---------------- realtime ---------------- */

  /* `aoLigar` dispara quando o Postgres confirma a inscrição — inclusive depois
     de uma reconexão. Tudo que mudou enquanto o canal estava fora chega junto,
     então é aí que o app recarrega a mesa pra não ficar desatualizado calado. */
  assinar(mesaId, { aoMudarPersonagem, aoChegarLog, aoRolar, aoMudarMapa, aoMudarToken, aoMudarMesa, aoArrastar, aoMudarSom, aoMudarAnotacao, aoLigar, aoCair }) {
    this.desassinar();
    this.canal = this.cliente.channel('mesa-' + mesaId)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'personagens', filter: `mesa_id=eq.${mesaId}` },
          payload => aoMudarPersonagem?.(payload))
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'logs', filter: `mesa_id=eq.${mesaId}` },
          payload => aoChegarLog?.(payload.new))
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'rolagens', filter: `mesa_id=eq.${mesaId}` },
          payload => aoRolar?.(payload.new))
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'mapas', filter: `mesa_id=eq.${mesaId}` },
          payload => aoMudarMapa?.(payload))
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'tokens', filter: `mesa_id=eq.${mesaId}` },
          payload => aoMudarToken?.(payload))
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'mesas', filter: `id=eq.${mesaId}` },
          payload => aoMudarMesa?.(payload.new))
      .on('broadcast', { event: 'arrastando' }, ({ payload }) => aoArrastar?.(payload))
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'sons', filter: `mesa_id=eq.${mesaId}` },
          payload => aoMudarSom?.(payload))
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'anotacoes', filter: `mesa_id=eq.${mesaId}` },
          payload => aoMudarAnotacao?.(payload))
      .on('system', {}, p => {
        if (p.extension === 'postgres_changes' && p.status === 'ok') aoLigar?.();
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') aoCair?.(status);
      });
  },

  async desassinar() {
    if (this.canal) { await this.cliente.removeChannel(this.canal); this.canal = null; }
  }
};
