import type { Viewport } from 'next';
import { Shell } from '@site/components/Shell';

export const viewport: Viewport = { themeColor: '#111613', width: 'device-width', initialScale: 1 };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Shell lang="es">{children}</Shell>;
}
