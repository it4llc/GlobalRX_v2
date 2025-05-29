// src/app/config/global/page.tsx
import { redirect } from 'next/navigation';

export default function ConfigGlobalPage() {
  // Redirect from the old route to the new standardized route
  redirect('/global-configurations/locations');
}