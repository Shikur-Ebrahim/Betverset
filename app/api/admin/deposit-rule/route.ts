import { NextResponse } from 'next/server';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';
import {

  getWithdrawalMinTotalDeposit,
  setWithdrawalMinTotalDeposit,
} from '@/lib/services/depositRule';

// GET /api/admin/deposit-rule
export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const minTotalDeposit = await getWithdrawalMinTotalDeposit();
    return NextResponse.json({ minTotalDeposit });
  } catch (err: any) {
    console.error('deposit-rule get error:', err);
    return NextResponse.json({ message: 'Failed to fetch deposit rule' }, { status: 500 });
  }
}

// PUT /api/admin/deposit-rule
export async function PUT(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const body = await req.json();
    const amount = Number(body?.minTotalDeposit);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ message: 'Valid minTotalDeposit greater than 0 is required' }, { status: 400 });
    }
    const minTotalDeposit = await setWithdrawalMinTotalDeposit(amount);
    return NextResponse.json({ minTotalDeposit });
  } catch (err: any) {
    console.error('deposit-rule put error:', err);
    return NextResponse.json({ message: 'Failed to save deposit rule' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
