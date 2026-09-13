/* Run: PLAYWRIGHT_PATH=/path/to/playwright node tests/interface.cjs
   Everything is fulfilled in memory; no server, account or cloud writes. */
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url()==='http://rpg.test/'?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'')}):r.abort());
 await page.goto('http://rpg.test/');
 await page.addStyleTag({content:fs.readFileSync(path.join(root,'css/style.css'),'utf8')});
 for(const file of ['dados','ui','ajuda','store','mesa','catalogo','regras','paineis','ficha','criacao']) await page.addScriptTag({content:fs.readFileSync(path.join(root,`js/${file}.js`),'utf8')});
 await page.evaluate(()=>{
  window.App={sessao:{user:{id:'teste'}},mostrar(nome){document.querySelectorAll('main > section').forEach(el=>el.hidden=el.id!==`view-${nome}`);document.querySelector('#view-ficha').hidden=nome!=='ficha';}};
  Mesa.render=()=>{};window.Nuvem={cliente:null};
  Store.estado={personagens:[]};Store.podeEditar=()=>true;Store.salvar=()=>{};Store.salvarAgora=async()=>{};
  Store.criar=async()=>{const p=Store.normalizar({id:`p${Store.estado.personagens.length}`});Store.estado.personagens.push(p);return p;};
  document.querySelector('#carregando').hidden=true;
  Catalogo.itens=[{nome:'Lanterna',categoria:0,espacos:1,grupo:'Acessórios'},{nome:'Proteção leve',categoria:1,espacos:2,grupo:'Proteções'}];
  Criacao.guiado();
 });
 const next=()=>page.locator('[data-modal-ok]').click();
 await page.locator('#c-nome').fill('Agente de teste');await next();
 await page.locator('[data-origem="Policial"]').click();await next();
 await page.locator('[data-classe="Combatente"]').click();await next();
 for(const a of ['AGI','VIG','FOR','INT']) await page.locator(`[data-p="${a}:1"]`).click();
 await next();
 assert.equal(await page.locator('[data-per-chk="pontaria"]').isDisabled(),true);
 assert.equal(await page.locator('[data-per-chk="percepcao"]').isChecked(),true);
 // Required combat resistance is missing, despite filling the total.
 for(const k of ['crime','investigacao','atletismo','vontade','iniciativa']) await page.locator(`[data-per-chk="${k}"]`).check();
 await next();assert.equal(await page.locator('#modal-titulo').textContent(),'Perícias treinadas');
 await page.locator('[data-per-chk="crime"]').uncheck();await page.locator('[data-per-chk="fortitude"]').check();
 await next();await next();
 await page.locator('[data-item-id="0"]').click();
 assert.match(await page.locator('#c-itens-escolhidos').textContent(),/Lanterna/);
 await next();await next();await next();
 await page.waitForFunction(()=>Ficha.atual?.nome==='Agente de teste');
 assert.equal(await page.evaluate(()=>Ficha.atual.defesa.outros),2);
 assert.equal(await page.evaluate(()=>Ficha.atual.habilidades.some(h=>h.nome==='Patrulha')),true);
 assert.equal(await page.evaluate(()=>Ficha.atual.inventario.itens[0].nome),'Lanterna');
 const panel=page.locator('[data-painel="atributos"]');
 await panel.locator('[data-recolher]').click();assert.equal(await panel.locator('.painel-conteudo').isVisible(),false);
 assert.equal(await page.locator('[data-mover]').count(),0);
 await panel.locator('.painel-alca').dragTo(page.locator('[data-painel="status"] .titulo-bloco'));
 const ordem=await page.locator('[data-painel]').evaluateAll(els=>els.map(e=>e.dataset.painel));
 await page.locator('[data-layout="cascata"]').click();
 await page.evaluate(()=>Ficha.abrir(Ficha.atual.id));
 assert.deepEqual(await page.locator('[data-painel]').evaluateAll(els=>els.map(e=>e.dataset.painel)),ordem);
 assert.equal(await panel.locator('.painel-conteudo').isVisible(),false);
 assert.equal(await page.locator('.modo-cascata').count(),1);
 await panel.locator('[data-ocultar]').click();assert.equal(await panel.isVisible(),false);
 await page.locator('.organizar-paineis summary').click();await page.locator('[data-visibilidade="atributos"]').click();assert.equal(await panel.isVisible(),true);
 await page.locator('[data-todos="abrir"]').click();
 await page.locator('[data-painel="status"] .painel-alca').dragTo(page.locator('[data-painel="atributos"] .titulo-bloco'));
 assert.ok((await page.locator('[data-painel]').evaluateAll(els=>els.map(e=>e.dataset.painel))).indexOf('status') > (await page.locator('[data-painel]').evaluateAll(els=>els.map(e=>e.dataset.painel))).indexOf('atributos'));
 await page.locator('[data-restaurar]').click();
 assert.equal(await page.locator('[data-painel]').nth(1).getAttribute('data-painel'),'atributos');
 // Reopening must retain edited values and not duplicate event handlers.
 await page.locator('[data-bind="atributos.AGI"]').fill('3');
 await page.evaluate(()=>Ficha.abrir(Ficha.atual.id));assert.equal(await page.locator('[data-bind="atributos.AGI"]').inputValue(),'3');
 await page.locator('[data-bind="nome"]').focus();await page.locator('[data-bind="atributos.AGI"]').focus();assert.match(await page.locator('[data-bind="atributos.AGI"]').getAttribute('aria-describedby'),/ajuda-tooltip/);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.dica-flutuante').isVisible(),false);
 await page.screenshot({path:'/tmp/rpg-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:'/tmp/rpg-mobile.png',fullPage:true});
 // Read-only users may personalize layout but cannot mutate character.
 await page.evaluate(()=>{Store.podeEditar=()=>false;Ficha.abrir(Ficha.atual.id);});
 assert.equal(await page.locator('[data-bind="nome"]').isDisabled(),true);
 assert.equal(await page.locator('[data-subirnex]').count(),0);
 await page.locator('[data-painel="atributos"] [data-recolher]').click();
 // Survivor progression includes stage 3 Vigor and Durão, preserving extra PV.
 await page.evaluate(async()=>{Store.podeEditar=()=>true;const p=await Store.criar();Object.assign(p,{nome:'Sobrevivente',classe:'Sobrevivente',origem:'Atleta',nex:0,estagio:2,trilha:'Durão',pv:{atual:10,max:20},pe:{atual:2,max:4},san:{atual:5,max:10}});Ficha.abrir(p.id);});
 await page.locator('[data-subirnex]').click();await page.locator('#e-attr').selectOption('VIG');await next();
 assert.deepEqual(await page.evaluate(()=>({estagio:Ficha.atual.estagio,nex:Ficha.atual.nex,pv:Ficha.atual.pv})),{estagio:3,nex:0,pv:{atual:15,max:25}});
 // A failed stage confirmation must not apply the attribute increase twice.
 await page.evaluate(async()=>{const p=await Store.criar();Object.assign(p,{nome:'Retry',classe:'Sobrevivente',origem:'Atleta',nex:0,estagio:2,trilha:'Esperto'});Ficha.abrir(p.id);});
 await page.locator('[data-subirnex]').click();await page.locator('#e-attr').selectOption('INT');await next();
 assert.equal(await page.evaluate(()=>Ficha.atual.estagio),2);
 await page.locator('#e-pericia').selectOption('crime');await next();
 assert.equal(await page.evaluate(()=>Ficha.atual.atributos.INT),2);
 assert.equal(await page.evaluate(()=>Ficha.atual.pericias.crime.treino),5);
 // Switching to a civilian class allows fixing a previously overspent budget.
 await page.evaluate(()=>{Criacao.guiado();Criacao.d.classe='Sobrevivente';Criacao.d.attrs={AGI:2,FOR:2,INT:2,PRE:2,VIG:1};Criacao.ir(3);});
 await next();assert.equal(await page.locator('#modal-titulo').textContent(),'Atributos');
 await page.locator('[data-p="AGI:-1"]').click();await next();assert.equal(await page.locator('#modal-titulo').textContent(),'Perícias treinadas');
 // The Occultist receives both mandatory skills, even with duplicate origin grants.
 await page.evaluate(()=>{Criacao.d.classe='Ocultista';Criacao.d.origem='Cultista Arrependido';Criacao.d.pericias=[];Criacao.ir(4);});
 assert.equal(await page.locator('[data-per-chk="ocultismo"]').isDisabled(),true);
 assert.equal(await page.locator('[data-per-chk="vontade"]').isDisabled(),true);
 assert.equal(await page.evaluate(()=>Criacao.totalPericias()),9);
 await page.evaluate(()=>{Criacao.d.classe='Especialista';Criacao.d.pericias=['crime','investigacao','percepcao'];Criacao.ir(5);});
 await page.locator('[data-perito="crime"]').check();await next();assert.equal(await page.locator('#modal-titulo').textContent(),'Poderes e escolhas');
 assert.deepEqual(errors,[]);
 console.log('Interface: criação, validação, catálogo, painéis, persistência, arraste, foco, 390px, permissões e evolução passaram.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
