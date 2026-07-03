import { NextResponse } from 'next/server';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';
import { generatePromotionCodeForPhone } from '@/lib/services/promotionCode';


// POST /api/admin/promo-codes/generate
export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const body = await req.json();
    const rawPhone = typeof body?.phone === 'string' ? body.phone : '';
    if (!rawPhone.trim()) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
    }

    const result = await generatePromotionCodeForPhone(rawPhone);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Failed to generate promotion code';
    console.error('promo-codes generate error:', err);
    return NextResponse.json({ message }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
