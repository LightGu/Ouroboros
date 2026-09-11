/* ============================================================
   Dados do projeto Supabase.
   Ficam em: Supabase → Project Settings → API

   Só entra aqui chave PUBLICÁVEL (sb_publishable_... ou anon).
   Ela é pública de propósito: sozinha não abre nada, quem manda
   são as regras de RLS definidas em sql/schema.sql.

   NUNCA cole aqui a sb_secret_... / service_role — essa ignora
   todas as regras e este arquivo vai pro navegador de todo mundo.
   ============================================================ */

const SUPABASE_URL      = 'https://dyymizoukymkjwmvnerf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_HebrwXHvwd4cundXPqkkmQ_-pIfeiDo';
