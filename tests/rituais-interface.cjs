const fs=require('fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(root+'/index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
const code=['dados','ui','ajuda','store','mesa','catalogo','catalogo-rituais','regras','paineis','ficha'].map(f=>fs.readFileSync(root+'/js/'+f+'.js','utf8')).join('\n');
const checks=`
window.App={mostrar(){}};
const rituais=[
 {nome:'Ritual de teste',elemento:'sangue',elementos:['sangue'],circulo:1,execucao:'padrão',alcance:'toque',alvo:'1 ser',duracao:'cena',resistencia:'Vontade',descricao:'Efeito base. Discente (+2 PE): efeito maior.',livro:'Livro teste',pagina:'12'},
 {nome:'Ritual de teste',elemento:'sangue',elementos:['sangue'],circulo:1,livro:'Outro livro',pagina:'30'},
 {nome:'Passagem teste',elemento:'sangue/conhecimento',elementos:['sangue','conhecimento'],circulo:4,execucao:'1 dia',alcance:'extremo',alvo:'2 pessoas',duracao:'permanente',descricao:'Troca.',livro:'Livro teste',pagina:'50'},
 {nome:'Ritual variável',elemento:'varia',elementos:['sangue','morte','energia','conhecimento'],circulo:1,execucao:'padrão',alcance:'toque',alvo:'1 arma',duracao:'cena',livro:'Livro teste',pagina:'1'}
];
window.Nuvem={cliente:{},catalogoRituais:async()=>rituais};
const p=Store.normalizar({id:'p',nex:5,atributos:{PRE:3},descricao:{historico:'HISTORIA_SECRETA',personalidade:'PERSONALIDADE_SECRETA',objetivo:'OBJETIVO_SECRETO',aparencia:'APARENCIA_PUBLICA'}});
Store.estado={personagens:[p]};Store.podeEditar=()=>true;
let saves=0;Store.salvar=()=>{saves++;};Store.salvarAgora=async()=>{};
function check(v,msg){if(!v)throw Error(msg);}
function input(bind,value){const el=document.querySelector('[data-bind="'+bind+'"]');el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}
(async()=>{
 Ficha.abrir(p.id);
 input('pe.max','14');input('pe.atual','7');
 check(document.querySelector('[data-barra-numero="pe"]').textContent==='7/14','valor de PE na barra');
 check(document.querySelector('[data-barra="pe"]').style.width==='50%','preenchimento de PE');
 check(!document.querySelector('[data-bind$=".pagina"]'),'sem campos de página');
 check(document.querySelector('#dt-rituais').textContent==='14','DT inicial');
 input('nex','25');check(document.querySelector('#dt-rituais').textContent==='18','DT muda com NEX');
 input('atributos.PRE','4');input('dtRituaisBonus','2');check(document.querySelector('#dt-rituais').textContent==='21','DT PRE e bônus');
 input('nex','99');check(document.querySelector('#dt-rituais').textContent==='36','DT NEX 99');
 const antigo=Store.normalizar({dtRituais:'20',nex:5,atributos:{PRE:3}});
 check(antigo.dtRituaisBonus===6&&Regras.dtRituais(antigo)===20,'preserva DT antiga');
 check(Regras.dtRituais(Store.normalizar(antigo))===20,'migração idempotente');
 await CatalogoRituais.abrir(p);
 check(document.querySelectorAll('[data-rit-escolher]').length===4,'catálogo carregado');
 const detalhes=document.querySelector('.ritual-catalogo-detalhes');
 detalhes.querySelector('summary').click();
 check(CatalogoRituais.estado.escolhidos.size===0,'consultar ritual não seleciona');
 document.querySelector('[data-rit-escolher="0"]').click();
 check(detalhes.isConnected&&detalhes.open,'seleção preserva descrição aberta');
 check(detalhes.closest('.ritual-catalogo-item').classList.contains('ativo'),'card selecionado');
 check(document.querySelector('[data-modal-ok]').textContent==='Adicionar 1','seleção');
 await Modal.aoConfirmar();
 check(p.rituais.length===1&&p.rituais[0].desc.includes('Discente')&&p.rituais[0].custo==='1','importa campos e melhorias');
 await CatalogoRituais.abrir(p);
 check(document.querySelector('[data-rit-escolher="0"]').disabled&&document.querySelector('[data-rit-escolher="1"]').disabled,'bloqueia duplicata entre livros');
 const filtro=document.querySelector('[data-rit-filtro="elemento"]');filtro.value='conhecimento';filtro.dispatchEvent(new Event('change'));
 check(document.querySelectorAll('[data-rit-escolher]').length===2,'filtra múltiplos elementos');
 filtro.value='medo';filtro.dispatchEvent(new Event('change'));check(document.querySelectorAll('[data-rit-escolher]').length===0,'ritual variável não vira Medo');
 filtro.value='';filtro.dispatchEvent(new Event('change'));
 document.querySelector('[data-rit-escolher="2"]').click();await Modal.aoConfirmar();
 check(document.querySelector('[data-bind="rituais.1.execucao"]').value==='1 dia','execução especial preservada');
 check(document.querySelector('[data-bind="rituais.1.alcance"]').value==='extremo','alcance especial preservado');
 check(document.querySelector('[data-bind="rituais.1.elemento"]').value==='sangue/conhecimento','elemento duplo preservado');
 const itens=Catalogo.corrigirGrupos([]);check(itens.length===4&&itens.every(i=>i.categoria===0&&i.espacos===1&&i.grupo==='Itens paranormais'),'componentes');
 Catalogo.itens=itens;await Ficha.abrirCatalogo();
 check(document.querySelectorAll('.catalogo-descricao').length===4,'descrições acessíveis sem hover');
 document.querySelector('.catalogo-descricao summary').click();check(Ficha.catalogo.escolhidos.length===0,'consultar descrição não seleciona item');
 document.querySelector('[data-cat="0"]').click();await Modal.aoConfirmar();
 check(p.inventario.itens[0].nome===itens[0].nome&&p.inventario.itens[0].espacos==='1','componente adicionado');
 check(p.inventario.itens[0].descricao===itens[0].descricao,'descrição salva junto do item');
 check(document.querySelector('[data-bind="inventario.itens.0.descricao"]').value===itens[0].descricao,'descrição na ficha');
 document.querySelector('[data-editar-item]').click();
 check(document.querySelector('.item-descricao').classList.contains('editando'),'lápis abre edição');
 input('inventario.itens.0.descricao','Efeito específico do personagem');
 check(p.inventario.itens[0].descricao==='Efeito específico do personagem','salva descrição individual');
 check(Catalogo.itens[0].descricao!=='Efeito específico do personagem','preserva catálogo');
 check(document.querySelector('.item-descricao-texto').textContent==='Efeito específico do personagem','atualiza prévia');
 p.inventario.itens[0].descricao='';Ficha.abrir(p.id);await Ficha.carregarDescricoesInventario(p);
 check(document.querySelector('[data-bind="inventario.itens.0.descricao"]').value===itens[0].descricao,'consulta para item antigo');
 Store.podeEditar=()=>false;p.historiaPublica=false;Ficha.abrir(p.id);
 check(!document.querySelector('[data-editar-item]'),'visitante não edita descrição');
 check(!document.querySelector('[data-catalogo-rituais]'),'catálogo bloqueado para visitante');
 check(document.querySelector('[data-bind="dtRituaisBonus"]').disabled,'ajuste bloqueado');
 for(const campo of ['historico','personalidade','objetivo'])check(!document.querySelector('[data-bind="descricao.'+campo+'"]'),'campo privado '+campo);
 check(!document.querySelector('#view-ficha').textContent.includes('PERSONALIDADE_SECRETA'),'segredo fora do DOM');
 check(document.querySelector('[data-bind="descricao.aparencia"]'),'aparência visível');
 p.historiaPublica=true;Ficha.abrir(p.id);
 check(document.querySelector('[data-bind="descricao.objetivo"]').disabled,'objetivo público em consulta');
 Store.podeEditar=()=>true;p.historiaPublica=false;Ficha.abrir(p.id);
 check(document.querySelector('[data-bind="descricao.personalidade"]').value==='PERSONALIDADE_SECRETA','dono lê privado');
 document.body.innerHTML='<p id="resultado">PASSOU: DT, catálogo, componentes e privacidade.</p>';
})().catch(e=>document.body.innerHTML='<p id="resultado">FALHOU: '+e.message+'</p>');
`;
html=html.replace('</body>',()=>`<script>${code}\n${checks}</script></body>`);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rpg-bestiary-'));
try {
 const file=path.join(dir,'teste.html');fs.writeFileSync(file,html);
 const output=execFileSync(process.env.CHROME_PATH || '/opt/google/chrome/chrome',
  ['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--user-data-dir=${dir}/chrome`,'--dump-dom','--virtual-time-budget=5000',`file://${file}`],
  {encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']});
 assert.match(output, /<p id="resultado">PASSOU:/);
 console.log('Ficha: DT automática, migração, catálogo, filtros, duplicatas, componentes e privacidade passaram.');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
