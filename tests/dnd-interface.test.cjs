const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const root = path.resolve(__dirname, '..');

test('mesa D&D cria e edita a ficha 5e com cálculos próprios', { timeout: 15000 }, async () => {
  const browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(5000);
    const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8')
      .replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]*>/g, '');
    await page.setContent(html);
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'public/css/style.css'), 'utf8') });
    for (const file of ['dados', 'ui', 'store', 'mesa', 'paineis', 'ficha', 'ficha-dnd', 'rolagem']) {
      await page.addScriptTag({ content: fs.readFileSync(path.join(root, `public/js/${file}.js`), 'utf8') });
    }
    await page.evaluate(() => {
      window.App = { mesa: { id: 'm1', sistema: 'dnd5e' }, sessao: { user: { id: 'u1' } }, perfil: { nome: 'Jogador' }, ehMestre: true,
        mostrar(tela) { document.querySelector('#view-ficha').hidden = tela !== 'ficha'; } };
      window.Nuvem = {};
      Store.mesaId = 'm1'; Store.ehMestre = true; Store.salvar = () => {}; Store.salvarAgora = async () => {};
      const p = Store.normalizar({ id: 'p1', sistema: 'dnd5e', nome: 'Nyx' });
      Store.estado.personagens = [p];
      document.querySelector('#carregando').hidden = true;
      Ficha.abrir('p1');
    });

    assert.equal(await page.locator('.tag-dnd').textContent(), 'D&D 5e');
    assert.equal(await page.locator('[data-dnd-bind="atributos.FOR"]').inputValue(), '10');
    await page.locator('[data-dnd-bind="atributos.FOR"]').fill('18');
    await page.locator('[data-dnd-bind="atributos.FOR"]').blur();
    assert.equal(await page.locator('[data-dnd-rolar="FOR"]').textContent(), '+4');

    await page.locator('[data-dnd-bind="hp.max"]').fill('27');
    await page.locator('[data-dnd-bind="hp.atual"]').fill('19');
    assert.deepEqual(await page.evaluate(() => ({ hp: Ficha.atual.dnd.hp, pv: Ficha.atual.pv })), {
      hp: { atual: 19, max: 27, temporario: 0 }, pv: { atual: 19, max: 27 }
    });

    await page.locator('[data-dnd-bind="pericias.atletismo.proficiente"]').check();
    assert.equal(await page.locator('[data-dnd-teste="pericias.atletismo"]').textContent(), '+6');
    await page.locator('[data-dnd-add="ataques"]').click();
    assert.equal(await page.locator('[data-dnd-bind="ataques.0.nome"]').count(), 1);
    await page.locator('[data-dnd-add="magias"]').click();
    assert.equal(await page.locator('[data-dnd-bind="magias.0.nome"]').count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  } finally {
    await browser.close();
  }
});
