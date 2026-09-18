import { NextResponse } from 'next/server';
import { ReservationService } from '@/lib/payments/reservation-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Wallet address query parameter is required' },
        { status: 400 }
      );
    }

    const breakdown = await ReservationService.getBalanceBreakdown(address);

    return NextResponse.json({
      success: true,
      data: breakdown,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch balance breakdown' },
      { status: 500 }
    );
  }
}
