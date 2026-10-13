import { WeekView } from '@/components/WeekView';
import { Salon } from '@/components/Salon';

export default function Page() {
  return (
    <Salon view="week">
      <WeekView />
    </Salon>
  );
}
