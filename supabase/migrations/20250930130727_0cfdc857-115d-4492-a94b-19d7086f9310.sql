-- Remove cookie approval system tables and types

-- Drop tables (cascade will remove associated policies and triggers)
DROP TABLE IF EXISTS public.raw_cookie_requests CASCADE;
DROP TABLE IF EXISTS public.approvals CASCADE;

-- Drop the approval_status enum type
DROP TYPE IF EXISTS public.approval_status CASCADE;

-- Note: The approve-request edge function will be removed separately