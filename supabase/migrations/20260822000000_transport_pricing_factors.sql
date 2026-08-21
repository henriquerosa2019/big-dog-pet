-- Pricing factors for retirada/devolução: desconto de cliente recorrente + cupons.
--
-- Henrique pediu que o valor da retirada/devolução dependa de distância
-- (já coberto por delivery_zones.price_cents, por bairro), cliente novo vs.
-- antigo e cupom/desconto, tudo configurável pelo admin. As duas primeiras
-- tabelas abaixo cobrem os dois fatores que ainda faltavam.
--
-- IMPORTANT (project convention): commit sozinho NÃO aplica isso em produção.
-- Rode este arquivo manualmente no SQL editor do Supabase do projeto
-- (project_id 742d96f8-a94b-437f-82eb-08d937f34c53) antes que o app passe a
-- depender dessas tabelas/coluna.

-- Registro de como o valor final da retirada/devolução foi calculado (base da
-- zona, desconto de cliente recorrente aplicado, cupom usado) — transparência
-- pro tutor e pro admin, sem precisar de tabela de auditoria separada.
ALTER TABLE public.transport_orders
  ADD COLUMN IF NOT EXISTS fee_breakdown jsonb;

-- Configuração única (linha singleton) do desconto padrão de cliente
-- recorrente, ajustável pelo admin na aba Retirada/Entrega.
CREATE TABLE public.transport_settings (
  id boolean NOT NULL DEFAULT true PRIMARY KEY CHECK (id = true),
  returning_client_discount_percent integer
    CHECK (returning_client_discount_percent BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.transport_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transport_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.transport_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads transport settings" ON public.transport_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage transport settings" ON public.transport_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Cupons de desconto para a retirada/devolução, cadastrados pelo admin.
CREATE TABLE public.transport_coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value integer NOT NULL CHECK (discount_value >= 0), -- % (0-100) ou centavos, conforme discount_type
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transport_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated reads coupons" ON public.transport_coupons
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage transport coupons" ON public.transport_coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
