-- Add packageId to CandidateInvitation table
-- First, add the column as nullable to handle existing rows
ALTER TABLE "candidate_invitations" ADD COLUMN "package_id" TEXT;

-- Add foreign key constraint
ALTER TABLE "candidate_invitations"
ADD CONSTRAINT "candidate_invitations_package_id_fkey"
FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add index for better query performance
CREATE INDEX "candidate_invitations_package_id_idx" ON "candidate_invitations"("package_id");