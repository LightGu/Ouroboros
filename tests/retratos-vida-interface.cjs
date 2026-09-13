const fs=require('fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(root+'/index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
const code=['ui','mesa'].map(f=>fs.readFileSync(root+'/js/'+f+'.js','utf8')).join('\n');
const checks=`
const p={id:'p',imagem:'https://example.com/normal.jpg',pv:{atual:100,max:100}};
window.Store={mesaId:'mesa',obter:()=>p,podeEditar:()=>true,salvarAgora:async()=>{window.salvo=true;},guardarCache:()=>{}};
window.Ficha={atual:null};
Mesa.render=()=>{};
function check(v,msg){if(!v)throw Error(msg);}
(async()=>{
 p.imagemFerido='https://example.com/ferido.jpg';p.imagemCritica='https://example.com/critico.jpg';
 for(const [pv,img] of [[100,p.imagem],[81,p.imagem],[80,p.imagemFerido],[50,p.imagemFerido],[21,p.imagemFerido],[20,p.imagemCritica],[0,p.imagemCritica],[90,p.imagem]]){
  p.pv.atual=pv;check(imagemPorVida(p)===img,'limite PV '+pv);
 }
 p.pv.max=0;check(imagemPorVida(p)===p.imagem,'PV máximo ausente');p.pv.max=100;p.pv.atual=10;
 delete p.imagemCritica;check(imagemPorVida(p)===p.imagemFerido,'fallback ferido');
 delete p.imagemFerido;check(imagemPorVida(p)===p.imagem,'fallback normal');
 Mesa.trocarImagem('p');
 check(document.querySelectorAll('[data-retrato-arquivo]').length===3,'três uploads');
 const ferido=document.querySelector('[data-retrato-url="imagemFerido"]');
 ferido.value='https://example.com/novo.jpg';ferido.dispatchEvent(new Event('change'));
 check(!p.imagemFerido,'rascunho antes de salvar');
 await Modal.aoConfirmar();check(p.imagemFerido===ferido.value&&window.salvo,'persistência');
 Mesa.trocarImagem('p');document.querySelector('[data-retrato-limpar="imagemFerido"]').click();
 Modal.fechar();check(p.imagemFerido===ferido.value,'cancelar mantém imagens');
 document.body.innerHTML='<p id="resultado">PASSOU: retratos por PV.</p>';
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
 console.log('Retratos por PV: limites, cura, alternativas, formulário, salvamento e cancelamento passaram.');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }

