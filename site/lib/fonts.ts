import { Archivo, Geist_Mono, Instrument_Serif, Schibsted_Grotesk } from 'next/font/google';

// The app's faces: Instrument Serif for the wordmark and titles, Schibsted
// Grotesk for wall labels, Archivo (wide) for numerals, Geist Mono for code.
const serif = Instrument_Serif({ variable: '--font-serif', subsets: ['latin'], weight: '400', style: ['normal', 'italic'] });
const sans = Schibsted_Grotesk({ variable: '--font-sans', subsets: ['latin'], style: ['normal', 'italic'] });
const wide = Archivo({ variable: '--font-wide', subsets: ['latin'], axes: ['wdth'] });
const mono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });

export const fontVars = [serif.variable, sans.variable, wide.variable, mono.variable].join(' ');
