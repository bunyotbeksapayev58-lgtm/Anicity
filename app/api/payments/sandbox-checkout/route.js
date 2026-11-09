import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Sandbox payments are disabled in production' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const returnUrl = searchParams.get('return_url') || '/profile';

  return NextResponse.redirect(new URL(returnUrl, request.url));
}

export async function POST(request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Sandbox payments are disabled in production' },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true, message: 'Sandbox payment processed in non-production mode' });
}
