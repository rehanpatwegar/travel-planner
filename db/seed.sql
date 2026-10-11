-- ==============================================================================
-- GlobeTrotter — Initial Seed Data
-- ==============================================================================
-- Safe, realistic sample data for local development and testing.
-- Seeds popular travel destinations and curated activities.
--
-- Note: Does NOT insert into auth.users or profiles. User accounts should be
-- created naturally via Supabase Auth signup to generate valid JWTs.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Curated Cities Catalog
-- ------------------------------------------------------------------------------
insert into public.cities (name, country, country_code, region, description, image_url, latitude, longitude, average_daily_cost, currency, is_popular)
values
  (
    'Paris',
    'France',
    'FRA',
    'Western Europe',
    'The City of Light, renowned for art, fashion, gastronomy, and world-famous monuments along the Seine.',
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
    48.856614,
    2.352222,
    180.00,
    'EUR',
    true
  ),
  (
    'Lucerne',
    'Switzerland',
    'CHE',
    'Western Europe',
    'A picturesque Swiss city set against snowcapped Mount Pilatus and Lake Lucerne, famous for medieval architecture.',
    'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?auto=format&fit=crop&w=1200&q=80',
    47.050168,
    8.309307,
    220.00,
    'CHF',
    true
  ),
  (
    'Florence',
    'Italy',
    'ITA',
    'Southern Europe',
    'Cradle of the Renaissance, celebrated for masterworks of art, world-class Tuscan cuisine, and historic marble domes.',
    'https://images.unsplash.com/photo-1543429776-2782fc8e1acd?auto=format&fit=crop&w=1200&q=80',
    43.769560,
    11.255814,
    160.00,
    'EUR',
    true
  ),
  (
    'Tokyo',
    'Japan',
    'JPN',
    'East Asia',
    'A dynamic metropolis harmonizing neon-lit skyscrapers, historic shrines, Michelin dining, and rich pop culture.',
    'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
    35.676192,
    139.650311,
    150.00,
    'JPY',
    true
  ),
  (
    'New York City',
    'United States',
    'USA',
    'North America',
    'The global capital of culture, skyline architecture, Broadway theater, and iconic park avenues.',
    'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1200&q=80',
    40.712776,
    -74.005974,
    250.00,
    'USD',
    true
  ),
  (
    'Barcelona',
    'Spain',
    'ESP',
    'Southern Europe',
    'Catalonia vibrant seaside city famous for Gaudí whimsical architecture, sunlit beaches, and lively tapas culture.',
    'https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1200&q=80',
    41.387917,
    2.169919,
    170.00,
    'EUR',
    true
  )
on conflict (name, country) do nothing;

-- ------------------------------------------------------------------------------
-- 2. Curated Activities Catalog
-- ------------------------------------------------------------------------------

-- Paris Activities
insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Louvre Museum & Tuileries Garden',
  'Explore iconic masterpieces including the Mona Lisa and Venus de Milo in the world largest art museum.',
  'Culture & History',
  22.00,
  'EUR',
  180,
  'Rue de Rivoli, 75001 Paris',
  4.85
from public.cities where name = 'Paris' and country = 'France'
on conflict (city_id, title) do nothing;

insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Eiffel Tower Summit Experience',
  'Ascend to the top deck of the iron lady for panoramic views across the Parisian skyline.',
  'Sightseeing',
  35.00,
  'EUR',
  120,
  'Champ de Mars, 5 Av. Anatole France, 75007 Paris',
  4.70
from public.cities where name = 'Paris' and country = 'France'
on conflict (city_id, title) do nothing;

insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Seine River Sunset Cruise',
  'Glide past Notre-Dame Cathedral and historic bridges illuminated at twilight.',
  'Relaxation',
  18.00,
  'EUR',
  75,
  'Port de la Bourdonnais, 75007 Paris',
  4.65
from public.cities where name = 'Paris' and country = 'France'
on conflict (city_id, title) do nothing;

insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Le Marais Culinary & Pastry Walk',
  'Taste artisanal croissants, macarons, cheeses, and charcuterie through the historic Marais district.',
  'Food & Dining',
  55.00,
  'EUR',
  150,
  'Place des Vosges, 75004 Paris',
  4.90
from public.cities where name = 'Paris' and country = 'France'
on conflict (city_id, title) do nothing;

-- Lucerne Activities
insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Mount Pilatus Golden Round Trip',
  'Travel via boat, the world steepest cogwheel railway, and aerial panorama cableway to Mount Pilatus summit.',
  'Adventure',
  85.00,
  'CHF',
  300,
  'Pilatusstrasse 1, 6010 Kriens',
  4.95
from public.cities where name = 'Lucerne' and country = 'Switzerland'
on conflict (city_id, title) do nothing;

insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Chapel Bridge & Historic Old Town Walk',
  'Stroll across Europe oldest wooden covered bridge and discover Lucerne fresco-adorned guild squares.',
  'Culture & History',
  0.00,
  'CHF',
  60,
  'Kapellbrücke, 6002 Luzern',
  4.75
from public.cities where name = 'Lucerne' and country = 'Switzerland'
on conflict (city_id, title) do nothing;

insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Lake Lucerne Historic Steamboat Cruise',
  'Scenic lake tour between Alpine peaks on a nostalgic paddle steamboat.',
  'Relaxation',
  38.00,
  'CHF',
  90,
  'Werftestrasse 5, 6005 Luzern',
  4.80
from public.cities where name = 'Lucerne' and country = 'Switzerland'
on conflict (city_id, title) do nothing;

-- Florence Activities
insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Uffizi Gallery Renaissance Tour',
  'Witness Botticelli The Birth of Venus, Leonardo da Vinci, and Michelangelo masterpieces.',
  'Culture & History',
  28.00,
  'EUR',
  150,
  'Piazzale degli Uffizi, 6, 50122 Firenze',
  4.90
from public.cities where name = 'Florence' and country = 'Italy'
on conflict (city_id, title) do nothing;

insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Duomo Climb & Piazza del Duomo',
  'Climb Brunelleschi world-famous brick dome for sweeping vistas of red-roofed Florence.',
  'Sightseeing',
  32.00,
  'EUR',
  90,
  'Piazza del Duomo, 50122 Firenze',
  4.85
from public.cities where name = 'Florence' and country = 'Italy'
on conflict (city_id, title) do nothing;

insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Tuscan Hand-Made Pasta & Gelato Workshop',
  'Learn classical pasta making with a local Florentine chef followed by wine tasting and fresh gelato.',
  'Food & Dining',
  75.00,
  'EUR',
  180,
  'Via Faenza, 50123 Firenze',
  4.92
from public.cities where name = 'Florence' and country = 'Italy'
on conflict (city_id, title) do nothing;

-- Tokyo Activities
insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Senso-ji Temple & Asakusa Walking Tour',
  'Visit Tokyo oldest Buddhist temple, stroll Nakamise-dori shopping street, and experience traditional ritual.',
  'Culture & History',
  0.00,
  'JPY',
  90,
  '2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032',
  4.80
from public.cities where name = 'Tokyo' and country = 'Japan'
on conflict (city_id, title) do nothing;

insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Shibuya Sky & Scramble Crossing',
  'Step out onto the open-air 360-degree observation deck perched 229 meters above bustling Shibuya.',
  'Sightseeing',
  20.00,
  'JPY',
  75,
  '2 Chome-24-12 Shibuya, Tokyo 150-0002',
  4.75
from public.cities where name = 'Tokyo' and country = 'Japan'
on conflict (city_id, title) do nothing;

insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Tsukiji Outer Market Morning Food Walk',
  'Sample freshly prepared sushi, grilled wagyu skewers, tamagoyaki omelettes, and street bites.',
  'Food & Dining',
  45.00,
  'JPY',
  120,
  '4 Chome-16-2 Tsukiji, Chuo City, Tokyo 104-0045',
  4.90
from public.cities where name = 'Tokyo' and country = 'Japan'
on conflict (city_id, title) do nothing;

-- New York City Activities
insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Metropolitan Museum of Art (The Met)',
  'Experience over 5,000 years of global art spanning ancient Egyptian temples to modern masters.',
  'Culture & History',
  30.00,
  'USD',
  180,
  '1000 5th Ave, New York, NY 10028',
  4.92
from public.cities where name = 'New York City' and country = 'United States'
on conflict (city_id, title) do nothing;

insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Central Park Bike & Landmarks Loop',
  'Ride through Bethesda Terrace, Bow Bridge, and Strawberry Fields in Manhattan green oasis.',
  'Adventure',
  40.00,
  'USD',
  120,
  'Central Park, New York, NY 10022',
  4.75
from public.cities where name = 'New York City' and country = 'United States'
on conflict (city_id, title) do nothing;

-- Barcelona Activities
insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Sagrada Família Basilica Tour',
  'Marvel at Antoni Gaudí awe-inspiring unfinished basilica with forest-like stone columns and stained glass.',
  'Culture & History',
  34.00,
  'EUR',
  120,
  'C/ de Mallorca, 401, L''Eixample, 08013 Barcelona',
  4.95
from public.cities where name = 'Barcelona' and country = 'Spain'
on conflict (city_id, title) do nothing;

insert into public.activities (city_id, title, description, category, estimated_cost, currency, duration_minutes, address, rating)
select
  id,
  'Gothic Quarter Evening Tapas Crawl',
  'Wander cobblestone alleyways savoring patatas bravas, jamón ibérico, pintxos, and Catalan wines.',
  'Food & Dining',
  50.00,
  'EUR',
  150,
  'Barri Gòtic, 08002 Barcelona',
  4.85
from public.cities where name = 'Barcelona' and country = 'Spain'
on conflict (city_id, title) do nothing;

