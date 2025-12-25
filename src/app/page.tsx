import { validateRequest } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';
import { LandingPageClient } from '@/components/landing-page-client';
import type { Metadata } from 'next';

// ... (rest of the file)

export default async function HomePage() {
  const session = await validateRequest();

  // If user is authenticated, redirect to dashboard
  if (session) {
    redirect('/dashboard');
  }

  return <LandingPageClient />;
}