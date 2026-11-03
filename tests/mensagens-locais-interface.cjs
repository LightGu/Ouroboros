const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');

test('aba local aparece somente para Mestre Principal na própria mesa', { timeout: 15000 }, async () => {
  const browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    page.setDefaultTimeout(4000);
    const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8')
      .replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]*>/g, '');
    await page.setContent(html);
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'public/css/style.css'), 'utf8') });
    for (const file of ['dados', 'ui', 'celular'])
      await page.addScriptTag({ content: fs.readFileSync(path.join(root, `public/js/${file}.js`), 'utf8') });
    const app = fs.readFileSync(path.join(root, 'public/js/app.js'), 'utf8').replace(/App\.iniciar\(\);\s*$/, '');
    await page.addScriptTag({ content: app });
    await page.evaluate(() => {
      window.__super = true;
      window.__rpc = 0;
      const vazio = async () => {};
      window.Nuvem = {
        ehSuperMestre: async () => window.__super,
        mensagensDaMesaPrincipal: async () => {
          window.__rpc++;
          return [{ id: 1, mesa_id: 'm1', de_user: 'j1', de_persona: null,
            para_user: 'j2', para_persona: null, texto: 'segredo local', criado_em: new Date().toISOString() }];
        },
        assinar: vazio, desassinar: vazio
      };
      window.Store = { carregar: vazio, estado: { personagens: [], combate: {} } };
      window.Financas = { carregar: vazio, saldos: new Map() };
      window.Logs = { carregar: vazio, limparBadge() {}, render() {} };
      window.Rolagem = { ligar() {}, carregar: vazio };
      window.Mapa = { carregar: vazio, render() {} };
      window.Sons = { ligar() {}, carregar: vazio, render() {} };
      window.Campanha = { carregar: vazio, render() {} };
      window.Mesa = { render() {} };
      window.Catalogo = { carregar: async () => {} };
      window.Bestiario = { limpar() {}, carregar() {} };
      window.Interludio = { render() {} };
      window.Homebrew = { render() {} };
      Celular.ligar = () => {};
      Celular.carregar = async () => {};
      Celular.membros = [{ id: 'admin', nome: 'Principal', papel: 'mestre' },
        { id: 'j1', nome: 'Alice', papel: 'jogador' }, { id: 'j2', nome: 'Bruno', papel: 'jogador' }];
      Celular.personas = [];
      App.sessao = { user: { id: 'admin' } };
      document.querySelectorAll('.aba').forEach(b => b.addEventListener('click', () => App.mostrar(b.dataset.aba)));
      document.querySelector('#carregando').hidden = true;
    });

    await page.evaluate(() => App.entrarNaMesa({ id: 'm1', nome: 'Minha', papel: 'mestre', sistema: 'ouroboros' }));
    assert.equal(await page.locator('#aba-mensagens').isHidden(), false);
    await page.locator('#aba-mensagens').click();
    await page.waitForSelector('.espia-msg');
    assert.match(await page.locator('#mensagens-corpo').textContent(), /segredo local/);
    assert.equal(await page.evaluate(() => window.__rpc), 1);

    await page.evaluate(async () => {
      window.__super = true;
      await App.entrarNaMesa({ id: 'm2', nome: 'Alheia', papel: 'jogador', sistema: 'ouroboros' });
      App.mostrar('mensagens');
    });
    assert.equal(await page.locator('#aba-mensagens').isHidden(), true);
    assert.equal(await page.evaluate(() => App.telaAtual), 'mesa');
    assert.equal(await page.evaluate(() => window.__rpc), 1);

    await page.evaluate(async () => {
      window.__super = false;
      await App.entrarNaMesa({ id: 'm3', nome: 'Mesa comum', papel: 'mestre', sistema: 'ouroboros' });
      App.mostrar('mensagens');
    });
    assert.equal(await page.locator('#aba-mensagens').isHidden(), true);
    assert.equal(await page.evaluate(() => App.telaAtual), 'mesa');
    assert.equal(await page.evaluate(() => window.__rpc), 1);
  } finally { await browser.close(); }
});
