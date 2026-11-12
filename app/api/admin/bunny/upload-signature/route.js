import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { authorizeAdminOperation } from '@/lib/admin-access';
import { logger } from '@/lib/logger';

export async function POST(request) {
  try {
    // 1. Authorize Admin or Assistant with video_upload permission
    const supabase = await createClient();
    const access = await authorizeAdminOperation(supabase, 'video_upload');

    if (access.error || !access.user) {
      return NextResponse.json(
        { error: access.error || 'Ruxsat berilmagan' },
        { status: 403 }
      );
    }

    // 2. Validate Bunny Stream environment variables
    const sanitize = (val) => {
      if (!val) return '';
      return String(val)
        .replace(/^\uFEFF+/, '')
        .replace(/[^\x20-\x7E]/g, '')
        .trim();
    };

    const libraryId = sanitize(process.env.BUNNY_STREAM_LIBRARY_ID);
    const apiKey = sanitize(process.env.BUNNY_STREAM_API_KEY);

    if (!libraryId || !apiKey) {
      return NextResponse.json(
        {
          error: 'Bunny.net Stream kalitlari sozlanmagan. Iltimos, .env faylida BUNNY_STREAM_LIBRARY_ID va BUNNY_STREAM_API_KEY ni ko‘rsating.',
          needsConfig: true,
        },
        { status: 400 }
      );
    }

    // 3. Parse request payload
    let body = {};
    try {
      body = await request.json();
    } catch {}

    const title = (body.title || 'AniCity Episode Video').trim().slice(0, 200);

    // 4. Create Video Object on Bunny.net Stream API
    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method: 'POST',
        headers: {
          AccessKey: apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ title }),
      }
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      logger.error('Bunny create video failed', { status: createRes.status });
      return NextResponse.json(
        {
          error: `Bunny.net bilan bog‘lanishda xatolik yuz berdi (${createRes.status}). API kalit va kutubxona ID to‘g‘riligini tekshiring.`,
          details: errText,
        },
        { status: 502 }
      );
    }

    const bunnyData = await createRes.json();
    const videoId = bunnyData.guid;

    if (!videoId) {
      return NextResponse.json(
        { error: 'Bunny.net video identifikatorini (GUID) qaytarmadi.' },
        { status: 502 }
      );
    }

    // 5. Generate secure Presigned Authorization Signature for TUS Direct Upload
    // Formula: SHA256(LibraryID + ApiKey + ExpirationTime + VideoId)
    const expirationTime = Math.floor(Date.now() / 1000) + 86400; // 24 soat amal qiladi
    const stringToSign = `${libraryId}${apiKey}${expirationTime}${videoId}`;
    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    return NextResponse.json({
      success: true,
      videoId: sanitize(videoId),
      libraryId: sanitize(libraryId),
      signature: sanitize(signature),
      expirationTime: sanitize(expirationTime),
      endpoint: 'https://video.bunnycdn.com/tusupload',
      videoUrl: `bunny:${sanitize(videoId)}`,
    });
  } catch (err) {
    logger.error('Error generating Bunny upload signature', err);
    return NextResponse.json(
      { error: err.message || 'Serverda kutilmagan xatolik yuz berdi' },
      { status: 500 }
    );
  }
}
