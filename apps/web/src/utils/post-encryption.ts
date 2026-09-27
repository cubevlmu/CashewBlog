export type PostEncryptionData = {
	encrypted?: boolean;
	password?: string | number;
};

/**
 * Resolves the fail-closed encryption contract shared by every post surface.
 * An explicit encrypted flag without a usable password is a configuration error,
 * not permission to publish the post as plaintext.
 */
export function isEncryptedPost(data: PostEncryptionData): boolean {
	const hasPassword =
		data.password !== undefined && String(data.password).trim().length > 0;
	if (data.encrypted && !hasPassword) {
		throw new Error("Encrypted posts require a non-empty password");
	}
	return hasPassword;
}
