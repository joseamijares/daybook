import { Landing } from '@site/components/Landing';
import { copy } from '@site/lib/copy';
import { builtOn, metadataFor } from '@site/lib/meta';

export const metadata = metadataFor('es');

export default function Page() {
  return <Landing c={copy.es} built={builtOn()} />;
}
