import { Signing } from '@site/components/Signing';
import { copy } from '@site/lib/copy';
import { signingMetadataFor } from '@site/lib/meta';

export const metadata = signingMetadataFor('es');

export default function Page() {
  return <Signing c={copy.es} />;
}
