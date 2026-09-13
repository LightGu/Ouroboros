#!/usr/bin/env python3
"""Gera imagens e manifesto de importação de fichas dos PDFs locais.

Requer pdftoppm (Poppler) e Pillow. Não usa OCR. O índice revisado mora em
bestiario/indice.json, fora dos arquivos publicados. Execute na raiz do projeto.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

def gerar():
    indice = json.loads((ROOT / 'bestiario/indice.json').read_text())
    fontes = {p.name: p for p in ROOT.glob('arquivos secretos*') for p in p.rglob('*.pdf')}
    destino = ROOT / 'bestiario/lote'
    destino.mkdir(parents=True, exist_ok=True)
    manifesto = []
    with tempfile.TemporaryDirectory(prefix='rpg-fichas-') as tmp:
        cache = {}
        for i, entrada in enumerate(indice, 1):
            imagens = []
            for pagina in entrada['pages']:
                chave = (entrada['source'], pagina)
                if chave not in cache:
                    prefixo = Path(tmp) / hashlib.sha256(str(chave).encode()).hexdigest()[:20]
                    subprocess.run(['pdftoppm', '-f', str(pagina), '-l', str(pagina),
                                    '-singlefile', '-scale-to', '2600', '-jpeg', '-jpegopt', 'quality=92',
                                    str(fontes[entrada['source']]), str(prefixo)],
                                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    cache[chave] = prefixo.with_suffix('.jpg')
                with Image.open(cache[chave]) as im:
                    imagens.append(im.convert('RGB'))
            largura = max(im.width for im in imagens)
            altura = sum(im.height for im in imagens)
            ficha = Image.new('RGB', (largura, altura), 'white')
            y = 0
            for im in imagens:
                ficha.paste(im, (0, y)); y += im.height; im.close()
            nome = entrada['source_key'] + '.jpg'
            ficha.save(destino / nome, quality=92, optimize=True)
            ficha.close()
            if (destino / nome).stat().st_size > 20 * 1024 * 1024:
                raise ValueError('Ficha excede 20 MB: ' + entrada['name'])
            registro = {k: entrada[k] for k in ['source_key', 'name', 'element', 'vd', 'type', 'tags']}
            registro['image_file'] = nome
            registro['notes'] = ('Fonte: ' + entrada['source'] + '\nPáginas do PDF: '
                                 + ', '.join(map(str, entrada['pages']))
                                 + '\nImagem das páginas originais; algumas páginas contêm outras fichas.' )
            manifesto.append(registro)
            if i % 20 == 0 or i == len(indice):
                print(f'{i}/{len(indice)} fichas preparadas', flush=True)
    (destino / 'manifest.json').write_text(json.dumps({'version': 1, 'creatures': manifesto}, ensure_ascii=False, indent=2))
    print('Lote pronto:', destino)

if __name__ == '__main__':
    gerar()
