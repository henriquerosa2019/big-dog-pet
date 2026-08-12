CREATE TABLE public.care_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  reminder_type text NOT NULL DEFAULT 'outro' CHECK (reminder_type IN ('retirada_pontos', 'exame', 'retorno', 'outro')),
  title text NOT NULL,
  due_date date NOT NULL,
  notes text,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_reminders TO authenticated;
GRANT ALL ON public.care_reminders TO service_role;
ALTER TABLE public.care_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage care reminders" ON public.care_reminders
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = care_reminders.pet_id AND p.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = care_reminders.pet_id AND p.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_care_reminders_updated BEFORE UPDATE ON public.care_reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_care_reminders_pet ON public.care_reminders(pet_id, due_date);
