const fs=require('fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(root+'/index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
const code=['dados','ui','bestiario'].map(f=>fs.readFileSync(root+'/js/'+f+'.js','utf8')).join('\n');
const checks=`
window.App={ehMestre:true,sessao:{user:{id:'dono'}}};
window.Store={mesaId:'mesa',criarDoBestiario:async c=>{window.adicionada=c.id;}};
window.Nuvem={bestiario:async()=>[{id:'a',name:'Criatura Ágil',element:'Sangue',vd:0,type:'Animal',tags:['floresta'],notes:'Teste',image_path:'a.png'}],imagemCriatura:async()=>new Blob(['teste'],{type:'image/png'})};
function check(v,msg){if(!v)throw new Error(msg);}
(async()=>{
 document.querySelector('#view-bestiario').hidden=false;
 await Bestiario.carregar();
 check(document.querySelectorAll('.best-card').length===1,'card');
 await Bestiario.adicionar('a',document.querySelector('[data-best-adicionar]'));
 check(window.adicionada==='a','adicionar aos turnos');
 check(!document.querySelector('button button'),'sem botões aninhados');
 const busca=document.querySelector('[data-best-filtro="name"]');
 busca.value='agil';busca.dispatchEvent(new Event('input'));
 check(document.querySelectorAll('.best-card').length===1,'busca sem acento');
 busca.value='nada';busca.dispatchEvent(new Event('input'));
 check(document.querySelectorAll('.best-card').length===0,'sem resultados');
 document.querySelector('#best-limpar').click();
 await Bestiario.abrir('a');
 check(document.querySelector('#best-imagem img').src.startsWith('blob:'),'imagem autenticada');
 document.querySelector('#best-zoom').click();
 check(document.querySelector('#best-imagem').classList.contains('original'),'zoom');
 document.querySelector('#best-voltar').click();
 check(Bestiario.imagemUrl===null,'limpeza blob');
 document.querySelector('#best-novo').click();
 check(document.querySelector('#best-form input[name="image"]').required,'upload obrigatório');
 check(document.querySelector('#best-form input[name="name"]').required,'nome obrigatório');
 Modal.fechar();
 document.querySelector('#best-importar').click();
 const entrada={source_key:'livro-teste',name:'Importada',element:'Morte',vd:40,type:'Criatura',tags:['livro'],notes:'Fonte',image_file:'ficha.jpg'};
 const arquivos=new DataTransfer();
 arquivos.items.add(new File([JSON.stringify({version:1,creatures:[entrada]})],'manifest.json',{type:'application/json'}));
 arquivos.items.add(new File(['imagem'],'ficha.jpg',{type:'image/jpeg'}));
 const pasta=document.querySelector('#best-lote-pasta');pasta.files=arquivos.files;
 pasta.dispatchEvent(new Event('change'));
 for(let i=0;i<100&&document.querySelector('[data-modal-ok]').disabled;i++)await new Promise(r=>setTimeout(r,10));
 check(!document.querySelector('[data-modal-ok]').disabled,'lote validado');
 Nuvem.importarCriatura=async()=>({criatura:{...entrada,id:'importada'},existente:false});
 await Modal.aoConfirmar();
 check(document.querySelector('#best-lote-status').textContent.includes('1 importadas'),'progresso importação');
 check(Bestiario.lista.some(c=>c.id==='importada'),'criatura importada visível');
 Modal.fechar();Bestiario.limpar();
 check(document.querySelector('#view-bestiario').childElementCount===0,'limpeza tela');
 document.body.innerHTML='<p id="resultado">PASSOU: cards, busca, estados vazios, imagem, zoom, formulário e limpeza.</p>';
})().catch(e=>document.body.innerHTML='<p id="resultado">FALHOU: '+e.message+'</p>');`;
html=html.replace('</body>',()=>`<script>${code}\n${checks}</script></body>`);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rpg-bestiary-'));
try {
 const file=path.join(dir,'teste.html');fs.writeFileSync(file,html);
 const output=execFileSync(process.env.CHROME_PATH || '/opt/google/chrome/chrome',
  ['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--user-data-dir=${dir}/chrome`,'--dump-dom','--virtual-time-budget=5000',`file://${file}`],
  {encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']});
 assert.match(output, /<p id="resultado">PASSOU:/);
 console.log('Interface do bestiário: cards, busca, vazio, imagem, zoom, formulário, importação em lote e limpeza passaram.');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }

