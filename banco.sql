-- =====================================================================
-- BANCO DO PORTFÓLIO E DO PAINEL DA JESSICA PASSOS
--
-- ONDE COLAR: no site do Supabase, abra o seu projeto, clique em
-- "SQL Editor" no menu da esquerda, depois em "New query".
-- Cole TUDO deste arquivo e clique em "Run" (canto de baixo, à direita).
--
-- Pode rodar mais de uma vez sem medo: nada é apagado e nada é duplicado.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. QUEM É A DONA
-- Uma regrinha que responde "sim" só quando quem está logada é você.
-- Todas as trancas abaixo usam essa regra.
-- ---------------------------------------------------------------------
create or replace function public.sou_eu()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'ugcjessicarpassos@gmail.com';
$$;


-- ---------------------------------------------------------------------
-- 2. AS TABELAS
-- Cada "create table" cria uma planilha do seu painel.
-- A coluna "exemplo" marca a linha de exemplo, pra você saber o que apagar.
-- ---------------------------------------------------------------------

-- Vídeos que aparecem no portfólio
create table if not exists public.videos (
  id        bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  titulo    text not null default '',
  link      text not null default '',          -- link do YouTube, Reels, TikTok ou arquivo .mp4
  nicho     text not null default '',          -- sensorial, fitness, beleza, moda, casa ou experiencia
  formato   text not null default '',          -- ex: Unboxing, Demonstração
  marca     text not null default '',
  destaque  text not null default '',          -- ex: 2,4M views
  ordem     integer not null default 0,        -- posição no site (menor aparece primeiro)
  visivel   boolean not null default true      -- o olhinho: mostra ou esconde do site
);

-- A sua base de contatos de empresas
create table if not exists public.marcas (
  id             bigint generated always as identity primary key,
  criado_em      timestamptz not null default now(),
  nome           text not null default '',
  instagram      text not null default '',
  email          text not null default '',
  telefone       text not null default '',
  situacao       text not null default 'lead'
                 check (situacao in ('lead', 'conversando', 'cliente', 'parada')),
  obs            text not null default '',
  ultimo_contato date,
  exemplo        boolean not null default false
);

-- O que gravar, editar e postar em cada dia
create table if not exists public.calendario (
  id        bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  titulo    text not null default '',
  marca     text not null default '',
  tipo      text not null default 'gravar' check (tipo in ('gravar', 'editar', 'postar')),
  data      date not null,
  status    text not null default 'a fazer' check (status in ('a fazer', 'feito')),
  exemplo   boolean not null default false
);

-- Campanhas fechadas com as marcas
create table if not exists public.campanhas (
  id         bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  campanha   text not null default '',
  cliente    text not null default '',
  tipo       text not null default 'Conteúdo' check (tipo in ('Conteúdo', 'Publicidade')),
  status     text not null default 'Briefing'
             check (status in ('Briefing', 'Roteiro', 'Aprovação Roteiro', 'Gravação', 'Edição', 'Aprovado', 'Entregue')),
  qtd        integer not null default 0,        -- quantos vídeos
  valor      numeric(12, 2) not null default 0, -- valor total da campanha, em reais
  prazo      date,
  pagamento  text not null default 'pendente' check (pagamento in ('pendente', 'pago')),
  ativa      boolean not null default true,
  favorita   boolean not null default false,
  exemplo    boolean not null default false
);

-- O que você já marcou no checklist (cada item tem uma chave de texto)
create table if not exists public.marcados (
  chave      text primary key,
  marcado_em timestamptz not null default now()
);

-- Cada visita ao portfólio, pras métricas do painel
create table if not exists public.visitas (
  id     bigint generated always as identity primary key,
  data   timestamptz not null default now(),
  pagina text not null default '',
  origem text not null default ''               -- de onde veio: Instagram, Google, Direto...
);


-- ---------------------------------------------------------------------
-- 3. A TRANCA (RLS) LIGADA EM TODAS AS TABELAS
-- Com a tranca ligada, ninguém lê nem escreve nada,
-- a não ser o que as regras do bloco 4 liberarem.
-- ---------------------------------------------------------------------
alter table public.videos     enable row level security;
alter table public.marcas     enable row level security;
alter table public.calendario enable row level security;
alter table public.campanhas  enable row level security;
alter table public.marcados   enable row level security;
alter table public.visitas    enable row level security;


-- ---------------------------------------------------------------------
-- 4. AS REGRAS DA TRANCA
-- Primeiro apaga a regra antiga (se existir) e cria de novo,
-- assim o arquivo pode rodar mais de uma vez.
-- ---------------------------------------------------------------------

-- 4.1 Você, logada, pode ler, criar, editar e apagar tudo, em todas as tabelas.
drop policy if exists "dona faz tudo" on public.videos;
create policy "dona faz tudo" on public.videos
  for all to authenticated using (public.sou_eu()) with check (public.sou_eu());

drop policy if exists "dona faz tudo" on public.marcas;
create policy "dona faz tudo" on public.marcas
  for all to authenticated using (public.sou_eu()) with check (public.sou_eu());

drop policy if exists "dona faz tudo" on public.calendario;
create policy "dona faz tudo" on public.calendario
  for all to authenticated using (public.sou_eu()) with check (public.sou_eu());

drop policy if exists "dona faz tudo" on public.campanhas;
create policy "dona faz tudo" on public.campanhas
  for all to authenticated using (public.sou_eu()) with check (public.sou_eu());

drop policy if exists "dona faz tudo" on public.marcados;
create policy "dona faz tudo" on public.marcados
  for all to authenticated using (public.sou_eu()) with check (public.sou_eu());

drop policy if exists "dona faz tudo" on public.visitas;
create policy "dona faz tudo" on public.visitas
  for all to authenticated using (public.sou_eu()) with check (public.sou_eu());

-- 4.2 Exceção: o formulário do site pode CRIAR uma marca, sempre como "lead".
--     Não consegue ler, editar nem apagar nada. Os limites de tamanho
--     impedem alguém de mandar textos gigantes.
drop policy if exists "site cria lead" on public.marcas;
create policy "site cria lead" on public.marcas
  for insert to anon, authenticated
  with check (
    situacao = 'lead'
    and exemplo = false
    and char_length(nome) <= 200
    and char_length(email) <= 200
    and char_length(instagram) <= 200
    and char_length(telefone) <= 50
    and char_length(obs) <= 3000
  );

-- 4.3 Exceção: o site pode REGISTRAR uma visita. Ler, só você.
drop policy if exists "site registra visita" on public.visitas;
create policy "site registra visita" on public.visitas
  for insert to anon, authenticated
  with check (char_length(pagina) <= 300 and char_length(origem) <= 100);

-- 4.4 Exceção necessária para o portfólio funcionar: qualquer pessoa pode
--     LER os vídeos marcados como visíveis (eles já aparecem no site de
--     qualquer jeito). Vídeo escondido pelo olhinho continua só pra você.
drop policy if exists "site le videos visiveis" on public.videos;
create policy "site le videos visiveis" on public.videos
  for select to anon, authenticated
  using (visivel = true);


-- ---------------------------------------------------------------------
-- 5. PERMISSÕES DE ACESSO
-- Dizem quais "portas" existem. A tranca do bloco 4 decide quem passa.
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.videos, public.marcas, public.calendario,
  public.campanhas, public.marcados, public.visitas to authenticated;
grant select on public.videos to anon;
grant insert on public.marcas, public.visitas to anon;
grant usage, select on all sequences in schema public to anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. PRIMEIRAS LINHAS
-- Só entram se a tabela estiver vazia (rodar de novo não duplica nada).
-- ---------------------------------------------------------------------

-- 6.1 Os seus 24 vídeos que já estão no portfólio, na ordem dos nichos.
--     Troque título, marca, formato e destaque pelo painel.
insert into public.videos (titulo, link, nicho, ordem)
select v.titulo, v.link, v.nicho, v.ordem
from (values
  ('Vídeo 01', 'https://youtube.com/shorts/BuXYTkAcTx8', 'sensorial',    1),
  ('Vídeo 02', 'https://youtube.com/shorts/09SJ9cvk9sA', 'sensorial',    2),
  ('Vídeo 03', 'https://youtube.com/shorts/bYbx7PSaAws', 'sensorial',    3),
  ('Vídeo 04', 'https://youtube.com/shorts/I7alzuYg6xY', 'sensorial',    4),
  ('Vídeo 01', 'https://youtube.com/shorts/P8lf_rLAGU0', 'fitness',      5),
  ('Vídeo 02', 'https://youtube.com/shorts/2hF5AJEsu6U', 'fitness',      6),
  ('Vídeo 03', 'https://youtube.com/shorts/lywLD-rxNOM', 'fitness',      7),
  ('Vídeo 04', 'https://youtube.com/shorts/CyTenlZls8c', 'fitness',      8),
  ('Vídeo 01', 'https://youtube.com/shorts/RtnM47xZVBg', 'beleza',       9),
  ('Vídeo 02', 'https://youtube.com/shorts/5wSsqSWEHzk', 'beleza',      10),
  ('Vídeo 03', 'https://youtube.com/shorts/JYUPs7DxQa0', 'beleza',      11),
  ('Vídeo 04', 'https://youtube.com/shorts/9_OY8A4A3mc', 'beleza',      12),
  ('Vídeo 01', 'https://youtube.com/shorts/3JYNXBiQ830', 'moda',        13),
  ('Vídeo 02', 'https://youtube.com/shorts/fTWkzCsSXdE', 'moda',        14),
  ('Vídeo 03', 'https://youtube.com/shorts/vMOMZiYj5yI', 'moda',        15),
  ('Vídeo 04', 'https://youtube.com/shorts/C_CnRQ05ZzE', 'moda',        16),
  ('Vídeo 01', 'https://youtube.com/shorts/fe0QgZkCqHY', 'casa',        17),
  ('Vídeo 02', 'https://youtube.com/shorts/Q3mxBSZR5no', 'casa',        18),
  ('Vídeo 03', 'https://youtube.com/shorts/h1vrkrv4rlg', 'casa',        19),
  ('Vídeo 04', 'https://youtube.com/shorts/VwcBguvZNBA', 'casa',        20),
  ('Vídeo 01', 'https://youtube.com/shorts/VPeDsEUpmWU', 'experiencia', 21),
  ('Vídeo 02', 'https://youtube.com/shorts/G9P8jWsGWV8', 'experiencia', 22),
  ('Vídeo 03', 'https://youtube.com/shorts/G0HCqfV8Evc', 'experiencia', 23),
  ('Vídeo 04', 'https://youtube.com/shorts/bW3l9AmJEGE', 'experiencia', 24)
) as v(titulo, link, nicho, ordem)
where not exists (select 1 from public.videos);

-- 6.2 Uma linha de exemplo em Marcas, Calendário e Campanhas.
--     Elas aparecem no painel com a etiqueta "exemplo". Apague quando quiser.
insert into public.marcas (nome, instagram, email, telefone, situacao, obs, ultimo_contato, exemplo)
select 'Marca Exemplo', '@marcaexemplo', 'contato@marcaexemplo.com.br', '', 'lead',
       'Linha de exemplo. Apague quando cadastrar a sua primeira marca.', current_date, true
where not exists (select 1 from public.marcas);

insert into public.calendario (titulo, marca, tipo, data, status, exemplo)
select 'Exemplo: gravar vídeo de unboxing', 'Marca Exemplo', 'gravar', current_date + 2, 'a fazer', true
where not exists (select 1 from public.calendario);

insert into public.campanhas (campanha, cliente, tipo, status, qtd, valor, prazo, pagamento, ativa, favorita, exemplo)
select 'Exemplo: campanha de lançamento', 'Marca Exemplo', 'Conteúdo', 'Briefing', 0, 0,
       current_date + 10, 'pendente', true, false, true
where not exists (select 1 from public.campanhas);

-- Pronto! Se apareceu "Success. No rows returned", deu tudo certo.
