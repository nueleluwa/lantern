"use client";

import { getOrCreateDeviceId } from "./device-id";

// DESIGN_SYSTEM.md "Feedback states": "A tag submitted with no connection
// should queue locally and show 'Saved — will submit when you're back
// online,' not fail silently or block the user." ARCHITECTURE.md §3:
// "write to local storage first, show 'saved,' attempt submission, retry
// with backoff on failure, only surface an error ... if retries are
// exhausted after a reasonable window (e.g. 24h)."
const STORAGE_KEY = "lantern_tag_queue";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type QueuedTag = {
  localId: string;
  segmentId: string;
  body: {
    timeOfDay: "day" | "evening" | "night";
    lighting: "lit" | "dim" | "dark";
    safetyFeeling: "safe" | "caution" | "avoid";
    category?: string | null;
    note?: string | null;
    kind?: "standard" | "infrastructure" | "lit_tonight";
  };
  queuedAt: number;
  attempts: number;
};

function readQueue(): QueuedTag[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedTag[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueTag(segmentId: string, body: QueuedTag["body"]): QueuedTag {
  const entry: QueuedTag = {
    localId: crypto.randomUUID(),
    segmentId,
    body,
    queuedAt: Date.now(),
    attempts: 0,
  };
  writeQueue([...readQueue(), entry]);
  return entry;
}

async function attemptSubmit(entry: QueuedTag): Promise<boolean> {
  try {
    const res = await fetch(`/api/segments/${entry.segmentId}/tags`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": getOrCreateDeviceId(),
      },
      body: JSON.stringify(entry.body),
    });
    return res.ok;
  } catch {
    return false; // offline or network error
  }
}

/**
 * Call on app load and on `online` events. Drains the queue, dropping
 * entries older than 24h that still fail (surfaced to the caller so the
 * UI can show an error for those specifically).
 */
export async function drainTagQueue(): Promise<{ succeeded: string[]; expired: string[] }> {
  const queue = readQueue();
  const succeeded: string[] = [];
  const expired: string[] = [];
  const remaining: QueuedTag[] = [];

  for (const entry of queue) {
    const ok = await attemptSubmit(entry);
    if (ok) {
      succeeded.push(entry.localId);
      continue;
    }

    const age = Date.now() - entry.queuedAt;
    if (age >= MAX_AGE_MS) {
      expired.push(entry.localId);
    } else {
      remaining.push({ ...entry, attempts: entry.attempts + 1 });
    }
  }

  writeQueue(remaining);
  return { succeeded, expired };
}
