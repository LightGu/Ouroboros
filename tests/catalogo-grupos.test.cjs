const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync('js/catalogo.js', 'utf8') + '\nglobalThis.api = Catalogo;', ctx);
const catalogo = ctx.api;
const antigos = [
  {nome:'Amarras elementais', livro:'Livro Básico', grupo:'Equipamento', categoria:1},
  {nome:'Crânio Dominador', livro:'Arquivos Secretos 3', grupo:'Amaldiçoado'},
  {nome:'Medidor de Condição Vertebral', livro:'Sobrevivendo ao Horror', grupo:'Catalisador'},
  {nome:'A Antena', livro:'Arquivos Secretos 2', grupo:'Amaldiçoado'},
  {nome:'Incenso', livro:'Arquivos Secretos 2', grupo:'Equipamento'},
  {nome:'Crânio Dominador', livro:'Caseiro', grupo:'Equipamento'}
];
catalogo.itens = catalogo.corrigirGrupos(antigos);
assert.equal(catalogo.filtrar({grupo:'Itens paranormais'}).length, 7);
assert.equal(catalogo.filtrar({grupo:'Amaldiçoado'})[0].nome, 'A Antena');
assert.equal(catalogo.filtrar({grupo:'Equipamento'}).length, 2);
assert.ok(catalogo.grupos().includes('Itens paranormais'));
assert.equal(catalogo.filtrar({grupo:'Itens paranormais', busca:'amarras', categoria:1}).length, 1);
assert.equal(catalogo.paraItemDaFicha(catalogo.itens[0]).categoria, 'I');
assert.equal(antigos[0].grupo, 'Equipamento');
assert.equal(JSON.stringify(catalogo.corrigirGrupos(catalogo.itens)), JSON.stringify(catalogo.itens));
console.log('Catálogo: classificação, filtros, origem, idempotência e categoria passaram.');

const corrigidos=catalogo.corrigirGrupos([
 {nome:'Ampliador',livro:'Sobrevivendo ao Horror',grupo:'Itens paranormais'},
 {nome:'Catalisador Sofisticado e Horrorizado',livro:'Arquivos Secretos 2',grupo:'Amaldiçoado'},
 {nome:'Pé de Morto',livro:'Sobrevivendo ao Horror',grupo:'Catalisador'},
 {nome:'Medo',livro:'Sobrevivendo ao Horror',grupo:'Itens paranormais'},
 {nome:'Medo',livro:'Caseiro',grupo:'Equipamento'}
]);
assert.equal(corrigidos[0].grupo,'Catalisadores');
assert.equal(corrigidos[1].grupo,'Catalisadores');
assert.equal(corrigidos[2].grupo,'Itens paranormais');
assert.equal(corrigidos.filter(i=>i.nome==='Medo').length,1);
const item={nome:'Lanterna',grupo:'Equipamento',descricao:'Ilumina o local. Texto completo.',livro:'Teste',pagina:'9'};
catalogo.itens=[item];
assert.equal(catalogo.paraItemDaFicha(item).descricao,item.descricao);
assert.equal(catalogo.descricaoItem({nome:'Lanterna'}),item.descricao);
assert.equal(catalogo.descricaoItem({nome:'Lanterna',descricao:'Texto do jogador'}),'Texto do jogador');
assert.equal(catalogo.descricaoItem({nome:'Lanterna',livro:'Outro'}),'');
