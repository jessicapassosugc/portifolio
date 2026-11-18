-- =====================================================================
-- MÉTRICAS DO PORTFÓLIO: tempo no site e vídeos assistidos
-- Rode este arquivo uma vez no Supabase (SQL Editor). Pode rodar de novo
-- sem problema: ele não apaga nada.
-- =====================================================================

-- O site anota pequenos "acontecimentos", sem identificar ninguém:
--   tempo    = quantos segundos a pessoa ficou com a página aberta na tela
--   abriu    = a pessoa abriu um vídeo
--   assistiu = quantos segundos o vídeo ficou tocando
create table if not exists public.eventos (
  id       bigint generated always as identity primary key,
  data     timestamptz not null default now(),
  tipo     text not null check (tipo in ('tempo', 'abriu', 'assistiu')),
  sessao   text not null default '',            -- um código sorteado por visita, só pra somar os tempos
  video    text not null default '',            -- código do vídeo no YouTube
  titulo   text not null default '',
  segundos integer not null default 0 check (segundos between 0 and 86400)
);

-- A tranca ligada
alter table public.eventos enable row level security;

-- Você, logada, pode tudo
drop policy if exists "dona faz tudo" on public.eventos;
create policy "dona faz tudo" on public.eventos
  for all to authenticated using (public.sou_eu()) with check (public.sou_eu());

-- Exceção: o site pode ANOTAR um acontecimento. Ler, só você.
drop policy if exists "site registra evento" on public.eventos;
create policy "site registra evento" on public.eventos
  for insert to anon, authenticated
  with check (char_length(sessao) <= 40 and char_length(video) <= 20 and char_length(titulo) <= 200);

grant select, insert, update, delete on public.eventos to authenticated;
grant insert on public.eventos to anon;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Resumos prontos para o painel (seguem a mesma tranca: só você lê)
create or replace view public.resumo_tempo with (security_invoker = on) as
  select count(distinct sessao)::int as sessoes,
         coalesce(sum(segundos), 0)::bigint as segundos
  from public.eventos
  where tipo = 'tempo' and sessao <> '';

create or replace view public.resumo_videos with (security_invoker = on) as
  select video,
         max(titulo) as titulo,
         (count(*) filter (where tipo = 'abriu'))::int as vezes,
         coalesce(sum(segundos) filter (where tipo = 'assistiu'), 0)::bigint as segundos
  from public.eventos
  where video <> '' and tipo in ('abriu', 'assistiu')
  group by video;

revoke all on public.resumo_tempo, public.resumo_videos from anon;
grant select on public.resumo_tempo, public.resumo_videos to authenticated;
