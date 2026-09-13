# Aparências e turnos

1. Execute `sql/v15-bestiary-aparencias.sql` no SQL Editor do Supabase, após a v14.
2. Abra o bestiário como mestre e escolha **Importar lote dos livros**.
3. Selecione a pasta local `bestiario/lote`. A revisão 2 substitui as imagens nos mesmos cadastros; repetir a importação não duplica criaturas.

O lote inclui as páginas de ilustrações identificadas nos PDFs antes das páginas de regras. Ilustrações já presentes nas fichas são mantidas. Nem toda ameaça genérica tem uma ilustração individual identificada; não foram inventadas aparências para elas. As imagens continuam no bucket privado. Arquivos anteriores são preservados no Storage para não apagar referências durante importações concorrentes ou respostas perdidas.

**Adicionar à mesa** cria uma ficha rápida oculta no fim da ordem atual, preservando rodada e participante da vez. Cada clique concluído pode adicionar outra cópia. **Ficha do inimigo**, no card da mesa, abre o cadastro privado original. Os PV não são extraídos da imagem: consulte a ficha e preencha-os em **Editar rápido**. Não há OCR.

Para regenerar o lote usando o índice privado e os PDFs locais:

```sh
python3 sql/gerar-bestiario.py
```

Os PDFs, o índice e o lote continuam fora do Git e da publicação na Vercel. A migração e a importação precisam ser executadas na conta do mestre; gerar o lote localmente não o envia ao Supabase.
