
-- Add role column to users table
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';

-- Update existing admin user to have Admin role
UPDATE users SET role = 'Admin' WHERE phone_number = '8333832987';

-- Update other existing users to be regular users
UPDATE users SET role = 'user' WHERE phone_number != '8333832987';
