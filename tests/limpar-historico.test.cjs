const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const el={disabled:false,textContent:''};let modal,calls=[];
const ctx=vm.createContext({console,App:{ehMestre:true,mesa:{id:'mesa-a'}},Modal:{abrir:o=>modal=o},$:()=>el,toast:()=>{},Nuvem:{limparHistorico:async(...args)=>calls.push(args)},Rolagem:{carregar:async()=>{}}});
vm.runInContext(fs.readFileSync('js/logs.js','utf8')+';globalThis.L=Logs;',ctx);
ctx.L.carregar=async()=>{};ctx.L.limparBadge=()=>{};
(async()=>{
 ctx.L.confirmarLimpeza('logs');assert.equal(calls.length,0);
 assert.equal(await modal.onConfirmar(),true);assert.deepEqual(calls,[['mesa-a','logs']]);
 ctx.L.confirmarLimpeza('rolagens');await modal.onConfirmar();assert.equal(calls[1][1],'rolagens');
 ctx.L.confirmarLimpeza();ctx.App.mesa.id='mesa-b';assert.equal(await modal.onConfirmar(),false);assert.equal(calls.length,2);
 ctx.App.ehMestre=false;modal=null;ctx.L.confirmarLimpeza();assert.equal(modal,null);
 ctx.App.ehMestre=true;ctx.Nuvem.limparHistorico=async()=>{throw Error('sem conexão');};
 ctx.L.confirmarLimpeza();assert.equal(await modal.onConfirmar(),false);assert.match(el.textContent,/sem conexão/);assert.equal(el.disabled,false);
 console.log('Limpeza: confirmação, escopo, permissão na interface, troca de mesa e falha passaram.');
})().catch(e=>{console.error(e);process.exitCode=1;});
