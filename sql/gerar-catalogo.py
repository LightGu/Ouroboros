#!/usr/bin/env python3
"""Prepara o catálogo de itens para o popup da ficha.

Lê `catalogo/itens.json` (a extração crua dos PDFs, fora do git) e escreve:

  catalogo/catalogo-limpo.json  — mesma forma das colunas do Supabase, usado
                                  como fonte no desenvolvimento local
  catalogo/seed-itens.sql       — INSERTs para rodar no editor SQL do Supabase
                                  DEPOIS de aplicar sql/v12-catalogo-itens.sql

Os dois saem em `catalogo/`, que o .gitignore e o .vercelignore barram: são as
estatísticas dos livros da Jambô e não podem virar arquivo público do site.

A extração errou em três frentes previsíveis, e é isso que este script conserta:

1. Linhas que não são itens. As tabelas de crédito, patente, tamanho e alcance
   viraram "itens" de 1200 espaços chamados "5O+45" ou "Colossal".
2. Nomes colados. Quando o nome do item vinha logo depois do fim de um
   parágrafo, os dois entraram no mesmo campo ("dano mental. Paçoca").
3. `tipo` sem valor nenhum: é o cabeçalho da tabela mais próxima, e ele vazou
   por cima das tabelas seguintes — daí "Granada de fragmentação" ter saído
   como "DAS ARMAS" e "Paraquedas" como "Medicamentos". O grupo é recalculado
   aqui a partir do subtipo, do dano e de listas explícitas de nome.
"""
import json, os, re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRADA = os.path.join(RAIZ, 'catalogo', 'itens.json')
SAIDA_JSON = os.path.join(RAIZ, 'catalogo', 'catalogo-limpo.json')
SAIDA_SQL = os.path.join(RAIZ, 'catalogo', 'seed-itens.sql')

# Linhas de tabela de regra que entraram como se fossem item.
LIXO = {
    '+10', '4O+20', '4O+25', '5O+25', '5O+30', '5O+35', '5O+40', '5O+45',
    'Agente de elite', 'Oficial de operações', 'Operador',          # patentes
    'Pequeno', 'Médio', 'Alto', 'Colossal', 'Ilimitado',            # tamanho/alcance
    'Arma de duas mãos de metal (bazuca)',                          # tabela de fabricação:
    'Arma de uma mão de metal (espada)',                            # o número é preço,
    'Arma leve de metal (revólver)',                                # não espaço
}

# Nome certo dos que saíram grudados no parágrafo anterior.
NOMES = {
    'dano mental. Paçoca': 'Paçoca',
    'improvisada (OPRPG, p. 57 Tênis Lépidos': 'Tênis Lépidos',
    'os melhores resultados. Punhal X': 'Punhal X',
    'pontos de resistência a dano do alvo. Sniper Fantasma': 'Sniper Fantasma',
    'por ódio até o fim da cena. Skate Caótico': 'Skate Caótico',
}

SUBTIPO_ARMA = ('Corpo a Corpo', 'Armas de Fogo', 'Armas de Disparo',
                'À Distância', 'Armas de Arremesso')
ARMAS = {'Soqueira', 'Taser', 'Spray de pimenta', 'Pistola de dardos',
         'Pistola sinalizadora', 'Garra do Harpia', 'Lança-nitrogênio',
         'Lançador de Granadas'}
MUNICAO = {'Balas curtas', 'Balas leves', 'Balas longas', 'Balas pesadas',
           'Cartuchos', 'Flechas', 'Combustível', 'Foguete'}
EXPLOSIVO = {'Dinamite', 'Explosivo plástico', 'Galão vermelho', 'Mina antipessoal'}
MEDICAMENTO = {'Anti-inflamatório', 'Antibiótico', 'Antiemético', 'Antihistamínico',
               'Antitérmico', 'Antídoto', 'Broncodilatador', 'Coagulante',
               'Cicatrizante', 'Bandagem', 'Aplicador de medicamentos',
               'Aplicador de Adrenalina'}
PROTECAO = {'Traje hazmat', 'Traje de mergulho', 'Traje espacial', 'Máscara de gás',
            'Paraquedas', 'Vestimenta'}


def grupo(x):
    """Bucket do item. A ordem importa: um item amaldiçoado que é granada
       continua sendo amaldiçoado, que é o que interessa na hora de achar."""
    nome, tipo, sub = x['nome'], x.get('tipo', ''), x.get('subtipo', '')
    if tipo == 'Item Paranormal' or nome == 'Amarras elementais': return 'Itens paranormais'
    if tipo.startswith('Item Amaldiçoado'): return 'Amaldiçoado'
    if tipo.startswith('Catalisadores ritual'): return 'Itens paranormais'
    # munição antes de arma: balas e flechas moram na tabela das armas e
    # herdaram o subtipo delas ("Armas de Fogo – Leves"), mas não são armas
    if nome in MUNICAO:                                                  return 'Munição'
    if x.get('dano') or sub.startswith(SUBTIPO_ARMA) or nome in ARMAS:   return 'Arma'
    if nome.startswith('Granada') or nome in EXPLOSIVO:                  return 'Explosivo'
    if nome in MEDICAMENTO:                                              return 'Medicamento'
    if nome in PROTECAO:                                                 return 'Proteção'
    return 'Equipamento'


def limpar(bruto):
    saida, vistos = [], set()
    for x in bruto:
        nome = NOMES.get(x['nome'], x['nome']).strip()
        if nome in LIXO or len(nome) < 2:
            continue
        # sobra de parágrafo que ninguém mapeou: começa em minúscula ou tem
        # ponto final no meio. Melhor faltar item do que mostrar lixo.
        if nome[0].islower() or re.search(r'\.\s', nome):
            continue
        chave = (nome.lower(), x.get('livro', ''))
        if chave in vistos:
            continue
        vistos.add(chave)
        saida.append({
            'nome': nome,
            'grupo': grupo(dict(x, nome=nome)),
            'categoria': int(x.get('categoria') or 0),
            'espacos': round(float(x.get('espacos') or 0), 1),
            'dano': (x.get('dano') or '').strip(),
            'critico': (x.get('critico') or '').strip(),
            'alcance': (x.get('alcance') or '').strip(),
            'tipo_dano': (x.get('tipoDano') or '').strip(),
            'descricao': ' '.join((x.get('descricao') or '').split()),
            'livro': (x.get('livro') or '').strip(),
            'pagina': str(x.get('pagina') or '').strip(),
        })
    for elemento in ['Sangue', 'Morte', 'Conhecimento', 'Energia']:
        nome = f'Componentes ritualísticos de {elemento}'
        if any(i['nome'] == nome and i['livro'] == 'Livro Básico' for i in saida):
            continue
        saida.append(dict(nome=nome, grupo='Itens paranormais', categoria=0, espacos=1,
                          dano='', critico='', alcance='', tipo_dano='', livro='Livro Básico', pagina='66–67',
                          descricao=f'Conjunto de componentes para conjurar rituais de {elemento}. Medo não utiliza componentes ritualísticos.'))
    saida.sort(key=lambda i: i['nome'].lower())
    return saida


def sql(itens):
    def txt(v):
        return "'" + str(v).replace("'", "''") + "'"
    linhas = [',\n'.join(
        '  ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})'.format(
            txt(i['nome']), txt(i['grupo']), i['categoria'], i['espacos'],
            txt(i['dano']), txt(i['critico']), txt(i['alcance']), txt(i['tipo_dano']),
            txt(i['descricao']), txt(i['livro']), txt(i['pagina']))
        for i in itens)]
    return (
        '-- Gerado por sql/gerar-catalogo.py — não edite à mão.\n'
        '-- Rode DEPOIS de sql/v12-catalogo-itens.sql. Pode rodar de novo: o\n'
        '-- on conflict atualiza o que mudou em vez de duplicar.\n'
        '-- Conteúdo dos livros da Jambô: este arquivo não vai pro git nem pro site.\n\n'
        'insert into public.itens_catalogo\n'
        '  (nome, grupo, categoria, espacos, dano, critico, alcance, tipo_dano, descricao, livro, pagina)\n'
        'values\n' + linhas[0] + '\n'
        'on conflict (nome, livro) do update set\n'
        '  grupo = excluded.grupo, categoria = excluded.categoria, espacos = excluded.espacos,\n'
        '  dano = excluded.dano, critico = excluded.critico, alcance = excluded.alcance,\n'
        '  tipo_dano = excluded.tipo_dano, descricao = excluded.descricao, pagina = excluded.pagina;\n\n'
        'select grupo, count(*) from public.itens_catalogo group by grupo order by 2 desc;\n')


if __name__ == '__main__':
    bruto = json.load(open(ENTRADA, encoding='utf-8'))
    itens = limpar(bruto)
    json.dump(itens, open(SAIDA_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(SAIDA_SQL, 'w', encoding='utf-8').write(sql(itens))
    contagem = {}
    for i in itens:
        contagem[i['grupo']] = contagem.get(i['grupo'], 0) + 1
    print('{} itens de {} ({} descartados)'.format(len(itens), len(bruto), len(bruto) - len(itens)))
    for g, n in sorted(contagem.items(), key=lambda p: -p[1]):
        print('  {:>3}  {}'.format(n, g))
    print('\n->', SAIDA_JSON)
    print('->', SAIDA_SQL)
