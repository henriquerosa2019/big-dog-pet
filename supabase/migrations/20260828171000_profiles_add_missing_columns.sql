-- Mesma classe de bug do "origin" em appointments: a aba Clientes do admin
-- (commit e7e2c0e) já faz `.select("...birth_date, email, cpf...")` e
-- `.update({ birth_date, cpf, ... })` em `profiles`, e o cadastro de novo
-- cliente (createClient) já envia birth_date no metadata do signUp -- mas
-- essas colunas nunca existiram na tabela. Isso fazia a consulta de perfis
-- do admin (e a busca por CPF) falhar com 400 silenciosamente.
alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists email text,
  add column if not exists cpf text,
  add column if not exists preferred_payment text;

comment on column public.profiles.birth_date is 'Data de nascimento do tutor (editável pelo admin na aba Clientes).';
comment on column public.profiles.email is 'Cópia do e-mail de auth.users, mantida em profiles para exibição/busca no admin sem precisar de acesso admin à tabela auth.users.';
comment on column public.profiles.cpf is 'CPF do tutor, opcional, usado na busca da aba Clientes do admin.';
comment on column public.profiles.preferred_payment is 'Forma de pagamento preferida do tutor (uso futuro).';

-- Atualiza o trigger de criação de perfil pra preencher email e birth_date
-- automaticamente a partir do signup (auth.users.email e
-- raw_user_meta_data->>'birth_date', já enviado pelo cadastro de cliente do
-- admin), em vez de deixar sempre null.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, birth_date)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::date
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

-- Backfill: preenche email pra quem já tinha perfil, a partir de auth.users
-- (só isso dá pra recuperar retroativamente -- birth_date/cpf de contas já
-- existentes ficam null até o admin editar manualmente na aba Clientes).
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;
