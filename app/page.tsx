import { TodayView } from '@/components/TodayView';

// Rendered in the browser once the session loads (see components/Salon.tsx).
export const instant = false;

export default function Page() {
  return <TodayView />;
}
