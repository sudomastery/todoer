import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const path = request.nextUrl.pathname;
  const isAuthPage = path === '/login' || path === '/signup';

  // Client-side navigations inside the app fetch route payloads with an RSC
  // header. Verifying the session with Supabase costs a round trip to the auth
  // server, which is what made switching views feel slow, so those requests are
  // gated on the session cookie instead. Full page loads still verify properly,
  // and the database enforces access on every query regardless.
  const isRscRequest = request.headers.get('RSC') === '1';
  if (isRscRequest) {
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
    if (!hasSession && path.startsWith('/app')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && path.startsWith('/app')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (isAuthPage || path === '/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/app/today';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
