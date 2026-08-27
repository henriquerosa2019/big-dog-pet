-- Porte do pet + regra de veículo para a retirada/devolução.
--
-- Primeira etapa da evolução de precificação/logística pedida por Henrique:
-- antes de entrar em cálculo de distância real (que depende de uma API de
-- mapas e de uma Edge Function — deixado para uma próxima etapa), cadastramos
-- o porte do pet e o veículo de cada motorista, e passamos a impedir que um
-- pet de porte médio/grande seja designado a um motorista de moto.
--
-- IMPORTANT (convenção do projeto): commit sozinho NÃO aplica isso em
-- produção. Rode este arquivo manualmente no SQL editor do Supabase do
-- projeto (project_id 742d96f8-a94b-437f-82eb-08d937f34c53).

-- Porte do pet. A coluna `size` já existia (sessão perdida que gerou boa
-- parte deste schema), mas como text livre, sem NOT NULL/DEFAULT/CHECK, e os
-- 3 pets existentes estavam todos com size = NULL. Backfill + trava aqui.
-- Default 'medio' (e não 'pequeno') de propósito: um pet sem porte definido
-- ainda deve exigir carro até o tutor/admin confirmarem que é realmente
-- pequeno — mais seguro do que liberar moto por omissão de dado.
--
-- NOTE (clone big-dog-pet, 2026-08-27): a migração original do pet-care-hub
-- pressupõe que a coluna `size` já existe (foi criada fora de uma migration,
-- direto em produção — ver project memory sobre drift de schema). Neste
-- banco novo ela nunca existiu, então precisa ser criada aqui antes de alterá-la.
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS size text;
UPDATE public.pets SET size = 'medio' WHERE size IS NULL;
ALTER TABLE public.pets ALTER COLUMN size SET DEFAULT 'medio';
ALTER TABLE public.pets ALTER COLUMN size SET NOT NULL;
ALTER TABLE public.pets ADD CONSTRAINT pets_size_check CHECK (size IN ('pequeno', 'medio', 'grande'));

-- Veículo do motorista (perfil com role 'motorista'). Nulo até o admin
-- cadastrar; nesse caso o app trata como "carro" por segurança (ver
-- src/lib/transport.ts:isVehicleAllowedForPet).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_type text
    CHECK (vehicle_type IN ('moto', 'carro'));
