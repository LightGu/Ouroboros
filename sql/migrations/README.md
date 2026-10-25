# Migrações do banco

Arquivos incrementais para instalações existentes do Supabase. Aplique em ordem numérica,
começando pela versão seguinte à que já está instalada.

Para uma instalação nova, use [`../schema.sql`](../schema.sql), que reúne o schema completo.
Não edite migrações já aplicadas; crie uma nova versão para cada alteração de banco.

Após a v29, aplique `v30-codigos-mesa-6-caracteres.sql` para gerar e aceitar códigos de mesa
com 6 caracteres. Em seguida, aplique `v31-sistemas-dnd.sql` para adicionar a escolha do
sistema por mesa e habilitar Dungeons & Dragons 5e. Mesas existentes permanecem como
Ordem Paranormal. Por fim, aplique `v32-super-mestre.sql` para instalar o painel global
de moderação autorizado e auditado.
Depois, aplique `v33-observacao-mesas.sql` para habilitar a lista de mesas de outros
mestres e sua visualização administrativa estritamente somente leitura.
