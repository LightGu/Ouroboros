const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let salvos = 0;
const ctx = vm.createContext({ Store: { podeEditar: () => true, salvar: () => salvos++ }, $: () => null });
vm.runInContext(fs.readFileSync('js/ficha.js', 'utf8') + '\nglobalThis.F = Ficha;', ctx);
const F = ctx.F;
F.abrir = () => {};
F.atual = { id:'p', inventario:{ itens:[
  {nome:'Zebra',categoria:'IV',espacos:'10'},
  {nome:'Água',categoria:'II',espacos:'2'},
  {nome:'Bastão',categoria:'I',espacos:'0,5'},
  {nome:'Vazio',categoria:'',espacos:''}
]}, habilidades:[{nome:'Z',custo:'10 PE',pagina:'p. 100'}, {nome:'A',custo:'2 PE',pagina:'p. 20'}],
rituais:[{nome:'B',circulo:'3',elemento:'Sangue'},{nome:'A',circulo:'1',elemento:'Morte'}] };
const vals = (lista,chave) => Array.from(lista, x => x[chave]);
F.ordenarLista('itens','nome');
assert.deepEqual(vals(F.atual.inventario.itens,'nome'), ['Água','Bastão','Vazio','Zebra']);
F.ordenarLista('itens','nome');
assert.deepEqual(vals(F.atual.inventario.itens,'nome'), ['Zebra','Vazio','Bastão','Água']);
F.ordenarLista('itens','categoria');
assert.deepEqual(vals(F.atual.inventario.itens,'categoria'), ['I','II','IV','']);
F.ordenarLista('itens','espacos');
assert.deepEqual(vals(F.atual.inventario.itens,'espacos'), ['0,5','2','10','']);
F.ordenarLista('itens','espacos');
assert.deepEqual(vals(F.atual.inventario.itens,'espacos'), ['10','2','0,5','']);
F.ordenarLista('habilidades','custo');
assert.deepEqual(vals(F.atual.habilidades,'custo'), ['2 PE','10 PE']);
F.ordenarLista('habilidades','pagina');
assert.deepEqual(vals(F.atual.habilidades,'pagina'), ['p. 20','p. 100']);
F.ordenarLista('rituais','circulo');
assert.deepEqual(vals(F.atual.rituais,'circulo'), ['1','3']);
assert.equal(salvos,8);
ctx.Store.podeEditar = () => false;
F.ordenarLista('rituais','circulo');
assert.equal(salvos,8);
assert.deepEqual(vals(F.atual.rituais,'circulo'), ['1','3']);
console.log('Ordenação: nome, categorias, números, campos vazios, alternância e permissão passaram.');
