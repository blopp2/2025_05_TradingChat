// auth.js – Firebase ID-Token Validation & Session Token via Cloudflare KV

/**
 * ✅ Verifies a Firebase ID token using public JWKS (RSA).
 * @param {string} idToken - Firebase ID token (JWT)
 * @param {string} expectedAudience - Firebase project ID
 * @returns {Promise<object>} Decoded token payload
 * @throws {Error} If validation fails
 */
export async function verifyFirebaseIdToken(idToken, expectedAudience) {
	const parts = idToken.split('.');
	if (parts.length !== 3) throw new Error('Invalid token format');

	const [headerB64, payloadB64, signatureB64] = parts;

	const decodeB64 = (b64) => atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
	const parseJson = (b64) => JSON.parse(decodeB64(b64));

	const header = parseJson(headerB64);
	const payload = parseJson(payloadB64);
	const signature = Uint8Array.from(decodeB64(signatureB64), (c) => c.charCodeAt(0));

	const now = Math.floor(Date.now() / 1000);
	if (!payload.exp || payload.exp < now) throw new Error('Token expired');
	if (payload.aud !== expectedAudience) throw new Error('Invalid audience');
	if (payload.iss !== `https://securetoken.google.com/${expectedAudience}`) {
		throw new Error('Invalid issuer');
	}

	const jwksUrl = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
	const jwksRes = await fetch(jwksUrl);
	if (!jwksRes.ok) throw new Error('Failed to fetch JWKS');

	const jwks = await jwksRes.json();
	const jwk = jwks.keys.find((k) => k.kid === header.kid);
	if (!jwk) throw new Error('Matching public key not found');

	const cryptoKey = await crypto.subtle.importKey(
		'jwk',
		jwk,
		{
			name: 'RSASSA-PKCS1-v1_5',
			hash: 'SHA-256',
		},
		false,
		['verify']
	);

	const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
	const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data);
	if (!isValid) throw new Error('Invalid token signature');

	return payload;
}

/**
 * ✅ Generates and stores a session token in Cloudflare KV.
 * @param {string} uid - Unique user ID
 * @param {any} env - Env containing SESSION_STORE
 * @returns {Promise<string>} - sessionToken
 */
export async function createSessionToken(uid, env) {
	const token = crypto.randomUUID();
	await env.SESSION_STORE.put(token, JSON.stringify({ uid }), {
		expirationTtl: 86400, // 24 h
	});
	return token;
}

/**
 * ✅ Verifies a session token from Cloudflare KV.
 * @param {string} token
 * @param {any} env - Env containing SESSION_STORE
 * @returns {Promise<string>} - UID of authenticated user
 * @throws {Error} - If token is missing, corrupt or invalid
 */
export async function verifySessionToken(token, env) {
	const session = await env.SESSION_STORE.get(token);
	if (!session) throw new Error('Invalid session token');

	try {
		const { uid } = JSON.parse(session);
		if (!uid) throw new Error('No UID found');
		return uid;
	} catch {
		throw new Error('Corrupt session data');
	}
}
