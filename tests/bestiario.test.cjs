const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ctx = vm.createContext({ console, App: { sessao: { user: { id: 'mestre' } } }, crypto: { randomUUID: () => 'imagem' } });
vm.runInContext(['js/bestiario.js', 'js/nuvem.js'].map(p => fs.readFileSync(p, 'utf8')).join('\n') + '\nglobalThis.api = { Bestiario, Nuvem };', ctx);
const { Bestiario: B, Nuvem: N } = ctx.api;
B.lista = [
  { name: 'Criatura Ágil', element: 'Sangue', vd: 0, type: 'Animal', tags: ['floresta'], notes: 'segredo' },
  { name: 'Sombra', element: 'Morte', vd: 40, type: 'Paranormal', tags: ['chefe'] }
];
B.filtros = { name: 'AGIL' }; assert.equal(B.filtrar().length, 1);
B.filtros = { name: 'segredo' }; assert.equal(B.filtrar().length, 0); // Busca somente no nome.
B.filtros = { element: 'Sangue', vd: '0', type: 'Animal', tags: 'floresta' }; assert.equal(B.filtrar().length, 1);
B.filtros.tags = 'chefe'; assert.equal(B.filtrar().length, 0);
(async () => {
  let uploads = 0, removes = 0, payload;
  const bucket = { upload: async () => { uploads++; return {}; }, remove: async () => { removes++; return {}; } };
  N.cliente = { storage: { from: name => { assert.equal(name, 'bestiary-images'); return bucket; } },
    from: name => { assert.equal(name, 'bestiary'); return {
      insert: p => { payload = p; return { select: () => ({ single: async () => ({ data: { id: 'c', ...p } }) }) }; }
    }; }
  };
  await assert.rejects(() => N.criarCriatura({ name:'A' }, { type:'image/svg+xml', size:10 }));
  await assert.rejects(() => N.criarCriatura({ name:'A' }, { type:'image/png', size:21*1024*1024 }));
  assert.equal(uploads, 0);
  const file = { type:'image/png', size:20 };
  await N.criarCriatura({ name:'A' }, file);
  assert.equal(payload.owner_id, 'mestre');
  assert.equal(payload.image_path, 'mestre/imagem.png');
  N.cliente.from = () => ({
    insert: () => ({ select: () => ({ single: async () => ({ error: new Error('falhou') }) }) }),
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) })
  });
  await assert.rejects(() => N.criarCriatura({ name:'A' }, file), /falhou/);
  assert.equal(removes, 1);
  N.cliente.from = () => ({
    insert: () => ({ select: () => ({ single: async () => ({ error: new Error('resposta perdida') }) }) }),
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id:'salvo' } }) }) })
  });
  assert.equal((await N.criarCriatura({ name:'A' }, file)).id, 'salvo');
  assert.equal(removes, 1); // Não apaga imagem de cadastro confirmado.
  const filtros = [];
  N.cliente.from = () => ({ update: p => {
    payload = p;
    const query = { eq: (k,v) => { filtros.push([k,v]); return query; },
      select: () => ({ single: async () => ({data:{id:'c',...p}}) }) };
    return query;
  }});
  const atualizada = await N.criarCriatura({id:'c',name:'Não substituir',image_revision:2,notes:'Nova fonte'},file,true);
  assert.equal(atualizada.image_revision,2);
  assert.deepEqual(filtros,[['id','c'],['owner_id','mestre']]);
  assert.equal(payload.name,undefined); // Mantém os metadados editados pelo dono.
  assert.equal(removes,1); // A revisão não apaga o arquivo antigo.
  let paginas = 0;
  N.cliente.from = () => ({ select: () => ({ order() { return this; }, range: async () => ({ data: ++paginas === 1 ? Array(500).fill({ id:'c' }) : [{ id:'fim' }] }) }) });
  assert.equal((await N.bestiario()).length, 501);
  console.log('Bestiário: busca, filtros combinados, VD 0, upload, limpeza e paginação passaram.');
})().catch(e => { console.error(e); process.exitCode = 1; });
