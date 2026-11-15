import { Signing } from '@site/components/Signing';
import { copy } from '@site/lib/copy';
import { signingMetadataFor } from '@site/lib/meta';

export const metadata = signingMetadataFor('en');

export default function Page() {
  return <Signing c={copy.en} />;
}
