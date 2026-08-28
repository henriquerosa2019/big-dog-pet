-- Rastreia quando a mensagem de aniversário (WhatsApp) foi enviada pro
-- tutor pela última vez, pra evitar disparo duplicado no mesmo dia quando
-- há mais de um motivo de aviso (ex.: aniversário do dono e de um pet dele
-- no mesmo dia) ou quando mais de um admin usa o painel.
alter table public.profiles
  add column if not exists last_birthday_message_sent_at timestamptz;

comment on column public.profiles.last_birthday_message_sent_at is
  'Timestamp do último envio manual da mensagem de aniversário/campanha niver pro WhatsApp desse tutor (ver botão "Enviar parabéns" no Dashboard admin). Não é enviado automaticamente — só marca quando o admin confirma o disparo manual.';
