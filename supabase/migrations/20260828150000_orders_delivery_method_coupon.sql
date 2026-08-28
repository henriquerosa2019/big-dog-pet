-- Adiciona retirada x entrega e cupom informado ao pedido da loja, pra
-- suportar a seleção de retirar-na-loja/receber-em-casa e o campo de cupom
-- no checkout do carrinho (/carrinho). O endereço, quando "receber_em_casa",
-- referencia a tabela addresses já usada pelo agendamento de serviços — sem
-- taxa de entrega calculada aqui (a loja não tem zonas de entrega hoje; a
-- equipe confirma manualmente pelo WhatsApp).
alter table public.orders
  add column if not exists delivery_method text not null default 'retirar_na_loja'
    check (delivery_method in ('retirar_na_loja', 'receber_em_casa')),
  add column if not exists address_id uuid references public.addresses(id) on delete set null,
  add column if not exists coupon_code text;

comment on column public.orders.delivery_method is
  'Escolha do tutor no checkout: retirar_na_loja ou receber_em_casa (sem taxa calculada — equipe confirma manualmente).';
comment on column public.orders.address_id is
  'Endereço de entrega quando delivery_method = receber_em_casa. Reaproveita public.addresses (mesma tabela do agendamento de serviços).';
comment on column public.orders.coupon_code is
  'Código de cupom informado pelo cliente no checkout (não validado automaticamente — a equipe confere e aplica o desconto manualmente pelo WhatsApp).';
