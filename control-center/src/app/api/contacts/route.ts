import { NextRequest, NextResponse } from 'next/server';
import { getContacts } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageParam = parseInt(searchParams.get('page') || '1', 10);
    const pageSizeParam = parseInt(searchParams.get('pageSize') || '50', 10);
    const searchParam = searchParams.get('search') || undefined;
    const statusParam = searchParams.get('status') || undefined;

    if (isNaN(pageParam) || pageParam < 1) {
      return NextResponse.json(
        { error: 'Invalid page parameter: must be a positive integer' },
        { status: 400 }
      );
    }

    if (isNaN(pageSizeParam) || pageSizeParam < 1 || pageSizeParam > 100) {
      return NextResponse.json(
        { error: 'Invalid pageSize parameter: must be between 1 and 100' },
        { status: 400 }
      );
    }

    const result = await getContacts({
      page: pageParam,
      pageSize: pageSizeParam,
      search: searchParam,
      status: statusParam,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/contacts:error]', error);
    return NextResponse.json(
      { error: 'Unable to load contacts from database' },
      { status: 500 }
    );
  }
}
