import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/lib/auth';

const publicRoutes = [
  '/',
  '/sign-in',
  '/sign-up',
  '/api/auth/signup',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/webhooks(.*)',
  '/api/inngest(.*)',
  '/api/metrics(.*)',
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublic = publicRoutes.some(path =>
    new RegExp(`^${path}$`.replace('(.*)', '.*')).test(pathname)
  );

  if (isPublic) {
    return NextResponse.next();
  }

  const { user } = await validateRequest();

  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};