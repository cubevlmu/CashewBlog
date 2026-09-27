import type {
	ProtectedContentType,
	ProtectedPayload,
} from "@/types/protectedContent";

export const PROTECTED_CONTENT_VERSION = 1 as const;
export const PROTECTED_ITERATIONS = 310_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class ProtectedContentError extends Error {
	constructor(message = "Protected content could not be unlocked") {
		super(message);
		this.name = "ProtectedContentError";
	}
}

function cryptoApi(): Crypto {
	if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
		throw new ProtectedContentError("Web Crypto is unavailable");
	}
	return globalThis.crypto;
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
	const binary = atob(padded);
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function aadFor(scope: string, version: number): Uint8Array {
	return encoder.encode(`shirone-protected-content:${version}:${scope}`);
}

function bufferSource(bytes: Uint8Array): BufferSource {
	return bytes as unknown as BufferSource;
}

function validatePayload(payload: ProtectedPayload): void {
	if (
		payload.v !== PROTECTED_CONTENT_VERSION ||
		payload.alg !== "AES-GCM" ||
		payload.kdf !== "PBKDF2" ||
		payload.hash !== "SHA-256" ||
		payload.iterations !== PROTECTED_ITERATIONS ||
		!payload.scope ||
		!payload.salt ||
		!payload.iv ||
		!payload.ciphertext ||
		!payload.contentType
	) {
		throw new ProtectedContentError("Unsupported protected content payload");
	}

	try {
		if (
			base64UrlToBytes(payload.salt).byteLength !== 16 ||
			base64UrlToBytes(payload.iv).byteLength !== 12 ||
			base64UrlToBytes(payload.ciphertext).byteLength < 16
		) {
			throw new ProtectedContentError("Invalid protected content payload");
		}
	} catch {
		throw new ProtectedContentError("Invalid protected content payload");
	}
}

async function deriveKey(
	password: string,
	salt: Uint8Array,
	iterations: number,
) {
	const crypto = cryptoApi();
	const material = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: bufferSource(salt),
			iterations,
			hash: "SHA-256",
		},
		material,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

export async function encryptProtectedContent(
	content: string,
	password: string,
	scope: string,
	contentType: ProtectedContentType = "application/json",
): Promise<ProtectedPayload> {
	if (!password || !scope) {
		throw new ProtectedContentError("Password and scope are required");
	}
	const crypto = cryptoApi();
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const key = await deriveKey(password, salt, PROTECTED_ITERATIONS);
	const ciphertext = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv: bufferSource(iv),
			additionalData: bufferSource(aadFor(scope, PROTECTED_CONTENT_VERSION)),
		},
		key,
		encoder.encode(content),
	);
	return {
		v: PROTECTED_CONTENT_VERSION,
		alg: "AES-GCM",
		kdf: "PBKDF2",
		hash: "SHA-256",
		iterations: PROTECTED_ITERATIONS,
		salt: bytesToBase64Url(salt),
		iv: bytesToBase64Url(iv),
		ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
		contentType,
		scope,
	};
}

export async function decryptProtectedContent(
	payload: ProtectedPayload,
	password: string,
	expectedScope: string = payload.scope,
): Promise<string> {
	validatePayload(payload);
	if (!password || payload.scope !== expectedScope) {
		throw new ProtectedContentError();
	}
	try {
		const crypto = cryptoApi();
		const key = await deriveKey(
			password,
			base64UrlToBytes(payload.salt),
			payload.iterations,
		);
		const plaintext = await crypto.subtle.decrypt(
			{
				name: "AES-GCM",
				iv: bufferSource(base64UrlToBytes(payload.iv)),
				additionalData: bufferSource(aadFor(payload.scope, payload.v)),
			},
			key,
			bufferSource(base64UrlToBytes(payload.ciphertext)),
		);
		return decoder.decode(plaintext);
	} catch {
		throw new ProtectedContentError();
	}
}

export function parseProtectedPayload(value: unknown): ProtectedPayload {
	if (!value || typeof value !== "object") throw new ProtectedContentError();
	const payload = value as Partial<ProtectedPayload>;
	validatePayload(payload as ProtectedPayload);
	return payload as ProtectedPayload;
}
