-- Phase 3: Candidate Invitation Foundation - Schema updates

-- Add previousStatus column to candidate_invitations if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'candidate_invitations'
        AND column_name = 'previous_status'
    ) THEN
        ALTER TABLE candidate_invitations ADD COLUMN previous_status VARCHAR;
        RAISE NOTICE 'Added column: candidate_invitations.previous_status';
    ELSE
        RAISE NOTICE 'Column already exists: candidate_invitations.previous_status';
    END IF;
END $$;

-- Change default value for status column from 'draft' to 'sent'
DO $$
BEGIN
    ALTER TABLE candidate_invitations ALTER COLUMN status SET DEFAULT 'sent';
    RAISE NOTICE 'Updated default for candidate_invitations.status to ''sent''';
END $$;

-- Add eventType column to order_status_history if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'order_status_history'
        AND column_name = 'event_type'
    ) THEN
        ALTER TABLE order_status_history ADD COLUMN event_type VARCHAR NOT NULL DEFAULT 'status_change';
        RAISE NOTICE 'Added column: order_status_history.event_type';
    ELSE
        RAISE NOTICE 'Column already exists: order_status_history.event_type';
    END IF;
END $$;

-- Add message column to order_status_history if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'order_status_history'
        AND column_name = 'message'
    ) THEN
        ALTER TABLE order_status_history ADD COLUMN message TEXT;
        RAISE NOTICE 'Added column: order_status_history.message';
    ELSE
        RAISE NOTICE 'Column already exists: order_status_history.message';
    END IF;
END $$;

-- Verification block
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Verify candidate_invitations.previous_status
    SELECT COUNT(*) INTO v_count
    FROM information_schema.columns
    WHERE table_name = 'candidate_invitations' AND column_name = 'previous_status';

    IF v_count = 1 THEN
        RAISE NOTICE 'Verification: candidate_invitations.previous_status column exists';
    ELSE
        RAISE EXCEPTION 'Verification failed: candidate_invitations.previous_status column not found';
    END IF;

    -- Verify order_status_history.event_type
    SELECT COUNT(*) INTO v_count
    FROM information_schema.columns
    WHERE table_name = 'order_status_history' AND column_name = 'event_type';

    IF v_count = 1 THEN
        RAISE NOTICE 'Verification: order_status_history.event_type column exists';
    ELSE
        RAISE EXCEPTION 'Verification failed: order_status_history.event_type column not found';
    END IF;

    -- Verify order_status_history.message
    SELECT COUNT(*) INTO v_count
    FROM information_schema.columns
    WHERE table_name = 'order_status_history' AND column_name = 'message';

    IF v_count = 1 THEN
        RAISE NOTICE 'Verification: order_status_history.message column exists';
    ELSE
        RAISE EXCEPTION 'Verification failed: order_status_history.message column not found';
    END IF;

    RAISE NOTICE 'Phase 3 migration completed successfully';
END $$;