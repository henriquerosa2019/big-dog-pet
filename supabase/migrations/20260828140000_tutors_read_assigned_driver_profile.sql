-- Permite que o tutor leia o perfil (nome/telefone) do motorista designado
-- pra retirada/devolução do seu próprio agendamento, sem abrir leitura geral
-- de profiles pra qualquer usuário autenticado. Usado pelo componente
-- DriverContact (mostra "Motorista: Nome · Falar no WhatsApp" na tela de
-- conta do tutor) — pedido do Henrique 2026-08-28.
create policy "Tutors read assigned driver profile"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.transport_orders t
    join public.appointments a on a.id = t.appointment_id
    where t.driver_id = profiles.id
      and a.user_id = auth.uid()
  )
);
