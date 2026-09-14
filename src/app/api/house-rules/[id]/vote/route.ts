import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';
import { z } from 'zod';

const voteSchema = z.object({
  vote: z.enum(['approve', 'reject']),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: ruleId } = await params;
    const body = await req.json();
    const validation = voteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { vote } = validation.data;

    // Get the rule
    const rule = await db.houseRule.findUnique({
      where: { id: ruleId },
      include: { household: true },
    });

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Verify membership in the household
    const membership = await db.membership.findFirst({
      where: { userId: session.userId, householdId: rule.householdId },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this household' }, { status: 403 });
    }

    // Get voter's profile
    const profile = await db.profile.findFirst({
      where: { userId: session.userId, householdId: rule.householdId },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if already voted
    const existingVote = await db.ruleVote.findUnique({
      where: { ruleId_profileId: { ruleId, profileId: profile.id } },
    });

    if (existingVote) {
      // Update existing vote
      await db.ruleVote.update({
        where: { id: existingVote.id },
        data: { vote },
      });
    } else {
      // Create new vote
      await db.ruleVote.create({
        data: { ruleId, profileId: profile.id, vote },
      });
    }

    // Recalculate approval status
    const allVotes = await db.ruleVote.findMany({
      where: { ruleId },
    });

    const membersCount = await db.membership.count({
      where: { householdId: rule.householdId },
    });

    const approveVotes = allVotes.filter((v) => v.vote === 'approve').length;
    const threshold = Math.ceil(membersCount * (2 / 3));
    const isApproved = approveVotes >= threshold;

    if (isApproved && rule.status === 'pending') {
      await db.houseRule.update({
        where: { id: ruleId },
        data: { status: 'active' },
      });
    }

    return NextResponse.json({ success: true, isApproved, threshold, approveVotes });
  } catch (error) {
    console.error('Error voting on house rule:', error);
    return NextResponse.json(
      { error: 'Failed to submit vote' },
      { status: 500 }
    );
  }
}
