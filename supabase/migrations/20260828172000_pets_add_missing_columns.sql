-- Mesma classe de bug do "origin"/profiles: o types.ts já declarava essas 4
-- colunas em `pets` (Row/Insert/Update) e o PRD já as documentava, mas elas
-- nunca existiram na tabela de verdade. Hoje nenhuma tela ainda lê/escreve
-- esses campos (conferido no código), então não geravam 400 em produção --
-- mas qualquer feature nova escrita "confiando" no types.ts (foto do pet,
-- cor, cuidados especiais, veterinário de referência) quebraria do mesmo
-- jeito que aconteceu com appointments.origin e profiles.cpf/email/birth_date.
-- Criando agora pra eliminar essa armadilha antes que alguém pise nela.
alter table public.pets
  add column if not exists color text,
  add column if not exists special_care text,
  add column if not exists preferred_vet text,
  add column if not exists photo_url text;

comment on column public.pets.color is 'Cor/pelagem do pet (uso futuro, ainda sem tela de edição).';
comment on column public.pets.special_care is 'Cuidados especiais do pet, texto livre (uso futuro, ainda sem tela de edição).';
comment on column public.pets.preferred_vet is 'Veterinário de referência do pet, texto livre (uso futuro, ainda sem tela de edição).';
comment on column public.pets.photo_url is 'URL da foto do pet (uso futuro, ainda sem upload implementado).';
