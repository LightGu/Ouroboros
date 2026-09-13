const fs=require('fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(root+'/index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
const code=['dados','ui','ajuda','store','mesa','regras','paineis','ficha'].map(f=>fs.readFileSync(root+'/js/'+f+'.js','utf8')).join('\n');
const checks=`
window.App={mostrar(){}};
window.Nuvem={cliente:null};
const p=Store.normalizar({id:'outro',idade:50,desvantagensIdade:['fragil']});
Store.estado={personagens:[p]};Store.podeEditar=()=>false;
let saves=0;Store.salvar=()=>{saves++;};
function check(v,msg){if(!v)throw Error(msg);}
try {
 Ficha.abrir(p.id);
 const inputs=[...document.querySelectorAll('[data-desv-idade]')];
 check(inputs.length===DESVANTAGENS_IDADE.length,'opções preservadas');
 check(inputs.every(el=>el.disabled),'opções bloqueadas');
 const selected=document.querySelector('[data-desv-idade="fragil"]');
 check(selected.checked,'seleção preservada');
 selected.closest('label').click();
 selected.dispatchEvent(new MouseEvent('click',{bubbles:true}));
 check(p.desvantagensIdade.join(',')==='fragil'&&saves===0,'consulta não altera ficha');
 check(document.querySelector('[data-bind="idade"]').disabled,'idade bloqueada');
 Store.podeEditar=()=>true;Ficha.abrir(p.id);
 check(!document.querySelector('[data-desv-idade="fragil"]').disabled,'dono pode editar');
 document.querySelector('[data-desv-idade="fragil"]').click();
 check(p.desvantagensIdade.length===0&&saves===1,'dono altera seleção');
 document.body.innerHTML='<p id="resultado">PASSOU: idade em consulta e edição.</p>';
} catch(e) {document.body.innerHTML='<p id="resultado">FALHOU: '+e.message+'</p>';}
`;
html=html.replace('</body>',()=>`<script>${code}\n${checks}</script></body>`);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rpg-bestiary-'));
try {
 const file=path.join(dir,'teste.html');fs.writeFileSync(file,html);
 const output=execFileSync(process.env.CHROME_PATH || '/opt/google/chrome/chrome',
  ['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--user-data-dir=${dir}/chrome`,'--dump-dom','--virtual-time-budget=5000',`file://${file}`],
  {encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']});
 assert.match(output, /<p id="resultado">PASSOU:/);
 console.log('Idade: opções visíveis, seleção, bloqueio de alterações e edição pelo dono passaram.');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }

