'use client';

// The Mac app's window (mac/, DaybookWindow.swift) tells the page it's there:
// it sets window.daybookMac on your Daybook's pages, replaces it and fires a
// "daybookmac" event when something changes (an update was found), and takes
// "check", "install", "ready", "connect" and "haptic" back through a WebKit message
// handler. In a browser there's no window.daybookMac and nothing here shows.

import { useSyncExternalStore } from 'react';

export interface DaybookMac {
  /** The version that's running, e.g. "0.1.2". */
  version: string;
  /** A newer version a check found, or null. */
  available: string | null;
  /** False while Sparkle is already checking or installing. */
  canCheck: boolean;
}

type Handler = { postMessage(message: unknown): void };

declare global {
  interface Window {
    daybookMac?: unknown;
    webkit?: { messageHandlers?: Record<string, Handler | undefined> };
  }
}

/** What the Mac app set, if it looks right; anything else counts as no Mac app. */
export function parseMac(value: unknown): DaybookMac | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.version !== 'string' || !v.version) return null;
  const available = typeof v.available === 'string' && v.available ? v.available : null;
  return { version: v.version, available, canCheck: v.canCheck !== false };
}

// useSyncExternalStore wants the same object back until something changes.
let lastRaw: unknown;
let lastParsed: DaybookMac | null = null;
function snapshot() {
  const raw = window.daybookMac;
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastParsed = parseMac(raw);
  }
  return lastParsed;
}

function subscribe(changed: () => void) {
  window.addEventListener('daybookmac', changed);
  return () => window.removeEventListener('daybookmac', changed);
}

/** The Mac app this page is running in, or null (a browser, or the server render). */
export function useDaybookMac() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/**
 * Asks the Mac app to check for updates, or to show the one it found (Sparkle's
 * window installs it), or to connect a cloud Daybook (its own form), or tells it
 * the page is ready: signed in and painted, so its launch scene can give way to the app.
 */
export function askMac(action: 'check' | 'install' | 'ready' | 'connect') {
  window.webkit?.messageHandlers?.daybookMac?.postMessage({ action });
}

/**
 * A tick on a Force Touch trackpad, through the Mac app: "generic" as a task
 * lifts, "alignment" as it finds a new place, "levelChange" as it's dropped
 * there (components/sortable.ts). Nothing in a browser.
 */
export function feel(kind: 'generic' | 'alignment' | 'levelChange') {
  window.webkit?.messageHandlers?.daybookMac?.postMessage({ action: 'haptic', kind });
}
