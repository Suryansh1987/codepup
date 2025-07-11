-- Insert admin user in auth.users table
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin123@gmail.com',
  crypt('admin1234', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Insert sample user in auth.users table
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000002',
  'authenticated',
  'authenticated',
  'user@example.com',
  crypt('user123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Insert profiles
INSERT INTO profiles (id, email, full_name, role) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'admin123@gmail.com', 'Admin User', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'user@example.com', 'John Doe', 'user')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- Insert sample products
INSERT INTO products (id, name, description, price, category, image_url, stock_quantity, is_featured) VALUES 
  ('00000000-0000-0000-0000-000000000011', 'Elegant Dining Table', 'Beautiful solid wood dining table perfect for family gatherings. Seats up to 8 people comfortably.', 1299.99, 'Dining Tables', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 15, true),
  ('00000000-0000-0000-0000-000000000012', 'Modern Coffee Table', 'Sleek glass-top coffee table with wooden legs. Perfect for contemporary living rooms.', 399.99, 'Coffee Tables', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 25, true),
  ('00000000-0000-0000-0000-000000000013', 'Executive Office Desk', 'Spacious executive desk with built-in storage. Ideal for home offices and professional workspaces.', 899.99, 'Office Desks', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 12, true),
  ('00000000-0000-0000-0000-000000000014', 'Rustic Farmhouse Table', 'Handcrafted farmhouse table with distressed finish. Brings warmth to any dining space.', 1599.99, 'Dining Tables', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 8, true),
  ('00000000-0000-0000-0000-000000000015', 'Minimalist Side Table', 'Clean-lined side table perfect for bedrooms and living areas. Available in multiple finishes.', 199.99, 'Side Tables', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 30, false),
  ('00000000-0000-0000-0000-000000000016', 'Industrial Work Table', 'Heavy-duty work table with steel frame and wooden top. Perfect for workshops and studios.', 749.99, 'Work Tables', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 10, false),
  ('00000000-0000-0000-0000-000000000017', 'Luxury Console Table', 'Elegant console table with marble top and gold accents. Statement piece for entryways.', 1899.99, 'Console Tables', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 5, true),
  ('00000000-0000-0000-0000-000000000018', 'Adjustable Standing Desk', 'Ergonomic height-adjustable desk for healthy working. Electric motor for smooth transitions.', 699.99, 'Office Desks', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 18, true),
  ('00000000-0000-0000-0000-000000000019', 'Vintage Bistro Table', 'Charming bistro table with cast iron base and wooden top. Perfect for cafes and kitchens.', 449.99, 'Dining Tables', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 22, false),
  ('00000000-0000-0000-0000-000000000020', 'Scandinavian Nightstand', 'Simple yet functional nightstand with clean lines. Features one drawer and open shelf.', 299.99, 'Side Tables', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 40, false),
  ('00000000-0000-0000-0000-000000000021', 'Glass Conference Table', 'Professional conference table with tempered glass top. Seats up to 12 people.', 2299.99, 'Conference Tables', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 6, false),
  ('00000000-0000-0000-0000-000000000022', 'Reclaimed Wood Table', 'Eco-friendly table made from reclaimed barn wood. Each piece has unique character and history.', 1799.99, 'Dining Tables', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500', 7, true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample testimonials
INSERT INTO testimonials (id, name, location, content, rating) VALUES 
  ('00000000-0000-0000-0000-000000000031', 'Sarah Johnson', 'New York, NY', 'Absolutely love my new dining table! The craftsmanship is exceptional and it''s become the centerpiece of our home.', 5),
  ('00000000-0000-0000-0000-000000000032', 'Michael Chen', 'Los Angeles, CA', 'The coffee table exceeded my expectations. Perfect size and the quality is outstanding. Highly recommend!', 5),
  ('00000000-0000-0000-0000-000000000033', 'Emily Rodriguez', 'Chicago, IL', 'Great customer service and fast delivery. The office desk is exactly what I needed for my home office setup.', 4),
  ('00000000-0000-0000-0000-000000000034', 'David Thompson', 'Houston, TX', 'Beautiful rustic table that fits perfectly in our farmhouse kitchen. The delivery team was professional and careful.', 5),
  ('00000000-0000-0000-0000-000000000035', 'Lisa Park', 'Phoenix, AZ', 'The standing desk has improved my work posture significantly. Love the smooth height adjustment feature.', 4),
  ('00000000-0000-0000-0000-000000000036', 'James Wilson', 'Philadelphia, PA', 'Excellent quality furniture at reasonable prices. The console table is a stunning addition to our entryway.', 5)
ON CONFLICT (id) DO NOTHING;

-- Insert sample orders
INSERT INTO orders (id, user_id, total_amount, status, shipping_address, notes) VALUES 
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000002', 1399.99, 'completed', '{"firstName": "John", "lastName": "Doe", "address": "123 Main St", "city": "Anytown", "state": "CA", "zipCode": "12345"}', 'Please handle with care'),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000002', 699.99, 'processing', '{"firstName": "John", "lastName": "Doe", "address": "123 Main St", "city": "Anytown", "state": "CA", "zipCode": "12345"}', 'Rush delivery requested')
ON CONFLICT (id) DO NOTHING;

-- Insert sample order items
INSERT INTO order_items (id, order_id, product_id, quantity, price) VALUES 
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000011', 1, 1299.99),
  ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000018', 1, 699.99)
ON CONFLICT (id) DO NOTHING;