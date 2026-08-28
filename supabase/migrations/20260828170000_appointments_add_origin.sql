-- Corrige bug real que impedia QUALQUER agendamento pelo /agendar: o código
-- (tanto o insert em /agendar quanto a aba Agendamentos/Clientes do admin)
-- já lia/escrevia a coluna "origin" em appointments, mas ela nunca existiu
-- de fato na tabela -- todo INSERT retornava 400 do PostgREST
-- ("Could not find the 'origin' column"). Usada para marcar automaticamente
-- (ou manualmente, pelo admin) que um agendamento veio da Campanha Niver.
alter table public.appointments
  add column if not exists origin text;

comment on column public.appointments.origin is
  'Origem do agendamento (ex.: "campanha_niver" quando veio do link da oferta de aniversário, ou marcado manualmente pelo admin). Null = origem normal.';
