-- Step 1: Add demo_admin to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'demo_admin';