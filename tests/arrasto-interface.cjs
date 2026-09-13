const fs=require('fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(root+'/index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
const code=fs.readFileSync(root+'/js/ui.js','utf8');
const checks=`
function check(v,msg){if(!v)throw Error(msg);}
try {
 for(const pointerType of ['mouse','touch']) {
  const raiz=document.createElement('div');document.body.prepend(raiz);
  raiz.innerHTML='<section data-item="a"><button class="alca">Mover</button></section><section data-item="b"><button class="alca">Mover</button></section>';
  const [a,b]=raiz.children,cabo=a.firstChild;
  cabo.setPointerCapture=()=>{};cabo.hasPointerCapture=()=>false;
  let moves=0;
  document.elementFromPoint=()=>b;
  ligarArrasto({raiz,itens:'[data-item]',alca:'.alca',aoMover:(origem,destino)=>{check(origem===a&&destino===b,'destino');moves++;}});
  const evento=(tipo,x,y)=>cabo.dispatchEvent(new PointerEvent(tipo,{bubbles:true,pointerId:1,pointerType,button:0,clientX:x,clientY:y}));
  evento('pointerdown',100,100);evento('pointermove',102,102);evento('pointerup',102,102);
  check(moves===0,'clique não move');
  evento('pointerdown',100,100);evento('pointermove',150,150);
  check(b.classList.contains('destino-arraste'),'destino destacado');check(moves===0,'sem mover antes de soltar');
  evento('pointerup',150,150);check(moves===1,'soltar move');check(!b.classList.contains('destino-arraste'),'limpeza');
  evento('pointerdown',100,100);evento('pointermove',150,150);evento('pointercancel',150,150);check(moves===1,'cancelamento');
  raiz.remove();
 }
 document.body.innerHTML='<p id="resultado">PASSOU: arrasto mouse e toque.</p>';
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
 console.log('Arrasto: mouse, toque, limiar de movimento, destino e cancelamento passaram.');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }

