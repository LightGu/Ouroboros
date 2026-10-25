const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');

test('Mestre Principal vê aba de outras mesas e entra por observação', { timeout: 15000 }, async () => {
  const browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    page.setDefaultTimeout(5000);
    const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8')
      .replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]*>/g, '');
    await page.setContent(html);
    for (const file of ['dados', 'ui', 'store', 'telas'])
      await page.addScriptTag({ content: fs.readFileSync(path.join(root, `public/js/${file}.js`), 'utf8') });
    await page.evaluate(() => {
      window.__observada = null;
      window.App = { modoObservador: false, sessao: { user: { id: 'admin' } },
        entrarNaMesa() {}, observarMesa(m) { window.__observada = m; }, sair() {} };
      window.Nuvem = {
        mesas: async () => [{ id: 'minha', nome: 'Minha campanha', sistema: 'ouroboros', papel: 'mestre', codigo: 'ABC123' }],
        ehSuperMestre: async () => true,
        mesasParaObservar: async () => [{ id: 'outra', nome: 'Campanha alheia', sistema: 'dnd5e', mestre_nome: 'Outro mestre' }]
      };
      document.querySelector('#carregando').hidden = true;
      document.querySelector('#view-mesas').hidden = false;
      Telas.ligarMesas();
      Telas.renderMesas();
    });
    await page.waitForSelector('#mesas-abas:not([hidden])');
    await page.locator('[data-lista-mesas="outras"]').click();
    assert.equal(await page.locator('#lista-mesas').isHidden(), true);
    assert.match(await page.locator('#lista-mesas-outras').textContent(), /Campanha alheia/);
    assert.match(await page.locator('#lista-mesas-outras').textContent(), /SOMENTE LEITURA/);
    await page.locator('[data-observar="outra"]').click();
    assert.equal(await page.evaluate(() => window.__observada.id), 'outra');
    assert.equal(await page.evaluate(() => { App.modoObservador = true; Store.ehMestre = true; return Store.podeEditar({ donoId: 'admin' }); }), false);
  } finally { await browser.close(); }
});
