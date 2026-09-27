import type {
	ProtectedPayload,
	ProtectedSession,
} from "@/types/protectedContent";

const SESSION_PREFIX = "shirone:protected:v1:";
const SESSION_TTL = 30 * 60 * 1000;

const MEMORY_KEY = Symbol.for("shirone.protected.sessions.v1");
const memoryHost = globalThis as typeof globalThis & Record<symbol, unknown>;
const memory =
	(memoryHost[MEMORY_KEY] as Map<string, ProtectedSession> | undefined) ??
	new Map<string, ProtectedSession>();
memoryHost[MEMORY_KEY] = memory;

export function protectedPayloadId(payload: ProtectedPayload): string {
	// Salt, IV and ciphertext are intentionally randomized on every dev render.
	// The authenticated scope and content contract are the stable session identity.
	return [payload.v, payload.scope, payload.contentType].join(":");
}

function keyFor(scope: string): string {
	return `${SESSION_PREFIX}${encodeURIComponent(scope)}`;
}

function storage(): Storage | null {
	if (typeof window === "undefined") return null;
	try {
		return window.sessionStorage;
	} catch {
		return null;
	}
}

function validSession(
	value: unknown,
	scope: string,
	payloadId: string,
): value is ProtectedSession {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<ProtectedSession>;
	return Boolean(
		candidate.v === 1 &&
			candidate.scope === scope &&
			candidate.payloadId === payloadId &&
			typeof candidate.expiresAt === "number" &&
			candidate.expiresAt > Date.now() &&
			typeof candidate.content === "string",
	);
}

export function readProtectedSession(
	scope: string,
	payloadId: string,
): ProtectedSession | null {
	const cached = memory.get(scope);
	if (validSession(cached, scope, payloadId)) return cached;
	memory.delete(scope);

	const store = storage();
	if (!store) return null;
	try {
		const raw = store.getItem(keyFor(scope));
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (!validSession(parsed, scope, payloadId)) {
			store.removeItem(keyFor(scope));
			return null;
		}
		const session: ProtectedSession = parsed;
		memory.set(scope, session);
		return session;
	} catch {
		store.removeItem(keyFor(scope));
		return null;
	}
}

export function writeProtectedSession(
	scope: string,
	payloadId: string,
	content: string,
): ProtectedSession {
	const session: ProtectedSession = {
		v: 1,
		scope,
		payloadId,
		content,
		expiresAt: Date.now() + SESSION_TTL,
	};
	memory.set(scope, session);

	const store = storage();
	try {
		store?.setItem(keyFor(scope), JSON.stringify(session));
	} catch {
		// Session storage can be unavailable or quota-limited; memory remains usable.
	}
	return session;
}

export function clearProtectedSession(scope: string): void {
	memory.delete(scope);
	try {
		storage()?.removeItem(keyFor(scope));
	} catch {
		// Ignore storage failures during cleanup.
	}
}

export function clearAllProtectedSessions(): void {
	memory.clear();
	const store = storage();
	if (!store) return;
	try {
		for (let index = store.length - 1; index >= 0; index -= 1) {
			const key = store.key(index);
			if (key?.startsWith(SESSION_PREFIX)) store.removeItem(key);
		}
	} catch {
		// Ignore storage failures during cleanup.
	}
}
