import { ShutdownView } from '@/components/ShutdownView';
import { Salon } from '@/components/Salon';

export default function Page() {
  return (
    <Salon view="shutdown">
      <ShutdownView />
    </Salon>
  );
}
