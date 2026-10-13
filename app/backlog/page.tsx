import { BacklogView } from '@/components/BacklogView';
import { Salon } from '@/components/Salon';

export default function Page() {
  return (
    <Salon view="backlog">
      <BacklogView />
    </Salon>
  );
}
