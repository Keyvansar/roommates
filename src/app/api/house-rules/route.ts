import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { z } from 'zod';

const createRuleSchema = z.object({
  householdId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(['normal', 'reminder', 'nudge']).default('normal'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = createRuleSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { householdId, title, description, type } = validation.data;

    // Verify membership
    const membership = await db.membership.findFirst({
      where: { userId: session.userId, householdId },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this household' }, { status: 403 });
    }

    // Get profile for this household
    const profile = await db.profile.findFirst({
      where: { userId: session.userId, householdId },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const rule = await db.houseRule.create({
      data: {
        householdId,
        title,
        description: description || null,
        type,
        proposedById: profile.id,
        status: 'pending',
        approvedBy: '[]',
      },
      include: {
        proposedBy: true,
        votes: {
          include: { profile: true },
        },
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error creating house rule:', error);
    return NextResponse.json(
      { error: 'Failed to create house rule' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const householdId = searchParams.get('householdId');

    if (!householdId) {
      return NextResponse.json({ error: 'householdId required' }, { status: 400 });
    }

    // Verify membership
    const membership = await db.membership.findFirst({
      where: { userId: session.userId, householdId },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this household' }, { status: 403 });
    }

    const rules = await db.houseRule.findMany({
      where: { householdId },
      include: {
        proposedBy: true,
        votes: {
          include: { profile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate approval status for each rule
    const rulesWithStatus = await Promise.all(
      rules.map(async (rule) => {
        const membersCount = await db.membership.count({
          where: { householdId },
        });

        const approveVotes = rule.votes.filter((v) => v.vote === 'approve').length;
        const threshold = Math.ceil(membersCount * (2 / 3));
        const isApproved = approveVotes >= threshold;

        // Auto-approve if threshold met
        if (isApproved && rule.status === 'pending') {
          await db.houseRule.update({
            where: { id: rule.id },
            data: { status: 'active' },
          });
          rule.status = 'active';
        }

        return {
          ...rule,
          approveVotes,
          rejectVotes: rule.votes.filter((v) => v.vote === 'reject').length,
          threshold,
          isApproved,
        };
      })
    );

    return NextResponse.json(rulesWithStatus);
  } catch (error) {
    console.error('Error fetching house rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch house rules' },
      { status: 500 }
    );
  }
}
