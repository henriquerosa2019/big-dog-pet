ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS temperament text,
  ADD COLUMN IF NOT EXISTS allergies text;

CREATE TABLE public.medical_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  visit_at timestamp with time zone NOT NULL DEFAULT now(),
  reason text NOT NULL,
  diagnosis text,
  treatment text,
  prescription text,
  weight_kg numeric(5,2),
  vet_name text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_records TO authenticated;
GRANT ALL ON public.medical_records TO service_role;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view pet records" ON public.medical_records
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = medical_records.pet_id AND p.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage records" ON public.medical_records
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_medical_records_updated BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vaccinations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vaccine_name text NOT NULL,
  dose text,
  applied_at date NOT NULL DEFAULT CURRENT_DATE,
  next_due_at date,
  vet_name text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaccinations TO authenticated;
GRANT ALL ON public.vaccinations TO service_role;
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage vaccinations" ON public.vaccinations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = vaccinations.pet_id AND p.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = vaccinations.pet_id AND p.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_vaccinations_updated BEFORE UPDATE ON public.vaccinations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_medical_records_pet ON public.medical_records(pet_id, visit_at DESC);
CREATE INDEX idx_vaccinations_pet ON public.vaccinations(pet_id, next_due_at);