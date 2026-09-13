const fs=require('fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(root+'/index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
html=html.replace('</head>','<style>'+fs.readFileSync(root+'/css/style.css','utf8')+'</style></head>');
const code=['ui','mesa'].map(f=>fs.readFileSync(root+'/js/'+f+'.js','utf8')).join('\n');
const checks=`
window.Store={podeEditar:()=>true};window.num=v=>Number(v)||0;
function check(v,msg){if(!v)throw Error(msg);}
try {
 document.body.innerHTML='<div id="teste" style="width:300px;margin:40px"></div>';
 let referencia;
 for (const atual of [100,3,0]) {
  document.querySelector('#teste').innerHTML=Mesa.barra({id:'teste',pv:{atual,max:100}},'pv','PV');
  const barra=document.querySelector('.barrao'),menos=document.querySelector('.esq'),mais=document.querySelector('.dir');
  const r=barra.getBoundingClientRect(),a=menos.getBoundingClientRect(),b=mais.getBoundingClientRect();
  check(Math.abs(a.left-r.left-2)<1,'menos no início');check(Math.abs(r.right-b.right-2)<1,'mais no final');
  check(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2).closest('[data-ajuste]')===mais,'mais recebe clique');
  check(getComputedStyle(mais.firstChild).opacity==='1','mais visível');
  const pos=[a.x,b.x];if(referencia)check(JSON.stringify(pos)===JSON.stringify(referencia),'posição estável');referencia=pos;
 }
 document.body.innerHTML='<p id="resultado">PASSOU: controles fixos.</p>';
} catch(e){document.body.innerHTML='<p id="resultado">FALHOU: '+e.message+'</p>';}
`;
html=html.replace('</body>',()=>`<script>${code}\n${checks}</script></body>`);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rpg-bestiary-'));
try {
 const file=path.join(dir,'teste.html');fs.writeFileSync(file,html);
 const output=execFileSync(process.env.CHROME_PATH || '/opt/google/chrome/chrome',
  ['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--user-data-dir=${dir}/chrome`,'--dump-dom','--virtual-time-budget=5000',`file://${file}`],
  {encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']});
 assert.match(output, /<p id="resultado">PASSOU:/);
 console.log('Barras: botões fixos e clicáveis com 100, 3 e 0 PV passaram.');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }

