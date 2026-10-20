import { Suspense } from 'react';
import { PlanView } from '@/components/PlanView';

// Rendered in the browser once the session loads (see components/Salon.tsx).
export default function Page() {
  // The view reads ?date with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <PlanView />
    </Suspense>
  );
}
