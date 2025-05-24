// auth.js – Proxy Auth for SnapChart Cloudflare Worker
// Handles Firebase ID token verification and session token lifecycle

/**
 * Verifies a Firebase ID token using Google's public JWKS.
 * @param {string} idToken - Firebase ID token (JWT)
 * @param {string} expectedAudience - Firebase project ID
 * @returns {Promise<Object>} Decoded token payload
 * @throws {Error} If validation fails
 */
export async function verifyFirebaseIdToken(idToken, expectedAudience) {
	if (!idToken) throw new Error('No ID token provided');
	const [headerB64, payloadB64, sigB64] = idToken.split('.');
	if (!headerB64 || !payloadB64 || !sigB64) throw new Error('Invalid token format');

	const decode = (b64) => atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
	let header, payload;
	try {
		header = JSON.parse(decode(headerB64));
		payload = JSON.parse(decode(payloadB64));
	} catch (e) {
		throw new Error('Failed to parse JWT');
	}

	const now = Math.floor(Date.now() / 1000);
	if (!payload.exp || payload.exp < now) throw new Error('Token expired');
	if (payload.aud !== expectedAudience) throw new Error('Invalid audience');
	if (payload.iss !== `https://securetoken.google.com/${expectedAudience}`) throw new Error('Invalid issuer');

	// Fetch JWKS
	const jwksUri = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
	const jwksRes = await fetch(jwksUri);
	if (!jwksRes.ok) throw new Error('Failed to fetch JWKS');
	const { keys } = await jwksRes.json();
	const jwk = keys.find((k) => k.kid === header.kid);
	if (!jwk) throw new Error('Public key not found');

	// Import key
	const cryptoKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);

	// Verify signature
	const signature = Uint8Array.from(decode(sigB64), (c) => c.charCodeAt(0));
	const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
	const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data);
	if (!valid) throw new Error('Invalid token signature');

	return payload;
}

/**
 * Creates a session token for a user and stores it in KV with TTL.
 * @param {string} uid - User ID
 * @param {object} env - Cloudflare environment (with SESSION_STORE)
 * @returns {Promise<string>} The session token
 */
export async function createSessionToken(uid, env) {
	if (!uid) throw new Error('UID required');
	const token = crypto.randomUUID();
	await env.SESSION_STORE.put(token, JSON.stringify({ uid }), { expirationTtl: 86400 }); // 24h
	return token;
}

/**
 * Verifies a session token from KV and returns the associated UID.
 * @param {string} token - Session token
 * @param {object} env - Cloudflare environment (with SESSION_STORE)
 * @returns {Promise<string>} UID
 * @throws {Error} If token invalid or expired
 */
export async function verifySessionToken(token, env) {
	if (!token) throw new Error('No session token');
	const data = await env.SESSION_STORE.get(token);
	if (!data) throw new Error('Invalid session token');
	try {
		const { uid } = JSON.parse(data);
		if (!uid) throw new Error();
		return uid;
	} catch {
		throw new Error('Corrupt session data');
	}
}
