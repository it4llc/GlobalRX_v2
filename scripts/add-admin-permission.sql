-- Script to add admin permission to andythellman@gmail.com user
-- This is needed after strengthening permission checks per audit report

UPDATE "User"
SET permissions = jsonb_set(
    COALESCE(permissions, '{}')::jsonb,
    '{admin}',
    'true'::jsonb
)
WHERE email = 'andythellman@gmail.com';

-- Verify the update
SELECT email, permissions
FROM "User"
WHERE email = 'andythellman@gmail.com';