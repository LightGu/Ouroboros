# Segurança de produção — Ouroboros 1.32

## Antes de abrir o site

- Execute as migrações v24 até v29, em ordem. A v28 troca todos os códigos antigos de mesa e a v29
  mantém saldos e operações financeiras protegidos por RLS e RPCs exclusivas do Mestre.
- No Supabase Auth, habilite CAPTCHA (Cloudflare Turnstile ou hCaptcha) para cadastro e login.
- Em Auth > Rate Limits, mantenha limites baixos para login, cadastro e recuperação de senha.
- Configure senha mínima de 10 caracteres no Supabase; o frontend aplica o mesmo limite a novas contas.
- Desabilite novos cadastros depois que o grupo estiver criado, se a mesa for fechada.
- Restrinja Site URL e Redirect URLs aos domínios reais; não deixe curingas amplos.
- Habilite proteção contra senhas vazadas quando disponível no plano.
- Nunca coloque `service_role`, secret key ou senha em `public/js/config.js`; apenas a chave publicável.
- Revise Auth Logs, Postgres Logs e picos de requisições no painel.

## Controles no repositório

- RLS em todas as tabelas expostas e RPCs sensíveis limitadas a `authenticated`.
- Convites de mesa com 48 bits e limite de 10 tentativas por minuto por usuário.
- Storage separado por mesa/usuário e escrita validada no banco.
- Limites de tamanho em perfis, personagens, anotações, mensagens e rolagens.
- CSP, bloqueio de iframe, `nosniff`, política de permissões e SRI do cliente Supabase.
- Conteúdo de usuários é escapado antes de entrar em HTML dinâmico.
- Consultas usam PostgREST/RPC parametrizados; não há concatenação de SQL no navegador.

## Limites conhecidos

- Retratos, mapas e sons dos buckets públicos continuam acessíveis a quem possuir a URL. Não use esses arquivos para segredos.
- Resultados de dados são calculados no navegador e não são prova criptográfica de aleatoriedade.
- CAPTCHA e rate limits de autenticação dependem da configuração do projeto Supabase.

Relate vulnerabilidades ao responsável sem publicar detalhes ou dados de usuários.
