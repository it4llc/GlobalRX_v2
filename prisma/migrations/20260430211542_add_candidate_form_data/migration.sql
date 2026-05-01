-- Add formData column to store candidate's in-progress form data
ALTER TABLE "candidate_invitations"
ADD COLUMN "form_data" JSONB DEFAULT '{}';

-- Add index for efficient querying
CREATE INDEX "candidate_invitations_form_data_idx" ON "candidate_invitations" USING GIN ("form_data");