#!/usr/bin/env python3
"""Valida catalogo/rituais-revisados.json e gera JSON local + seed privado.

As fontes e os dados dos livros ficam em catalogo/, fora do git e do site.
O seed deve ser aplicado depois de sql/v18-catalogo-rituais.sql.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIELDS = ['nome', 'elemento', 'circulo', 'execucao', 'alcance', 'alvo', 'duracao',
          'resistencia', 'livro', 'pagina']

def validar(itens):
    vistos = set()
    for r in itens:
        for campo in ['nome', 'elemento', 'circulo', 'execucao', 'alcance', 'alvo', 'livro', 'pagina', 'desc']:
            if not str(r.get(campo, '')).strip():
                raise ValueError(f'{r.get("nome")}: falta {campo}')
        if str(r['circulo']) not in ['1', '2', '3', '4']:
            raise ValueError('Círculo inválido: ' + r['nome'])
        if not r.get('elementos') or not set(r['elementos']) <= {'sangue','morte','energia','conhecimento','medo'}:
            raise ValueError('Elementos inválidos: ' + r['nome'])
        chave = (r['nome'].casefold(), r['livro'])
        if chave in vistos:
            raise ValueError('Ritual duplicado: ' + r['nome'])
        vistos.add(chave)
    return itens

def sql(itens):
    def q(x): return "'" + str(x).replace("'", "''") + "'"
    linhas = []
    for r in itens:
        valores = [q(r.get(k, '')) for k in FIELDS]
        valores += [q(r['desc']), 'array[' + ','.join(q(e) for e in r['elementos']) + ']::text[]']
        linhas.append('  (' + ', '.join(valores) + ')')
    campos = FIELDS + ['descricao', 'elementos']
    return ('-- Gerado por sql/gerar-rituais.py. Conteúdo privado dos livros.\nbegin;\n'
            'insert into public.rituais_catalogo (' + ', '.join(campos) + ')\nvalues\n'
            + ',\n'.join(linhas) + '\non conflict (nome, livro) do update set\n'
            + ',\n'.join('  ' + k + ' = excluded.' + k for k in campos if k not in ['nome','livro'])
            + ';\ncommit;\n')

if __name__ == '__main__':
    itens = validar(json.loads((ROOT / 'catalogo/rituais-revisados.json').read_text()))
    itens.sort(key=lambda r: (r['nome'].casefold(), r['livro']))
    (ROOT / 'catalogo/rituais.json').write_text(json.dumps(itens, ensure_ascii=False, indent=2))
    (ROOT / 'catalogo/seed-rituais.sql').write_text(sql(itens))
    for livro in sorted({r['livro'] for r in itens}):
        print(livro, sum(r['livro'] == livro for r in itens))
    print(f'{len(itens)} rituais validados e gerados.')
