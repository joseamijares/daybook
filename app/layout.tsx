import type { Metadata, Viewport } from 'next';
import { Instrument_Sans, Instrument_Serif } from 'next/font/google';
import { Salon } from '@/components/Salon';
import './globals.css';

const sans = Instrument_Sans({ variable: '--font-ui', subsets: ['latin'] });
const serif = Instrument_Serif({ variable: '--font-instrument', subsets: ['latin'], weight: '400', style: ['normal', 'italic'] });

export const metadata: Metadata = {
  title: 'Daybook',
  description: 'A simple daily planner with a painting of the day. Agent-friendly over MCP, with Linear and Frame Dashboard.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#111613', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <Salon>{children}</Salon>
      </body>
    </html>
  );
}
