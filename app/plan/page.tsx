import { PlanView } from '@/components/PlanView';

// Rendered in the browser once the session loads (see components/Salon.tsx).
export const instant = false;

export default function Page() {
  return <PlanView />;
}
