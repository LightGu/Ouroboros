# Migrações do banco

Arquivos incrementais para instalações existentes do Supabase. Aplique em ordem numérica,
começando pela versão seguinte à que já está instalada.

Para uma instalação nova, use [`../schema.sql`](../schema.sql), que reúne o schema completo.
Não edite migrações já aplicadas; crie uma nova versão para cada alteração de banco.

Após a v29, aplique `v30-codigos-mesa-6-caracteres.sql` para gerar e aceitar códigos de mesa
com 6 caracteres.
