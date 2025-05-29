// src/app/config/translations/page.tsx
import { redirect } from 'next/navigation';

export default function ConfigTranslationsPage() {
  // Redirect from the old route to the new standardized route
  redirect('/global-configurations/translations');
}