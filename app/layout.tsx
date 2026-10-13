import type { Metadata, Viewport } from 'next';
import { Archivo, Brygada_1918, Schibsted_Grotesk } from 'next/font/google';
import { Salon } from '@/components/Salon';
import './globals.css';

// One face per design (see data-style in globals.css).
const schibsted = Schibsted_Grotesk({ variable: '--font-schibsted', subsets: ['latin'], style: ['normal', 'italic'] });
const archivo = Archivo({ variable: '--font-archivo', subsets: ['latin'], axes: ['wdth'] });
const brygada = Brygada_1918({ variable: '--font-brygada', subsets: ['latin'], style: ['normal', 'italic'] });

export const metadata: Metadata = {
  title: 'Daybook',
  description: 'A simple daily planner with a painting of the day. Agent-friendly over MCP, with Linear and Frame Dashboard.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#111613', width: 'device-width', initialScale: 1 };

// Wear the last design and palette before the first paint, so the room does
// not flash Salon on the way to Nocturne. The session corrects it if it changed.
const remembered = `try{var a=JSON.parse(localStorage.getItem('daybook.look')||'null');if(a&&a.style&&a.palette){var h=document.documentElement;h.dataset.style=a.style;h.dataset.palette=a.palette}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      data-style="wall"
      data-palette="salon"
      className={`${schibsted.variable} ${archivo.variable} ${brygada.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: remembered }} />
      </head>
      <body>
        <Salon>{children}</Salon>
      </body>
    </html>
  );
}
