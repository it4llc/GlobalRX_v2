// /GlobalRX_v2/src/app/api/candidate/application/[token]/save/recordSearchSave.ts
//
// Task 8.4 — Record Search Requirements helper module.
//
// Encapsulates the Zod schema and persistence path for the `record_search`
// section so the main save/route.ts (already over the 600-LOC hard stop) does
// not have to grow further. The main route imports `handleRecordSearchSave`
// and dispatches to it when `body.sectionType === 'record_search'`.
//
// This module never reads from or writes to
// `formData.sections.address_history.aggregatedFields`. Per plan §11.1, the
// new section has zero backward-compatibility coupling to the legacy
// aggregated-fields bucket.

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

import type { CandidateFormData } from '@/types/candidate-portal';

/**
 * Zod schema for record_search save bodies. See technical plan §6.1.
 *
 * Value union widens to match the address-history aggregatedFields shape so
 * that document upload metadata (objects keyed by document id) can flow
 * through the same save path that handles primitive answers.
 */
export const recordSearchSaveRequestSchema = z.object({
  sectionType: z.literal('record_search'),
  sectionId: z.literal('record_search'),
  fieldValues: z.record(
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.string()),
      z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
    ]),
  ),
});

export type RecordSearchSaveRequest = z.infer<typeof recordSearchSaveRequestSchema>;

/**
 * Handle a POST body with sectionType === 'record_search'.
 *
 * Mirrors the validation order used by the address_history branch in the
 * main save route: Zod validation → invitation lookup → expiry / completed
 * guards → whole-object replacement of the record_search bucket → status
 * promotion if the invitation was still in `sent` state.
 *
 * The caller (save/route.ts) is responsible for the session check and the
 * token-match check before invoking this helper; the helper only owns the
 * body-validation + persistence path.
 */
export async function handleRecordSearchSave(
  body: unknown,
  token: string,
): Promise<NextResponse> {
  try {
    const validation = recordSearchSaveRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.errors },
        { status: 400 },
      );
    }

    const invitation = await prisma.candidateInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
    }
    if (invitation.status === INVITATION_STATUSES.COMPLETED) {
      return NextResponse.json({ error: 'Invitation already completed' }, { status: 410 });
    }

    const currentFormData: CandidateFormData =
      (invitation.formData as unknown as CandidateFormData) || { sections: {} };
    if (!currentFormData.sections) {
      currentFormData.sections = {};
    }

    // Whole-object replacement, matching the address_history aggregatedFields
    // convention. The schema pins `sectionId` to the literal 'record_search',
    // so this index is effectively a fixed bucket key.
    currentFormData.sections[validation.data.sectionId] = {
      type: 'record_search',
      fieldValues: validation.data.fieldValues,
    };

    await prisma.candidateInvitation.update({
      where: { id: invitation.id },
      data: {
        formData: currentFormData as unknown as Prisma.InputJsonValue,
        lastAccessedAt: new Date(),
      },
    });

    if (invitation.status === INVITATION_STATUSES.SENT) {
      await prisma.candidateInvitation.update({
        where: { id: invitation.id },
        data: { status: INVITATION_STATUSES.ACCESSED },
      });
    }

    const savedAt = new Date().toISOString();
    logger.info('Candidate form data saved', {
      event: 'candidate_form_save',
      invitationId: invitation.id,
      sectionType: 'record_search',
      sectionId: validation.data.sectionId,
      fieldValuesCount: Object.keys(validation.data.fieldValues).length,
    });

    return NextResponse.json({ success: true, savedAt });
  } catch (error) {
    logger.error('Failed to save record_search form data', {
      event: 'candidate_form_save_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
