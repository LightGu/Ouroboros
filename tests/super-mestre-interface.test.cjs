const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');

test('Ouroboros autentica e separa mesas próprias das demais', { timeout: 15000 }, async () => {
  const browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    page.setDefaultTimeout(5000);
    const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8')
      .replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]*>/g, '');
    await page.setContent(html);
    for (const file of ['dados', 'ui', 'admin-mestre'])
      await page.addScriptTag({ content: fs.readFileSync(path.join(root, `public/js/${file}.js`), 'utf8') });
    await page.evaluate(() => {
      window.App = {
        sessao: { user: { id: '69cb076a-9966-4c6d-9719-0413ebfcd915', email: 'admin@teste.local' } }, mesa: { id: 'm1' },
        mostrar(tela) { document.querySelectorAll('main.view').forEach(v => v.hidden = v.id !== 'view-' + tela); }
      };
      window.Nuvem = {
        confirmarSenha: async senha => { if (senha !== 'correta123') throw new Error('Invalid login credentials'); },
        ehSuperMestre: async () => true,
        mensagensGlobais: async () => [
          { id: 1, mesa_id: 'm1', mesa_nome: 'Minha', mesa_propria: true, mestre_nome: 'Admin', remetente: 'A', destinatario: 'B', texto: 'olá', criado_em: new Date().toISOString() },
          { id: 2, mesa_id: 'm2', mesa_nome: 'Outra', mesa_propria: false, mestre_nome: 'Outro', remetente: 'C', destinatario: 'D', texto: 'teste', criado_em: new Date().toISOString() }
        ]
      };
      document.querySelector('#carregando').hidden = true;
      document.querySelector('#topbar').hidden = false;
      document.querySelector('#btn-super-mestre').addEventListener('click', () => AdminMestre.abrir());
    });
    await page.locator('#btn-super-mestre').click();
    await page.locator('#super-senha').fill('correta123');
    await page.locator('[data-modal-ok]').click();
    await page.waitForSelector('#view-super-mestre:not([hidden])');
    assert.equal(await page.locator('.super-mesa').count(), 2);
    assert.match(await page.locator('#super-mensagens').textContent(), /CRIADA POR MIM/);
    assert.match(await page.locator('#super-mensagens').textContent(), /OUTRO MESTRE/);
    await page.locator('#super-escopo').selectOption('outras');
    assert.equal(await page.locator('.super-mesa').count(), 1);
    assert.match(await page.locator('#super-mensagens').textContent(), /Outra/);
  } finally { await browser.close(); }
});
