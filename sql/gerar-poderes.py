#!/usr/bin/env python3
"""Valida o catálogo revisado e gera o fallback local e o seed privado."""
import json, os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRADA = os.path.join(RAIZ, 'catalogo', 'poderes-revisados.json')
SAIDA = os.path.join(RAIZ, 'catalogo', 'poderes.json')
SQL = os.path.join(RAIZ, 'catalogo', 'seed-poderes.sql')

def gerar(itens):
    exigidos = {'nome', 'classe', 'descricao', 'livro', 'pagina'}
    if any(exigidos - set(x) or not all(str(x[k]).strip() for k in exigidos) for x in itens):
        raise ValueError('Todo poder precisa de nome, classe, descrição, livro e página.')
    if len({(x['nome'], x['classe'], x['livro']) for x in itens}) != len(itens):
        raise ValueError('Há poderes duplicados.')
    return sorted(itens, key=lambda x: (x['classe'], x['nome']))

def texto(v): return "'" + str(v).replace("'", "''") + "'"

if __name__ == '__main__':
    itens = gerar(json.load(open(ENTRADA, encoding='utf-8')))
    json.dump(itens, open(SAIDA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    valores = ',\n'.join('  ({})'.format(', '.join(texto(x[k]) for k in ('nome','classe','descricao','livro','pagina'))) for x in itens)
    open(SQL, 'w', encoding='utf-8').write("-- Rode depois de sql/v23-catalogo-poderes.sql. Conteúdo privado dos livros.\ninsert into public.poderes_catalogo (nome, classe, descricao, livro, pagina) values\n" + valores + "\non conflict (nome, classe, livro) do update set descricao=excluded.descricao, pagina=excluded.pagina;\n")
    print(f'{len(itens)} poderes gerados.')
