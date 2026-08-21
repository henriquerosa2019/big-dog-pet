-- Retirada e devolução do pet (transporte) — schema
--
-- NOTE: this schema was already applied directly to production earlier today
-- (2026-08-21) via a prior session that ran it through Supabase's SQL runner —
-- that's how schema changes are applied in this project (see project memory:
-- migration files committed here do NOT auto-apply). That prior session's
-- frontend code was lost before it could be committed to git, but the schema
-- survived because it was applied live. This file documents that already-live
-- schema for repo history — do NOT re-run it against production as-is (the
-- types/policies/sequence already exist and this would error out on conflicts).
--
-- 'motorista' was added to app_role by that same prior session:
--   ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'motorista';

-- Tutor addresses (a tutor can have several; one marked default)
CREATE TABLE public.addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Casa',
  cep text,
  street text NOT NULL,
  number text,
  complement text,
  district text NOT NULL,
  city text NOT NULL DEFAULT 'Rio de Janeiro',
  state text NOT NULL DEFAULT 'RJ',
  reference text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addresses_user_id_idx ON public.addresses(user_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage addresses" ON public.addresses FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers read addresses" ON public.addresses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'motorista'));

-- Pickup/delivery pricing zones, keyed by neighborhood ("district") list — no
-- geocoding needed, matches the clinic's own Tijuca → Vila Isabel/Grajaú →
-- Andaraí expansion plan (see project memory: estratégia de vendas).
CREATE TABLE public.delivery_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  districts text[] NOT NULL DEFAULT '{}',
  price_cents integer NOT NULL DEFAULT 0,
  free_above_cents integer,
  eta_minutes integer NOT NULL DEFAULT 30,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active zones" ON public.delivery_zones FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "Admins manage zones" ON public.delivery_zones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed data already live in production (kept here for reference/history):
-- Tijuca e vizinhança            {Tijuca, Praça da Bandeira, Alto da Boa Vista}   R$15,00  grátis acima de R$150  ~25min
-- Vila Isabel e Grajaú           {Vila Isabel, Grajaú, Andaraí, Maracanã}         R$20,00  grátis acima de R$180  ~35min
-- Demais bairros da Zona Norte   {Méier, Engenho Novo, Riachuelo, São Cristóvão,
--                                  Lins de Vasconcelos, Cachambi}                 R$30,00  grátis acima de R$250  ~50min

-- appointments: extended with logistics/ops/pricing/payment fields
ALTER TABLE public.appointments
  ADD COLUMN logistics_type text NOT NULL DEFAULT 'levar',        -- 'levar' | 'buscar' | 'devolver' | 'buscar_e_devolver'
  ADD COLUMN ops_status text NOT NULL DEFAULT 'agendado',         -- pipeline status, see src/lib/transport.ts for the canonical ladder
  ADD COLUMN address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL,
  ADD COLUMN service_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN transport_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN total_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN payment_method text,                                  -- 'pix' | 'cartao' | 'dinheiro' | null
  ADD COLUMN payment_status text NOT NULL DEFAULT 'pendente',       -- 'pendente' | 'pago'
  ADD COLUMN paid_at timestamptz;

CREATE POLICY "Drivers read appointments" ON public.appointments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'motorista'));
CREATE POLICY "Drivers advance appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_order_driver(id)) WITH CHECK (public.is_order_driver(id));

-- Transport order: the pickup+return logistics record for one appointment.
-- Status is derived from which timestamp columns are filled in (no separate
-- status enum column) — see src/lib/transport.ts's deriveTransportPhase().
CREATE SEQUENCE public.transport_order_code_seq;

CREATE TABLE public.transport_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code integer NOT NULL DEFAULT nextval('public.transport_order_code_seq'),   -- human-readable order number ("ORDEM #1048")
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  price_cents integer NOT NULL DEFAULT 0,
  pickup_window_start timestamptz,
  pickup_window_end timestamptz,
  return_window_start timestamptz,
  return_window_end timestamptz,
  assigned_at timestamptz,
  en_route_pickup_at timestamptz,
  picked_up_at timestamptz,
  arrived_shop_at timestamptz,
  en_route_return_at timestamptz,
  delivered_at timestamptz,
  pickup_notes text,
  return_notes text,
  pickup_condition text,          -- free text, e.g. "Pet retirado sem intercorrências."
  return_condition text,
  pickup_confirmed_by text,       -- free text (tutor's name at handoff), not a user FK
  return_confirmed_by text,
  tutor_confirmed_at timestamptz, -- tutor confirms receipt on return
  pickup_lat numeric,
  pickup_lng numeric,
  return_lat numeric,
  return_lng numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX transport_orders_appointment_idx ON public.transport_orders(appointment_id);
CREATE INDEX transport_orders_driver_idx ON public.transport_orders(driver_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transport_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.transport_orders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_order_driver(_appointment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transport_orders t
    WHERE t.appointment_id = _appointment_id AND t.driver_id = auth.uid()
  )
$$;

CREATE POLICY "Tutors create own transport orders" ON public.transport_orders FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = transport_orders.appointment_id AND a.user_id = auth.uid()));
CREATE POLICY "Tutors read own transport orders" ON public.transport_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = transport_orders.appointment_id AND a.user_id = auth.uid()));
CREATE POLICY "Admins manage transport orders" ON public.transport_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers read routes" ON public.transport_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'motorista'));
CREATE POLICY "Drivers update own routes" ON public.transport_orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'motorista') AND (driver_id = auth.uid() OR driver_id IS NULL))
  WITH CHECK (public.has_role(auth.uid(), 'motorista') AND driver_id = auth.uid());
-- Note: the last policy lets an unassigned route (driver_id IS NULL) be
-- self-claimed by any driver, in addition to admin-side assignment.

-- Status history — audit trail for ops_status changes ("segurança na retirada"
-- without photo/signature/GPS). Keyed by appointment_id (covers the whole
-- pipeline, not just the transport leg).
CREATE TABLE public.pet_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pet_status_history_appointment_idx ON public.pet_status_history(appointment_id, created_at);
ALTER TABLE public.pet_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors read own history" ON public.pet_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = pet_status_history.appointment_id AND a.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'motorista')
  );
CREATE POLICY "Staff and tutors write history" ON public.pet_status_history FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_order_driver(appointment_id)
    OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = pet_status_history.appointment_id AND a.user_id = auth.uid())
  );

-- Reviews — one per appointment, separate ratings for the visit vs. the transport leg
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating_overall integer NOT NULL,
  rating_service integer,
  rating_transport integer,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reviews_appointment_idx ON public.reviews(appointment_id);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors manage own reviews" ON public.reviews FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

-- Drivers also need to read the tutor's name/phone and the pet's data for their routes
CREATE POLICY "Drivers read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'motorista'));
CREATE POLICY "Drivers read pets" ON public.pets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'motorista'));
