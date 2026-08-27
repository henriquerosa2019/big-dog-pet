-- care_reminders (recreated for real: earlier migration file was committed but never applied to the DB)
CREATE TABLE IF NOT EXISTS public.care_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  reminder_type text NOT NULL DEFAULT 'outro' CHECK (reminder_type IN ('retirada_pontos', 'exame', 'retorno', 'outro')),
  title text NOT NULL,
  due_date date NOT NULL,
  notes text,
  completed boolean NOT NULL DEFAULT false,
  source_record_id uuid REFERENCES public.medical_records(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- NOTE (clone big-dog-pet, 2026-08-27): CREATE TABLE IF NOT EXISTS above is a
-- no-op when care_reminders already exists (created by an earlier migration
-- in this same clone run), so source_record_id needs an explicit backfill.
ALTER TABLE public.care_reminders
  ADD COLUMN IF NOT EXISTS source_record_id uuid REFERENCES public.medical_records(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_reminders TO authenticated;
GRANT ALL ON public.care_reminders TO service_role;
ALTER TABLE public.care_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage care reminders" ON public.care_reminders;
CREATE POLICY "Owners manage care reminders" ON public.care_reminders
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = care_reminders.pet_id AND p.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = care_reminders.pet_id AND p.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_care_reminders_updated ON public.care_reminders;
CREATE TRIGGER trg_care_reminders_updated BEFORE UPDATE ON public.care_reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_care_reminders_pet ON public.care_reminders(pet_id, due_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_care_reminders_source_record ON public.care_reminders(source_record_id) WHERE source_record_id IS NOT NULL;

-- medical_records: structured type, medication, attachments, linked return date
ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'consulta',
  ADD COLUMN IF NOT EXISTS medication text,
  ADD COLUMN IF NOT EXISTS dosage text,
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS attachments text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS next_return_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medical_records_record_type_check'
  ) THEN
    ALTER TABLE public.medical_records
      ADD CONSTRAINT medical_records_record_type_check
      CHECK (record_type IN ('consulta','exame','cirurgia','retorno','emergencia','vacina'));
  END IF;
END $$;

-- storage bucket for exam results / photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-attachments', 'medical-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff upload medical attachments" ON storage.objects;
CREATE POLICY "Staff upload medical attachments" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'medical-attachments' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owners and staff read medical attachments" ON storage.objects;
CREATE POLICY "Owners and staff read medical attachments" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'medical-attachments' AND (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.owner_id = auth.uid()
        AND (storage.foldername(name))[1] = p.id::text
    )
  )
);

DROP POLICY IF EXISTS "Staff delete medical attachments" ON storage.objects;
CREATE POLICY "Staff delete medical attachments" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'medical-attachments' AND public.has_role(auth.uid(), 'admin'));
