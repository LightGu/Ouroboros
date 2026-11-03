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
Por fim, aplique `v34-privacidade-mensagens-mestres.sql` para remover dos mestres
comuns o acesso a conversas privadas trocadas exclusivamente entre jogadores.
Depois, aplique `v35-mensagens-e-compartilhamento-notas.sql`: ela garante que o
painel do Mestre Principal continue lendo todas as mensagens, adiciona destinatários
específicos às anotações e renomeia notas com atualização transacional dos wikilinks.
Depois, aplique `v36-mensagens-locais-mestre-principal.sql` para devolver a aba
local de mensagens exclusivamente ao Mestre Principal quando ele for o mestre da mesa.
