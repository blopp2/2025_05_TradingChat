// auth.js – Firebase ID-Token Validation for Cloudflare Worker

/**
 * Verifies a Firebase ID token.
 * @param {string} idToken - The Firebase ID token from the client.
 * @param {string} expectedAudience - Your Firebase project ID (aud claim).
 * @returns {Promise<object>} - The decoded token payload if valid.
 * @throws {Error} - If validation fails.
 */
export async function verifyFirebaseIdToken(idToken, expectedAudience) {
	// 1. Split token
	const parts = idToken.split('.');
	if (parts.length !== 3) {
		throw new Error('Invalid token format');
	}
	const [headerB64, payloadB64, signatureB64] = parts;

	// 2. Decode payload
	const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
	const payload = JSON.parse(payloadJson);

	// 3. Check expiration
	const now = Math.floor(Date.now() / 1000);
	if (typeof payload.exp !== 'number' || payload.exp < now) {
		throw new Error('Token expired');
	}

	// 4. Check audience and issuer
	if (payload.aud !== expectedAudience) {
		throw new Error('Invalid token audience');
	}
	const expectedIssuer = `https://securetoken.google.com/${expectedAudience}`;
	if (payload.iss !== expectedIssuer) {
		throw new Error('Invalid token issuer');
	}

	// 5. Fetch Firebase public keys
	const jwksUrl = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
	const jwksRes = await fetch(jwksUrl);
	const jwks = await jwksRes.json();

	// 6. Find key by kid
	const headerJson = atob(headerB64.replace(/-/g, '+').replace(/_/g, '/'));
	const header = JSON.parse(headerJson);
	const jwk = jwks.keys.find((k) => k.kid === header.kid);
	if (!jwk) {
		throw new Error('Public key not found');
	}

	// 7. Import the public key
	const cryptoKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);

	// 8. Verify signature
	const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
	const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
	const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data);
	if (!valid) {
		throw new Error('Invalid token signature');
	}

	// 9. Return decoded payload
	return payload;
}

// Helper: atob is available in Workers
