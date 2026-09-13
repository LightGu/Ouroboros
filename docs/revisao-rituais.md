# Rituais e descrição privada

## Preparar o banco

Aplicar, nesta ordem, no editor SQL do Supabase:

1. `sql/v18-catalogo-rituais.sql`: tabela protegida por RLS e quatro conjuntos de componentes.
2. `catalogo/seed-rituais.sql`: 107 registros do catálogo.
3. `sql/v19-descricao-privada.sql`: personalidade e objetivo passam à tabela privada da história. Aplicar antes de publicar o frontend.

O catálogo e o seed contêm textos dos livros e ficam em `catalogo/`, excluído do git e da publicação. `python3 sql/gerar-rituais.py` valida `catalogo/rituais-revisados.json` e regenera ambos. Não foi realizada uma importação no banco remoto durante esta alteração.

## Cobertura das fontes locais

| Fonte | Rituais | Referências |
| --- | ---: | --- |
| Livro Básico v1.1 | 82 | Índice nas páginas 122–123; descrições nas páginas 124–143 |
| Sobrevivendo ao Horror v1.2 | 16 | Páginas 48–56 |
| Arquivos Secretos 1 (arquivo corrigido) | 2 | Páginas 48 e 50 |
| Arquivos Secretos 2 | 4 | Páginas 65–67 |
| Arquivos Secretos 3 | 1 | Proteção Sigilosa, apresentado na ficha de Alê |
| Arquivos Secretos 4 v1.1 | 1 | Backup, página 68 |
| Arquivos Secretos 5 v1.1 | 0 | Sem novos blocos de ritual encontrados |
| Arquivos Secretos 6 v1.1 | 1 | Hesitação Forçada, página 72 |
| AS 7 — HQ Vampyre | 0 | Sem novos blocos de ritual encontrados nas nove páginas |

As duas cópias do AS1 não foram contadas duas vezes. Reaparições de rituais em fichas de criaturas e versões discentes/verdadeiras não viram entradas duplicadas; aprimoramentos ficam na descrição.

O básico fornecido é digitalizado: nomes, círculos e elementos foram conferidos pelo índice, e cabeçalhos com erros de OCR foram corrigidos. As descrições vieram de OCR local e podem ainda conter erros de transcrição; as referências permitem conferir a redação original. Nos suplementos foi usada a camada de texto dos PDFs.

`Capturar Momento` (AS2, p. 66) tem inconsistências na própria fonte fornecida: resistência descrita como duração e efeito semelhante ao Mapa Sanguíneo. O catálogo sinaliza essa ocorrência, sem inventar uma errata. `Proteção Sigilosa` mantém explícito que é a versão da ficha de Alê; não inventa aprimoramentos.

## DT e componentes

DT básica: `10 + nível por NEX + PRE` (Básico, p. 121). NEX 99% equivale a 20. O ajuste de DT é editável para poderes, habilidades de trilha e equipamentos; esses bônus não são inferidos a partir dos nomes de itens. Totais numéricos anteriormente salvos são convertidos em ajustes ao carregar a ficha, preservando o total e permitindo que mudanças futuras de NEX/PRE o atualizem.

Componentes de Sangue, Morte, Conhecimento e Energia: categoria 0 e 1 espaço por conjunto, conforme Básico, p. 66–67. Medo não possui componentes. O frontend também oferece esses quatro registros enquanto o catálogo antigo ainda estiver no banco.

## Privacidade

`historiaPublica` passa a controlar histórico, personalidade e objetivo juntos. Aparência continua no JSON compartilhado. A migração v19 conserva as escolhas de visibilidade e transfere os dois campos novos para a tabela que já usa a RLS da história.

O trigger aceita atualizações parciais sem apagar campos privados ausentes do envio. O cache v19 omite os três campos; caches v13 da mesa atual são descartados. Eventos remotos limpam a descrição privada antes de consultar novamente a tabela autorizada.

## Verificação

- `node tests/rituais-interface.cjs`: DT, preservação de total antigo, importação, filtros, duplicatas, campos especiais, componentes e consulta privada.
- `node tests/historias.test.cjs`: permissões, leitura autorizada, cache e salvamento sem sobrescrever dados privados não carregados.
- `node tests/catalogo-grupos.test.cjs` e `node tests/regras.test.cjs`.
- `python3 sql/gerar-rituais.py`: campos obrigatórios, círculos, elementos e duplicatas do lote local.

- `PGLITE_PATH=/caminho/@electric-sql/pglite node tests/migracoes-rituais-historias.cjs`: execução local de migrações e seed, repetição sem duplicatas, atualizações parciais e RLS por papel.
