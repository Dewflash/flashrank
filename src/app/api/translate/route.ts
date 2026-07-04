import { NextRequest, NextResponse } from 'next/server';
import { getDeepLEnv } from '@/lib/serverCredentials';

export async function POST(request: NextRequest) {
  const { authKey } = getDeepLEnv();
  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (!text) {
    return NextResponse.json({ error: 'Missing text.' }, { status: 400 });
  }

  if (!authKey) {
    return NextResponse.json(
      {
        error: 'DeepL API key is not configured.',
        requiresKey: true,
      },
      { status: 401 }
    );
  }

  const baseUrl = authKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${authKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: 'EN',
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `DeepL responded with ${response.status}.` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const translation = data.translations?.[0]?.text ?? '';

    return NextResponse.json({
      translation,
      sourceLang: data.translations?.[0]?.detected_source_language ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to translate keyword.' },
      { status: 502 }
    );
  }
}
