/**
 * expo-sms-inbox — JS interface
 *
 * Production-quality: ZERO mock data.
 * If the native module is not linked properly, it returns a hard error
 * so the UI can notify the user immediately, preventing silent failures.
 */

import { requireNativeModule, EventEmitter, Subscription } from 'expo-modules-core';
import Constants from 'expo-constants';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SmsMessage {
  id: string;
  threadId: string;
  address: string;
  contactName: string;
  body: string;
  date: number;
  type: number;   // 1 = received, 2 = sent
  read: number;   // 0 = unread, 1 = read
}

export interface SmsThread {
  threadId: string;
  address: string;
  contactName: string;
  displayName: string;
  latestBody: string;
  latestDate: number;
  latestType: number;
  unreadCount: number;
  messages: SmsMessage[];
  isSpam?: boolean;
  spamCategory?: string;
  spamReason?: string;
}

export interface SmsThreadsResult {
  threads: SmsThread[];
  error: string | null;
}

// ─── Native module bootstrap ───────────────────────────────────────────────

let NativeModule: any = null;
let emitter: EventEmitter | null = null;

const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  try {
    NativeModule = requireNativeModule('ExpoSmsInbox');
    emitter = new EventEmitter(NativeModule);
  } catch (e) {
    console.error('[ExpoSmsInbox] Failed to load native module:', e);
  }
}

// ─── API ───────────────────────────────────────────────────────────────────

export async function getSmsThreads(): Promise<SmsThreadsResult> {
  // Hard error if module is missing or running in Expo Go
  if (!NativeModule) {
    console.error('[ExpoSmsInbox] NATIVE_MODULE_NOT_FOUND - Ensure the module is linked in package.json and built into the APK.');
    return { threads: [], error: 'NATIVE_MODULE_NOT_FOUND' };
  }

  try {
    const result = await NativeModule.getSmsThreads();
    const rawThreads: any[] = result?.threads ?? [];
    const error: string | null = result?.error ?? null;

    if (error === 'PERMISSION_DENIED') {
      return { threads: [], error: 'PERMISSION_DENIED' };
    }

    const threads: SmsThread[] = rawThreads.map((t: any) => ({
      threadId:    t.threadId ?? '',
      address:     t.address ?? '',
      contactName: t.contactName ?? '',
      displayName: t.contactName?.trim() ? t.contactName.trim() : (t.address ?? 'Unknown'),
      latestBody:  t.latestBody ?? '',
      latestDate:  t.latestDate ?? 0,
      latestType:  t.latestType ?? 1,
      unreadCount: t.unreadCount ?? 0,
      messages:    (t.messages ?? []).map((m: any): SmsMessage => ({
        id:          m.id ?? '',
        threadId:    m.threadId ?? t.threadId ?? '',
        address:     m.address ?? '',
        contactName: m.contactName ?? '',
        body:        m.body ?? '',
        date:        m.date ?? 0,
        type:        m.type ?? 1,
        read:        m.read ?? 1,
      })),
    }));

    return { threads, error: null };
  } catch (e: any) {
    console.error('[ExpoSmsInbox] getSmsThreads error:', e);
    return { threads: [], error: e?.message ?? 'Unknown error' };
  }
}

export async function sendSmsDirect(address: string, body: string): Promise<boolean> {
  if (!NativeModule) {
    throw new Error('NATIVE_MODULE_NOT_FOUND: Cannot send SMS');
  }
  try {
    return await NativeModule.sendSmsDirect(address, body);
  } catch (e: any) {
    console.error('[ExpoSmsInbox] sendSmsDirect error:', e);
    throw e;
  }
}

export function startSmsListener(): void {
  if (!NativeModule) return;
  try { NativeModule.startSmsListener(); } catch (e) {
    console.warn('[ExpoSmsInbox] startSmsListener error:', e);
  }
}

export function stopSmsListener(): void {
  if (!NativeModule) return;
  try { NativeModule.stopSmsListener(); } catch (e) {
    console.warn('[ExpoSmsInbox] stopSmsListener error:', e);
  }
}

export function addSmsListener(
  handler: (msg: SmsMessage) => void
): Subscription | null {
  if (!emitter) return null;
  return emitter.addListener('onNewSmsReceived', handler);
}

export { isExpoGo };
