import { NextResponse } from 'next/server';
import { parseSessionToken, updateUserOnboardingStatus, createSessionToken } from '@/lib/serverStore';
import { OnboardingStatus } from '@/types/auth';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const currentUser = parseSessionToken(token);

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const status = body.status as OnboardingStatus;

    if (
      !status ||
      (status !== 'COMPLETED_WITHOUT_VEHICLE' &&
        status !== 'COMPLETED_WITH_VEHICLE' &&
        status !== 'NOT_STARTED')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid onboarding status. Allowed: COMPLETED_WITHOUT_VEHICLE, COMPLETED_WITH_VEHICLE, NOT_STARTED',
        },
        { status: 400 }
      );
    }

    const updatedUser = updateUserOnboardingStatus(currentUser.id, status);
    if (!updatedUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const updatedToken = createSessionToken(updatedUser);

    return NextResponse.json({
      success: true,
      message: 'Onboarding status updated successfully',
      data: {
        user: updatedUser,
        token: updatedToken,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
