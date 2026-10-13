import { TodayView } from '@/components/TodayView';
import { Salon } from '@/components/Salon';

export default function Page() {
  return (
    <Salon view="today">
      <TodayView />
    </Salon>
  );
}
