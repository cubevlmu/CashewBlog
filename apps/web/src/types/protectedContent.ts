export type ProtectedContentType = "application/json" | "text/html" | string;

export type ProtectedPayload = {
	v: 1;
	alg: "AES-GCM";
	kdf: "PBKDF2";
	hash: "SHA-256";
	iterations: number;
	salt: string;
	iv: string;
	ciphertext: string;
	contentType: ProtectedContentType;
	scope: string;
};

export type ProtectedSession = {
	v: 1;
	scope: string;
	payloadId: string;
	expiresAt: number;
	/** Decrypted content is kept in the page process only. */
	content: string;
};
