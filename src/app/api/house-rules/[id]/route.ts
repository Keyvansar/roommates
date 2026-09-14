import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { z } from 'zod';

const updateRuleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  type: z.enum(['normal', 'reminder', 'nudge']).optional(),
  status: z.enum(['pending', 'active', 'archived']).optional(),
});

export async function PATCH(
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
    const validation = updateRuleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Get the rule
    const rule = await db.houseRule.findUnique({
      where: { id: ruleId },
      include: { household: true },
    });

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Verify ownership or admin role
    const membership = await db.membership.findFirst({
      where: { userId: session.userId, householdId: rule.householdId },
    });

    if (!membership || membership.role === 'MEMBER') {
      // Only owner or admin can update rules
      if (membership?.role !== 'ADMIN' && rule.household.ownerId !== session.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const updatedRule = await db.houseRule.update({
      where: { id: ruleId },
      data: updates,
      include: {
        proposedBy: true,
        votes: {
          include: { profile: true },
        },
      },
    });

    return NextResponse.json(updatedRule);
  } catch (error) {
    console.error('Error updating house rule:', error);
    return NextResponse.json(
      { error: 'Failed to update house rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: ruleId } = await params;

    // Get the rule
    const rule = await db.houseRule.findUnique({
      where: { id: ruleId },
      include: { household: true },
    });

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Verify ownership or admin role
    if (rule.household.ownerId !== session.userId) {
      const membership = await db.membership.findFirst({
        where: { userId: session.userId, householdId: rule.householdId },
      });

      if (membership?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    await db.houseRule.delete({
      where: { id: ruleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting house rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete house rule' },
      { status: 500 }
    );
  }
}
