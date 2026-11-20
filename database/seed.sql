INSERT INTO public.category (name, description) VALUES
  ('Bolts & Screws', 'Bolts, screws, and related fasteners'),
  ('Nuts & Washers', 'Nuts, washers, and related hardware'),
  ('Tools', 'Hand tools and accessories'),
  ('Other', 'Other inventory items')
ON CONFLICT (name) DO NOTHING;
