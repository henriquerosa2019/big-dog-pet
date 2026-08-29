-- Autoriza o canal Realtime de rastreamento GPS ao vivo do motorista
-- (broadcast, topico "driver-location:<appointment_id>", ver
-- src/lib/driverLocation.ts). Sem essas politicas em realtime.messages,
-- canais privados (config: { private: true }) rejeitam qualquer
-- assinatura/envio. Escopo por agendamento: so o tutor dono do
-- agendamento, o motorista designado na transport_order correspondente e
-- admins podem ler; so o motorista designado pode enviar.
--
-- Ja aplicado direto no banco de producao via Supabase MCP em 2026-08-29 -
-- este arquivo eh so pra manter o historico versionado (nao roda sozinho em
-- CD, ver nota em project_petcarehub_lovable_github sobre migrations nao
-- auto-aplicarem).

create policy "transport participants can receive driver location"
on "realtime"."messages"
for select
to authenticated
using (
  realtime.topic() like 'driver-location:%'
  and exists (
    select 1
    from public.transport_orders t
    join public.appointments a on a.id = t.appointment_id
    where a.id::text = split_part(realtime.topic(), ':', 2)
      and (
        a.user_id = auth.uid()
        or t.driver_id = auth.uid()
        or public.has_role(auth.uid(), 'admin')
      )
  )
);

create policy "assigned driver can send driver location"
on "realtime"."messages"
for insert
to authenticated
with check (
  realtime.topic() like 'driver-location:%'
  and exists (
    select 1
    from public.transport_orders t
    where t.appointment_id::text = split_part(realtime.topic(), ':', 2)
      and t.driver_id = auth.uid()
  )
);
