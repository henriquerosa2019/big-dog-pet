-- Sem isso, supabase.channel(...).on('postgres_changes', ...) nunca dispara
-- pra essas tabelas, mesmo com RLS correta - a tabela precisa estar na
-- publicacao supabase_realtime pro Postgres sequer notificar o Realtime de
-- mudancas. Necessario tanto pro /conta (tutor) quanto pro /admin ficarem
-- ao vivo sem recarregar a pagina.
--
-- Ja aplicado direto no banco de producao via Supabase MCP em 2026-08-29 -
-- este arquivo eh so pra manter o historico versionado.
alter publication supabase_realtime add table public.appointments, public.transport_orders;
