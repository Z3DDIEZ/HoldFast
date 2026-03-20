import type { GameState } from "../engine/tick-types";

export interface SaveGameResponse {
  saveId: string;
  savedAt: string;
}

export interface SnapshotViolation {
  rule: string;
  detail: string;
}

export interface SnapshotValidationResponse {
  valid: boolean;
  violations: SnapshotViolation[];
}

export class SnapshotValidationError extends Error {
  violations: SnapshotViolation[];

  constructor(message: string, violations: SnapshotViolation[]) {
    super(message);
    this.name = "SnapshotValidationError";
    this.violations = violations;
  }
}

const rawBase = import.meta.env.VITE_API_BASE_URL;
const defaultBase = "http://localhost:5214";
const baseUrl = (rawBase === undefined ? defaultBase : rawBase).replace(/\/+$/, "");

export async function saveSnapshot(
  snapshot: GameState,
  userId: string,
): Promise<SaveGameResponse> {
  const response = await fetch(`${baseUrl}/api/saves`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId,
    },
    body: JSON.stringify(snapshot),
  });

  if (response.status === 422) {
    const body = (await response.json()) as SnapshotValidationResponse;
    throw new SnapshotValidationError("Snapshot validation failed.", body.violations || []);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Save failed (${response.status}): ${text}`);
  }

  return (await response.json()) as SaveGameResponse;
}

export async function loadLatestSnapshot(userId: string): Promise<GameState | null> {
  const response = await fetch(`${baseUrl}/api/saves/${encodeURIComponent(userId)}/latest`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Load failed (${response.status}): ${text}`);
  }

  return (await response.json()) as GameState;
}
