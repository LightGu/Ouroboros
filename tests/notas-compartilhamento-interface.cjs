const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');

test('autor escolhe destinatários e renomeia nota pelo fluxo transacional', { timeout: 15000 }, async () => {
  const browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    page.setDefaultTimeout(3000);
    const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8')
      .replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]*>/g, '');
    await page.setContent(html);
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'public/css/style.css'), 'utf8') });
    for (const file of ['dados', 'ui', 'campanha'])
      await page.addScriptTag({ content: fs.readFileSync(path.join(root, `public/js/${file}.js`), 'utf8') });
    await page.evaluate(() => {
      const eu = '00000000-0000-0000-0000-000000000001';
      window.App = { sessao: { user: { id: eu } }, mesa: { id: 'mesa-1' }, telaAtual: 'campanha', faltaMigracao() {} };
      window.Celular = { membros: [
        { id: eu, nome: 'Eu', papel: 'jogador' },
        { id: 'u2', nome: 'Alice', papel: 'jogador' },
        { id: 'u3', nome: 'Bruno', papel: 'mestre' }
      ] };
      let notas = [{ id: 'n1', mesa_id: 'mesa-1', autor_id: eu, titulo: 'Antiga', tipo: 'Nota', texto: '', etiquetas: [], compartilhados_com: [] }];
      window.__chamadas = [];
      window.Nuvem = {
        compartilharAnotacao: async (id, ids) => { window.__chamadas.push(['partilha', id, [...ids]]); notas[0].compartilhados_com = [...ids]; return [...ids]; },
        criarAnotacao: async a => ({ ...a, id: 'n2', autor_id: eu, compartilhados_com: [] }),
        renomearAnotacao: async (id, titulo) => { window.__chamadas.push(['rename', id, titulo]); notas[0].titulo = titulo; return notas[0]; },
        anotacoes: async () => notas,
        salvarAnotacao: async () => {}, apagarAnotacao: async () => {}
      };
      document.querySelector('#carregando').hidden = true;
      Campanha.lista = notas;
      Campanha.renderBarra();
      Campanha.abrir('n1');
    });

    assert.deepEqual((await page.locator('[data-partilha="editar"] label').allTextContents()).map(x => x.replace(/\s/g, '')), ['Alicejogador', 'Brunomestre']);
    assert.match(await page.locator('.nota-partilha-resumo').textContent(), /privada/i);
    await page.locator('[data-partilha="editar"] input[value="u2"]').check();
    await page.waitForFunction(() => window.__chamadas.some(c => c[0] === 'partilha'));
    assert.match(await page.locator('.nota-partilha-resumo').textContent(), /Alice/);

    await page.locator('#an-titulo').fill('Nova');
    await page.locator('#an-titulo').press('Tab');
    await page.waitForFunction(() => window.__chamadas.some(c => c[0] === 'rename'));
    assert.deepEqual(await page.evaluate(() => window.__chamadas.find(c => c[0] === 'rename')), ['rename', 'n1', 'Nova']);

    await page.evaluate(() => Campanha.nova());
    assert.equal(await page.locator('[data-partilha="nova"] input[type="checkbox"]').count(), 2);
    await page.locator('#nn-titulo').fill('Criada seletivamente');
    await page.locator('[data-partilha="nova"] input[value="u3"]').check();
    await page.locator('[data-modal-ok]').click();
    await page.waitForFunction(() => window.__chamadas.some(c => c[0] === 'partilha' && c[1] === 'n2'));
    assert.deepEqual(await page.evaluate(() => window.__chamadas.find(c => c[0] === 'partilha' && c[1] === 'n2')), ['partilha', 'n2', ['u3']]);
  } finally { await browser.close(); }
});
