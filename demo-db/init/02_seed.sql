-- ─────────────────────────────────────────────────────────────────────────────
-- Demo data — populates the schema with realistic-looking content.
-- All IDs and timestamps are deterministic (seeded random) so the demo looks
-- the same on every run.
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL TIMEZONE = 'Europe/Paris';

-- ─── Categories ──────────────────────────────────────────────────────────────

INSERT INTO categories (name, slug, icon_url, description, is_featured) VALUES
  ('Electronics',    'electronics',    'https://cdn-icons-png.flaticon.com/512/3659/3659898.png', 'Phones, laptops, headphones, gadgets',         true),
  ('Books',          'books',          'https://cdn-icons-png.flaticon.com/512/2702/2702069.png', 'Novels, technical, comics, magazines',         true),
  ('Clothing',       'clothing',       'https://cdn-icons-png.flaticon.com/512/863/863684.png',   'Shirts, pants, jackets, accessories',          true),
  ('Home & Kitchen', 'home-kitchen',   'https://cdn-icons-png.flaticon.com/512/2877/2877274.png', 'Cookware, decor, small appliances',            false),
  ('Sports',         'sports',         'https://cdn-icons-png.flaticon.com/512/857/857455.png',   'Outdoor gear, fitness, team sports',           false),
  ('Toys & Games',   'toys-games',     'https://cdn-icons-png.flaticon.com/512/3081/3081988.png', 'Board games, puzzles, plushies',               false),
  ('Beauty',         'beauty',         'https://cdn-icons-png.flaticon.com/512/2729/2729007.png', 'Skincare, makeup, fragrances',                 false),
  ('Food & Drink',   'food-drink',     'https://cdn-icons-png.flaticon.com/512/3081/3081559.png', 'Gourmet, snacks, beverages',                   false),
  ('Office',         'office',         'https://cdn-icons-png.flaticon.com/512/3107/3107260.png', 'Stationery, desk supplies, organizers',        false),
  ('Pets',           'pets',           'https://cdn-icons-png.flaticon.com/512/616/616408.png',   'Food, toys, grooming for pets',                false);

-- ─── Users ───────────────────────────────────────────────────────────────────
-- 25 hand-picked, memorable users with realistic profiles.

INSERT INTO users (email, first_name, last_name, phone, bio, avatar_url, is_admin, preferences, tags, created_at) VALUES
  ('alice.anderson@gmail.com',     'Alice',     'Anderson',  '(555) 123-4501', 'Software engineer, coffee lover, open-source enthusiast.',           'https://i.pravatar.cc/200?u=alice',     true,  '{"newsletter": true, "theme": "dark"}',        ARRAY['founder','vip'],   '2025-03-12 09:14:23+01'),
  ('bob.brown@yahoo.com',          'Bob',       'Brown',     '(555) 123-4502', 'Retired teacher with too many gadgets.',                              'https://i.pravatar.cc/200?u=bob',       false, '{"newsletter": false}',                        ARRAY['regular'],         '2025-04-02 15:42:11+02'),
  ('charlie.chen@outlook.com',     'Charlie',   'Chen',      '(555) 123-4503', 'Photographer based in Berlin.',                                       'https://i.pravatar.cc/200?u=charlie',   false, '{"theme": "light", "currency": "EUR"}',        ARRAY['vip'],             '2025-04-18 11:30:55+02'),
  ('diana.davis@hotmail.com',      'Diana',     'Davis',     '(555) 123-4504', NULL,                                                                  'https://i.pravatar.cc/200?u=diana',     false, '{}',                                           NULL,                     '2025-05-07 18:22:09+02'),
  ('emma.evans@gmail.com',         'Emma',      'Evans',     '(555) 123-4505', 'PhD student. Reads too much, sleeps too little.',                     NULL,                                    false, '{"newsletter": true}',                         ARRAY['student'],         '2025-06-21 08:10:44+02'),
  ('frank.foster@gmail.com',       'Frank',     'Foster',    '(555) 123-4506', 'Marathon runner, not very good at it.',                               'https://i.pravatar.cc/200?u=frank',     false, '{}',                                           ARRAY['regular'],         '2025-07-15 14:05:27+02'),
  ('grace.garcia@gmail.com',       'Grace',     'Garcia',    NULL,             'Designer at a small studio. Owns 4 cats.',                            'https://i.pravatar.cc/200?u=grace',     false, '{"newsletter": true, "currency": "USD"}',      ARRAY['regular','pet-owner'], '2025-08-03 19:33:18+02'),
  ('henry.hill@yahoo.com',         'Henry',     'Hill',      '(555) 123-4508', NULL,                                                                  'https://i.pravatar.cc/200?u=henry',     false, '{}',                                           NULL,                     '2025-08-19 10:48:02+02'),
  ('iris.iverson@outlook.com',     'Iris',      'Iverson',   '(555) 123-4509', 'Indie game dev. Currently making a roguelike.',                       'https://i.pravatar.cc/200?u=iris',      false, '{"theme": "dark"}',                            ARRAY['vip','beta'],      '2025-09-04 13:21:39+02'),
  ('jack.johnson@gmail.com',       'Jack',      'Johnson',   '(555) 123-4510', 'Father of 3, husband of 1, owner of 0 hobbies.',                      'https://i.pravatar.cc/200?u=jack',      false, '{}',                                           ARRAY['regular'],         '2025-09-22 16:55:11+02'),
  ('kate.kim@kakao.com',           'Kate',      'Kim',       '(555) 123-4511', 'Translator (KR/EN/FR). Tea over coffee.',                             'https://i.pravatar.cc/200?u=kate',      false, '{"currency": "KRW"}',                          ARRAY['vip'],             '2025-10-08 09:41:25+02'),
  ('liam.lewis@gmail.com',         'Liam',      'Lewis',     '(555) 123-4512', NULL,                                                                  NULL,                                    false, '{}',                                           NULL,                     '2025-10-21 17:12:48+02'),
  ('maya.morris@gmail.com',        'Maya',      'Morris',    '(555) 123-4513', 'UX researcher, terrible at small talk.',                              'https://i.pravatar.cc/200?u=maya',      false, '{"newsletter": true}',                         ARRAY['regular'],         '2025-11-05 11:08:33+01'),
  ('noah.nguyen@gmail.com',        'Noah',      'Nguyen',    '(555) 123-4514', 'Backend dev who fled a bigger company. Now happier.',                 'https://i.pravatar.cc/200?u=noah',      false, '{"theme": "dark", "newsletter": true}',        ARRAY['vip','beta'],      '2025-11-19 14:34:50+01'),
  ('olivia.olsen@gmail.com',       'Olivia',    'Olsen',     NULL,             'Pottery, sourdough, and other lockdown hobbies still going strong.',  'https://i.pravatar.cc/200?u=olivia',    false, '{}',                                           ARRAY['regular'],         '2025-12-02 08:55:17+01'),
  ('pierre.petit@orange.fr',       'Pierre',    'Petit',     '+33 6 12 34 56 78', 'Architect from Lyon. Mostly does residential.',                    'https://i.pravatar.cc/200?u=pierre',    false, '{"currency": "EUR", "language": "fr"}',        ARRAY['vip'],             '2025-12-15 18:42:09+01'),
  ('quinn.quick@protonmail.com',   'Quinn',     'Quick',     NULL,             NULL,                                                                  NULL,                                    false, '{}',                                           NULL,                     '2025-12-28 13:19:55+01'),
  ('rosanna.romero@gmail.com',     'Rosanna',   'Romero',    '(555) 123-4518', 'Voice actor, 12 years in the industry.',                              'https://i.pravatar.cc/200?u=rosanna',   false, '{"newsletter": true}',                         ARRAY['vip'],             '2026-01-08 10:27:42+01'),
  ('samir.singh@gmail.com',        'Samir',     'Singh',     '(555) 123-4519', 'Mechanical engineer, into woodworking on weekends.',                  'https://i.pravatar.cc/200?u=samir',     false, '{}',                                           ARRAY['regular'],         '2026-01-19 15:11:08+01'),
  ('tomas.taylor@gmail.com',       'Tomas',     'Taylor',    '(555) 123-4520', 'Chess player, podcast addict.',                                       'https://i.pravatar.cc/200?u=tomas',     false, '{"theme": "dark"}',                            ARRAY['regular'],         '2026-02-04 09:44:31+01'),
  ('uma.umaki@gmail.com',          'Uma',       'Umaki',     NULL,             'Astronomy hobbyist. Owns a really nice telescope.',                   'https://i.pravatar.cc/200?u=uma',       false, '{}',                                           ARRAY['vip'],             '2026-02-17 14:08:15+01'),
  ('victor.vasquez@gmail.com',     'Victor',    'Vasquez',   '(555) 123-4522', NULL,                                                                  'https://i.pravatar.cc/200?u=victor',    false, '{}',                                           NULL,                     '2026-03-01 11:26:48+01'),
  ('wendy.white@gmail.com',        'Wendy',     'White',     '(555) 123-4523', 'Yoga instructor and amateur florist.',                                'https://i.pravatar.cc/200?u=wendy',     false, '{"newsletter": true}',                         ARRAY['regular'],         '2026-03-14 16:51:23+01'),
  ('xavier.xu@gmail.com',          'Xavier',    'Xu',        '(555) 123-4524', 'Quant. Reads physics papers for fun.',                                'https://i.pravatar.cc/200?u=xavier',    false, '{"currency": "USD"}',                          ARRAY['vip','beta'],      '2026-04-02 13:14:40+02'),
  ('yara.young@gmail.com',         'Yara',      'Young',     '(555) 123-4525', 'Marine biologist. Currently in the Maldives. (Lucky.)',               'https://i.pravatar.cc/200?u=yara',      false, '{}',                                           ARRAY['vip'],             '2026-04-23 08:32:17+02');

-- ─── Products ────────────────────────────────────────────────────────────────
-- 30 products spread across categories with realistic descriptions, prices,
-- and Picsum/Unsplash-style images.

INSERT INTO products (name, description, price, image_url, category_id, in_stock, is_featured, rating, metadata, created_at) VALUES
  -- Electronics
  ('Wireless Noise-Cancelling Headphones', 'Over-ear, 30-hour battery, premium sound. Bluetooth 5.3.', 299.00, 'https://picsum.photos/seed/headphones/400/300', 1, 42, true,  4.7, '{"brand": "AudioCorp", "color": "matte black", "warranty_years": 2}', '2025-04-01 10:00:00+02'),
  ('USB-C Hub 7-in-1',                     'HDMI 4K, 3x USB-A, SD/microSD reader, 100W PD passthrough.',  49.00, 'https://picsum.photos/seed/usbhub/400/300', 1, 156, false, 4.3, '{"brand": "PortPro", "ports": 7}', '2025-04-08 14:30:00+02'),
  ('Mechanical Keyboard 75%',              'Hot-swappable switches, RGB, USB-C wired. Brown switches.',   139.00, 'https://picsum.photos/seed/keyboard/400/300', 1, 33, true,  4.8, '{"layout": "75%", "switch_type": "brown", "rgb": true}', '2025-05-12 09:15:00+02'),
  ('4K Webcam',                            'Auto-focus, beauty mode, dual-mic. Plug and play.',           89.00, 'https://picsum.photos/seed/webcam/400/300', 1, 78, false, 4.1, '{"resolution": "4K", "fps": 60}', '2025-06-05 11:45:00+02'),
  ('Smart Watch Series X',                 'Heart rate, GPS, sleep tracking. 5-day battery.',             249.00, 'https://picsum.photos/seed/watch/400/300', 1, 22, true,  4.5, '{"sensors": ["hr", "gps", "spo2"], "water_resistant_meters": 50}', '2025-07-19 16:20:00+02'),
  -- Books
  ('The Pragmatic Programmer',             '20th anniversary edition. Hunt & Thomas.',                    35.00, 'https://picsum.photos/seed/book1/400/300', 2, 64, true,  4.9, '{"isbn": "978-0135957059", "pages": 352}', '2025-04-15 08:00:00+02'),
  ('Designing Data-Intensive Applications', 'The classic data systems book by Martin Kleppmann.',          47.00, 'https://picsum.photos/seed/book2/400/300', 2, 38, true,  4.8, '{"isbn": "978-1449373320", "pages": 616}', '2025-04-15 08:00:00+02'),
  ('Project Hail Mary',                    'Andy Weir. Sci-fi adventure. Audio version highly recommended.', 18.00, 'https://picsum.photos/seed/book3/400/300', 2, 92, false, 4.7, '{"isbn": "978-0593135204", "pages": 496}', '2025-05-22 13:10:00+02'),
  ('Cooking for Geeks',                    'Real science, great hacks, and good food.',                   29.00, 'https://picsum.photos/seed/book4/400/300', 2, 45, false, 4.4, '{"isbn": "978-1491928059", "pages": 488}', '2025-06-30 10:25:00+02'),
  -- Clothing
  ('Merino Wool T-Shirt',                  'Lightweight, breathable, anti-odor. Made in Portugal.',       65.00, 'https://picsum.photos/seed/tshirt/400/300', 3, 124, true, 4.6, '{"material": "100% merino wool", "weight_gsm": 150, "sizes": ["S","M","L","XL"]}', '2025-04-22 12:00:00+02'),
  ('Selvedge Denim Jeans',                  'Japanese 14oz denim, tapered fit, button fly.',               189.00, 'https://picsum.photos/seed/jeans/400/300', 3, 31, false, 4.5, '{"weight_oz": 14, "origin": "Japan"}', '2025-05-08 14:45:00+02'),
  ('Fleece Hoodie',                        'Heavyweight, kangaroo pocket, ribbed cuffs.',                 79.00, 'https://picsum.photos/seed/hoodie/400/300', 3, 88, false, 4.2, '{"weight_gsm": 380}', '2025-06-12 10:30:00+02'),
  -- Home & Kitchen
  ('Cast Iron Skillet 12"',                'Pre-seasoned, lifetime guarantee, made in USA.',              59.00, 'https://picsum.photos/seed/skillet/400/300', 4, 72, true,  4.9, '{"diameter_inches": 12, "weight_lbs": 8.5}', '2025-04-30 09:00:00+02'),
  ('Espresso Machine',                     'Single boiler, 9-bar pump, manual lever.',                    449.00, 'https://picsum.photos/seed/espresso/400/300', 4, 14, true,  4.7, '{"pressure_bar": 9, "type": "single boiler"}', '2025-05-25 15:15:00+02'),
  ('Linen Bedding Set Queen',              'Stonewashed, hypoallergenic, gets softer over time.',         149.00, 'https://picsum.photos/seed/bedding/400/300', 4, 43, false, 4.4, '{"size": "queen", "material": "100% European linen"}', '2025-07-10 11:50:00+02'),
  -- Sports
  ('Yoga Mat 6mm',                         'Eco-rubber, non-slip. Includes carry strap.',                 49.00, 'https://picsum.photos/seed/yogamat/400/300', 5, 91, false, 4.3, '{"thickness_mm": 6, "material": "natural rubber"}', '2025-05-18 13:00:00+02'),
  ('Trail Running Shoes',                  'Aggressive lugs, waterproof membrane. Lightweight.',          129.00, 'https://picsum.photos/seed/runners/400/300', 5, 28, true,  4.6, '{"weight_g": 295, "drop_mm": 6}', '2025-06-22 16:40:00+02'),
  ('Climbing Rope 60m',                    'Dynamic, 9.8mm. Dry-treated for ice climbing.',               199.00, 'https://picsum.photos/seed/climbing/400/300', 5, 17, false, 4.5, '{"length_m": 60, "diameter_mm": 9.8, "dry_treated": true}', '2025-08-05 10:20:00+02'),
  -- Toys & Games
  ('Board Game: Catan',                    '3-4 players, 60-90 min. Classic strategy game.',              45.00, 'https://picsum.photos/seed/catan/400/300', 6, 67, false, 4.7, '{"players_min": 3, "players_max": 4, "duration_min": 75}', '2025-06-15 09:30:00+02'),
  ('Lego Architecture: Eiffel Tower',      '829 pieces. Display piece for adult builders.',               79.00, 'https://picsum.photos/seed/lego/400/300', 6, 51, true,  4.8, '{"pieces": 829, "age_min": 12}', '2025-07-04 14:00:00+02'),
  -- Beauty
  ('Vitamin C Serum',                      '15% ascorbic acid + ferulic acid. 30ml.',                     39.00, 'https://picsum.photos/seed/serum/400/300', 7, 105, true, 4.5, '{"volume_ml": 30, "vegan": true}', '2025-08-12 11:00:00+02'),
  ('Hand Cream Set',                       '3-pack: lavender, rose, citrus. 50ml each.',                  29.00, 'https://picsum.photos/seed/cream/400/300', 7, 88, false, 4.2, '{"count": 3, "scents": ["lavender","rose","citrus"]}', '2025-09-01 13:45:00+02'),
  -- Food & Drink
  ('Single Origin Coffee 1kg',             'Ethiopian Yirgacheffe, light-medium roast.',                  35.00, 'https://picsum.photos/seed/coffee/400/300', 8, 124, true,  4.6, '{"origin": "Ethiopia", "roast_level": "light-medium", "weight_kg": 1}', '2025-09-15 08:15:00+02'),
  ('Olive Oil Tin 1L',                     'Single estate, cold-pressed, harvest 2024.',                  29.00, 'https://picsum.photos/seed/oliveoil/400/300', 8, 76, false, 4.7, '{"region": "Tuscany", "harvest_year": 2024, "volume_l": 1}', '2025-10-20 14:30:00+02'),
  ('Dark Chocolate Box',                   '12 truffles, 70% cacao. Hand-crafted.',                       45.00, 'https://picsum.photos/seed/chocolate/400/300', 8, 53, false, 4.8, '{"count": 12, "cacao_percent": 70}', '2025-11-08 16:00:00+01'),
  -- Office
  ('Notebook Set',                         '3 dotted notebooks, 192 pages each. A5.',                     24.00, 'https://picsum.photos/seed/notebooks/400/300', 9, 142, false, 4.4, '{"count": 3, "pages_each": 192, "size": "A5"}', '2025-04-12 10:00:00+02'),
  ('Standing Desk Mat',                    'Anti-fatigue, contoured surface. 17"x23".',                   59.00, 'https://picsum.photos/seed/deskmat/400/300', 9, 37, false, 4.3, '{"size_inches": "17x23", "thickness_inches": 0.75}', '2025-06-25 12:30:00+02'),
  -- Pets
  ('Cat Tree XL',                          '170cm, 6 platforms, sisal scratch posts. Beige.',             129.00, 'https://picsum.photos/seed/cattree/400/300', 10, 24, true,  4.5, '{"height_cm": 170, "platforms": 6, "color": "beige"}', '2025-07-30 09:45:00+02'),
  ('Dog Harness Adjustable',               'Reflective, padded, easy-on. Sizes XS-XL.',                   45.00, 'https://picsum.photos/seed/harness/400/300', 10, 92, false, 4.4, '{"sizes": ["XS","S","M","L","XL"], "reflective": true}', '2025-08-22 11:15:00+02'),
  ('Aquarium Starter Kit',                 '40L glass tank, filter, heater, LED. Beginner-friendly.',     119.00, 'https://picsum.photos/seed/aquarium/400/300', 10, 18, false, 4.2, '{"volume_l": 40, "includes": ["filter","heater","led"]}', '2025-09-18 15:50:00+02');

-- ─── Orders ──────────────────────────────────────────────────────────────────
-- 80 orders distributed across users with varying statuses.

INSERT INTO orders (user_id, transaction_id, status, subtotal, tax, total, shipping_address, notes, created_at, shipped_at)
SELECT
  u.id,
  'TXN-' || upper(substring(md5(random()::text || i::text), 1, 8)),
  (ARRAY['paid','shipped','shipped','delivered','delivered','delivered','pending','cancelled','refunded'])[(i % 9) + 1],
  ROUND((random() * 400 + 25)::numeric, 2),
  ROUND((random() * 40 + 2)::numeric, 2),
  0, -- placeholder, computed below
  CASE WHEN i % 4 = 0 THEN NULL ELSE jsonb_build_object(
    'street', (ARRAY['12 Rue de Rivoli','45 Hauptstraße','78 Main Street','3 Calle Mayor','19 Park Avenue'])[(i % 5) + 1],
    'city', (ARRAY['Paris','Berlin','New York','Madrid','London'])[(i % 5) + 1],
    'country', (ARRAY['FR','DE','US','ES','GB'])[(i % 5) + 1],
    'zip', lpad((i * 137 % 99999)::text, 5, '0')
  ) END,
  CASE WHEN i % 7 = 0 THEN 'Please leave at the door if I''m out.' ELSE NULL END,
  '2025-04-01 00:00:00+02'::timestamptz + (i * '4 hours'::interval) + (random() * '6 hours'::interval),
  CASE
    WHEN (i % 9) IN (1, 2, 3, 4, 5) -- shipped or delivered
    THEN '2025-04-02 00:00:00+02'::timestamptz + (i * '4 hours'::interval) + (random() * '48 hours'::interval)
    ELSE NULL
  END
FROM (SELECT id, row_number() OVER () AS rn FROM users) u
CROSS JOIN generate_series(1, 4) AS i
WHERE u.rn <= 20;  -- 20 users × 4 orders each = 80 orders

-- Recompute total = subtotal + tax (the placeholder 0 above)
UPDATE orders SET total = subtotal + tax;

-- ─── Order items ─────────────────────────────────────────────────────────────
-- 1-4 items per order, randomly selected products.

INSERT INTO order_items (order_id, product_id, quantity, unit_price)
SELECT
  o.id,
  p.id,
  (random() * 3 + 1)::int,
  p.price
FROM orders o
CROSS JOIN LATERAL (
  SELECT id, price FROM products ORDER BY random() LIMIT (random() * 3 + 1)::int
) p;

-- ─── Reviews ─────────────────────────────────────────────────────────────────
-- ~60 reviews, biased toward positive (real-world distribution).

INSERT INTO reviews (product_id, user_id, rating, title, comment, is_verified, created_at)
SELECT
  p.id,
  u.id,
  CASE
    WHEN random() < 0.05 THEN 1
    WHEN random() < 0.15 THEN 2
    WHEN random() < 0.30 THEN 3
    WHEN random() < 0.65 THEN 4
    ELSE 5
  END AS rating,
  (ARRAY[
    'Highly recommended', 'Good value for money', 'Met my expectations', 'A bit disappointing',
    'Excellent quality', 'Solid product', 'Could be better', 'Surprisingly great',
    'Does the job', 'Better than expected', 'Average', 'Loved it'
  ])[(random() * 11 + 1)::int],
  (ARRAY[
    'Bought this 2 weeks ago and very happy with it.',
    'Quality matches the price. Would buy again.',
    'Decent product, packaging could be improved though.',
    'Took a while to arrive but worth the wait.',
    'Exactly as described. No complaints.',
    'Some minor issues but nothing dealbreaking.',
    'Best purchase I made this year.',
    'Solid build, great design, fair price.',
    'Not bad. Not life-changing either.',
    'Friendly customer service when I had a question.',
    NULL,
    'I use this every day and it holds up well.'
  ])[(random() * 11 + 1)::int],
  random() < 0.7,  -- 70% verified
  '2025-05-01 00:00:00+02'::timestamptz + (random() * '180 days'::interval)
FROM products p
CROSS JOIN LATERAL (
  SELECT id FROM users ORDER BY random() LIMIT (random() * 3 + 1)::int
) u;

-- ─── Final analyse for query planner ────────────────────────────────────────
ANALYZE;
