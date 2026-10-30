import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const data = {
      overallQualityScore: 98.6,
      auditedRecordsCount: 66,
      passedRecordsCount: 66,
      flaggedRecordsCount: 0,
      categories: [
        { category: 'VIN_STRUCTURE', score: 100 },
        { category: 'ODOMETER_MONOTONICITY', score: 98 },
        { category: 'SERVICE_COMPLIANCE', score: 97 },
        { category: 'CHAIN_OF_CUSTODY', score: 100 },
      ],
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

