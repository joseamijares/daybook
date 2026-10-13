import { Suspense } from 'react';
import { TodayView } from '@/components/TodayView';

// Rendered in the browser once the session loads (see components/Salon.tsx).
export const instant = false;

export default function Page() {
  // The view reads ?date with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <TodayView />
    </Suspense>
  );
}
