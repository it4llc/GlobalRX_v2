-- Phase 2: Add workflow configuration fields to workflow_sections table
ALTER TABLE workflow_sections
ADD COLUMN placement VARCHAR(20) NOT NULL DEFAULT 'before_services',
ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'text',
ADD COLUMN content TEXT,
ADD COLUMN file_url VARCHAR(500),
ADD COLUMN file_name VARCHAR(255);

-- Add constraint for placement values
ALTER TABLE workflow_sections
ADD CONSTRAINT check_placement CHECK (placement IN ('before_services', 'after_services'));

-- Add constraint for type values
ALTER TABLE workflow_sections
ADD CONSTRAINT check_type CHECK (type IN ('text', 'document'));

-- Phase 2: Add email template and gap tolerance fields to workflows table
ALTER TABLE workflows
ADD COLUMN email_subject VARCHAR(200),
ADD COLUMN email_body TEXT,
ADD COLUMN gap_tolerance_days INTEGER;

-- Add constraint for gap_tolerance_days
ALTER TABLE workflows
ADD CONSTRAINT check_gap_tolerance CHECK (gap_tolerance_days IS NULL OR (gap_tolerance_days >= 1 AND gap_tolerance_days <= 365));

-- Phase 3: Create CandidateInvitation table (created now for efficiency)
-- This table will store invitation data when customers invite candidates to complete applications
CREATE TABLE candidate_invitations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_country_code VARCHAR(10),
  phone_number VARCHAR(50),
  password_hash VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_invitation_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_invitation_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_invitation_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT check_invitation_status CHECK (status IN ('draft', 'sent', 'accessed', 'completed', 'expired'))
);

-- Create indexes for CandidateInvitation table for future query performance
CREATE INDEX idx_candidate_invitations_token ON candidate_invitations(token);
CREATE INDEX idx_candidate_invitations_order_id ON candidate_invitations(order_id);
CREATE INDEX idx_candidate_invitations_customer_id ON candidate_invitations(customer_id);
CREATE INDEX idx_candidate_invitations_email ON candidate_invitations(email);
CREATE INDEX idx_candidate_invitations_status ON candidate_invitations(status);
CREATE INDEX idx_candidate_invitations_expires_at ON candidate_invitations(expires_at);