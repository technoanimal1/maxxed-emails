-- ════════════════════════════════════════════════════════════════════
--  Maxxed Partners — CMS schema for Supabase (project: psonebi)
--  Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
--  It is safe to re-run: everything is IF NOT EXISTS / idempotent.
--
--  What the client edits from the Supabase dashboard afterwards:
--    • Table Editor → reviews   (add/edit/publish testimonials)
--    • Table Editor → faqs      (add/edit/reorder questions)
--    • Table Editor → copy      (headlines, taglines, stats, contacts, image URLs)
--    • Storage → assets bucket  (upload logos / banners, then paste the public
--                                URL into a copy row, e.g. key = hero_logo)
--
--  Security model: the website reads with the public "anon" key (safe to embed).
--  Only SELECT is allowed to anon, and only on published rows. All writing is
--  done from the dashboard (which uses the service key), so the site can't be
--  spammed or edited by visitors.
-- ════════════════════════════════════════════════════════════════════

-- ── COPY: editable text strings (key → value) ───────────────────────
create table if not exists public.copy (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);

-- ── REVIEWS: testimonials ───────────────────────────────────────────
create table if not exists public.reviews (
  id          bigint generated always as identity primary key,
  quote       text not null,
  name        text default '',
  role        text default '',
  published   boolean not null default true,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── FAQS ────────────────────────────────────────────────────────────
create table if not exists public.faqs (
  id          bigint generated always as identity primary key,
  question    text not null,
  answer      text not null,
  published   boolean not null default true,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Row Level Security: public read-only, published rows only ───────
alter table public.copy    enable row level security;
alter table public.reviews enable row level security;
alter table public.faqs    enable row level security;

drop policy if exists "copy public read"    on public.copy;
drop policy if exists "reviews public read" on public.reviews;
drop policy if exists "faqs public read"    on public.faqs;

create policy "copy public read"    on public.copy    for select to anon using (true);
create policy "reviews public read" on public.reviews for select to anon using (published = true);
create policy "faqs public read"    on public.faqs    for select to anon using (published = true);

-- ── Storage bucket for logos / images (public read) ─────────────────
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do update set public = true;

-- allow anyone to read files in the assets bucket
drop policy if exists "assets public read" on storage.objects;
create policy "assets public read" on storage.objects
  for select to anon using (bucket_id = 'assets');

-- ════════════════════════════════════════════════════════════════════
--  SEED DATA — current site content (edit later in the dashboard)
-- ════════════════════════════════════════════════════════════════════

-- COPY -------------------------------------------------------------------
insert into public.copy (key, value) values
  ('hero_tagline',       'Maxxed Partners is the official affiliate program for Maxxed.io, built around crypto, performance, and long-term partnerships.'),
  ('cta_label',          'Become a partner'),
  ('product_h2',         'What your players get'),
  ('casino_h3',          'Slots, live & originals'),
  ('casino_stat1_num',   '5,000+'), ('casino_stat1_lbl', 'Games'),
  ('casino_stat2_num',   '80+'),    ('casino_stat2_lbl', 'Providers'),
  ('casino_stat3_num',   '10+'),    ('casino_stat3_lbl', 'Originals'),
  ('sport_h3',           'Pre-match, live & cash-out'),
  ('sport_stat1_num',    '35+'),    ('sport_stat1_lbl', 'Sports'),
  ('sport_stat2_num',    '1,000+'), ('sport_stat2_lbl', 'Markets'),
  ('sport_stat3_num',    '50K+'),   ('sport_stat3_lbl', 'Events/mo'),
  ('commission_h2',      'Your rate scales with revenue'),
  ('tier1_pct', '30%'), ('tier1_note', 'up to €10,000 / mo net revenue'),
  ('tier2_pct', '40%'), ('tier2_note', 'up to €25,000 / mo net revenue'),
  ('tier3_pct', '50%'), ('tier3_note', 'up to €40,000 / mo net revenue'),
  ('commission_footnote','* CPA and hybrid deals available on request.'),
  ('mediakit_h2',        'Everything you need to promote'),
  ('reviews_h2',         'Proven, not promised'),
  ('faq_h2',             'Good to know'),
  ('apply_line',         'Tell us about your traffic. We''ll review and get back to you within 24 hours.'),
  ('contact_email',      'affiliates@maxxedpartners.com'),
  ('contact_telegram',   '@Maxxed_affiliates'),
  ('footer_legal',       'The official affiliate program for Maxxed.io. 18+ only. Please gamble responsibly. Program terms apply.'),
  ('registration_url',   ''),   -- where "Become a partner" links (paste your real URL)
  ('terms_url',          ''),   -- footer T&C link
  ('hero_logo',          ''),   -- optional: paste a Storage public URL to override the built-in logo
  ('footer_mark',        '')    -- optional: Storage public URL for the footer/nav mark
on conflict (key) do nothing;

-- REVIEWS ----------------------------------------------------------------
insert into public.reviews (quote, name, role, published, sort) values
  ('The 50% tier is the real deal — no negative carryover means a slow month never eats into the next. First affiliate program I trust with sportsbook traffic.', 'Media buyer', 'LATAM · Sport', true, 10),
  ('One link for casino and sport, and a manager who actually replies. My community converts and the dashboard shows every deposit in real time.', 'Telegram admin', 'Crypto community', true, 20),
  ('Payouts land on time, in crypto, every month. The creatives are on-brand out of the box so I spend my time driving traffic, not making banners.', 'Streamer', 'Casino content', true, 30);

-- FAQS -------------------------------------------------------------------
insert into public.faqs (question, answer, published, sort) values
  ('How can I become your partner?', 'Sign up and log in to your affiliate account, choose the promotional materials, and generate your unique tracking link. Share the promo on your traffic sources — that''s it!', true, 10),
  ('How fast is approval?', 'We review applications within 24 hours.', true, 20),
  ('How is my commission calculated?', 'Your commission is calculated on a Revenue Share model. Formula: Commission = (Total Bets − Player Wins − Bonuses − Admin Fees) × Your Deal Percentage.', true, 30),
  ('When and how do I get paid?', 'Monthly, in crypto, straight to your wallet.', true, 40),
  ('How long is the cookie duration?', 'The cookie duration is 30 days from the last click.', true, 50),
  ('Is there a minimum traffic requirement?', 'No minimum to join.', true, 60);
