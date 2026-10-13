import type { Metadata, Viewport } from 'next';
import { Geist, Instrument_Serif } from 'next/font/google';
import './globals.css';

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] });
const serif = Instrument_Serif({ variable: '--font-instrument', subsets: ['latin'], weight: '400', style: ['normal', 'italic'] });

export const metadata: Metadata = {
  title: 'Daybook',
  description: 'A simple daily planner with a painting of the day. Agent-friendly over MCP, with Linear and Frame Dashboard.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#111613', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geist.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
