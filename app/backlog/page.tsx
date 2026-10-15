import { Suspense } from 'react';
import { BacklogView } from '@/components/BacklogView';

// Rendered in the browser once the session loads (see components/Salon.tsx).
export const instant = false;

export default function Page() {
  // The view reads ?plan with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <BacklogView />
    </Suspense>
  );
}
