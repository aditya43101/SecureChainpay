import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const user = await prisma.user.findFirst();
    const userId = user ? user.id : 'default-user-id';

    const settings = await prisma.autoTradingSettings.update({
      where: { userId },
      data: {
        enabled: false,
        allTimeMode: false,
        status: 'DISABLED',
        pausedReason: 'Disabled by user action'
      }
    });

    await prisma.safetyEvent.create({
      data: {
        userId,
        eventType: 'USER_DISABLED_AUTO_TRADING',
        severity: 'INFO',
        details: 'Auto-trading disabled by user'
      }
    });

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
