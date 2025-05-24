// firestore.js – Cloudflare Worker Firestore REST API Integration

const FIRESTORE_API = 'https://firestore.googleapis.com/v1';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * Create JWT for Google OAuth2
 */
async function createJwt(env) {
	if (!env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
		throw new Error('Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY secret');
	}
	const CLIENT_EMAIL = env.GOOGLE_CLIENT_EMAIL;
	const PRIVATE_KEY = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
	const header = { alg: 'RS256', typ: 'JWT' };
	const now = Math.floor(Date.now() / 1000);
	const claimSet = {
		iss: CLIENT_EMAIL,
		sub: CLIENT_EMAIL,
		aud: TOKEN_ENDPOINT,
		iat: now,
		exp: now + 3600,
		scope: 'https://www.googleapis.com/auth/datastore',
	};

	const encode = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

	const headerEncoded = encode(header);
	const claimSetEncoded = encode(claimSet);
	const data = new TextEncoder().encode(`${headerEncoded}.${claimSetEncoded}`);

	// Private key in DER format
	const keyData = PRIVATE_KEY.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\n/g, '');
	const binaryDer = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

	const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryDer.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
		'sign',
	]);

	const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, data);
	const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');

	return `${headerEncoded}.${claimSetEncoded}.${signatureEncoded}`;
}

/**
 * Fetch OAuth2 access token from Google
 */
async function getAccessToken(env) {
	const jwt = await createJwt(env);
	const res = await fetch(TOKEN_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt,
		}),
	});
	if (!res.ok) throw new Error('Failed to fetch access token');
	const data = await res.json();
	return data.access_token;
}

/**
 * Get user document from Firestore
 */
export async function getUserDoc(uid, env) {
	const PROJECT_ID = env.FIREBASE_PROJECT_ID;
	const token = await getAccessToken(env);
	const res = await fetch(`${FIRESTORE_API}/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) return null;
	return res.json();
}

/**
 * Create a new user document (POST)
 */
async function createUserDoc(uid, fields, env) {
	const PROJECT_ID = env.FIREBASE_PROJECT_ID;
	const token = await getAccessToken(env);
	const res = await fetch(`${FIRESTORE_API}/projects/${PROJECT_ID}/databases/(default)/documents/users?documentId=${uid}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ fields }),
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Firestore CREATE error ${res.status}: ${err}`);
	}
	return res.json();
}

/**
 * Patch an existing document with updateMask so only specified fields change
 */
async function patchUserDoc(uid, fields, env) {
	const PROJECT_ID = env.FIREBASE_PROJECT_ID;
	const token = await getAccessToken(env);

	// Build updateMask for each field key
	const maskParams = Object.keys(fields)
		.map((f) => `updateMask.fieldPaths=${f}`)
		.join('&');

	const url = `${FIRESTORE_API}/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?${maskParams}`;
	const res = await fetch(url, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ fields }),
	});

	// If document doesn't exist, fallback to create
	if (res.status === 404) {
		return createUserDoc(uid, fields, env);
	}
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Firestore PATCH error ${res.status}: ${err}`);
	}
	return res.json();
}

/**
 * setUserDoc – upsert for login/signup (full fields)
 */
export async function setUserDoc(uid, data, env) {
	const fields = {};
	if (data.email) fields.email = { stringValue: data.email };
	if (data.analysesRemaining !== undefined) fields.analysesRemaining = { integerValue: data.analysesRemaining };
	if (data.lastReset) fields.lastReset = { timestampValue: data.lastReset };

	const exists = await getUserDoc(uid, env);
	if (exists) {
		return patchUserDoc(uid, fields, env);
	} else {
		return createUserDoc(uid, fields, env);
	}
}

/**
 * updateUserDoc – updates analysesRemaining and/or lastReset, leaves other fields intact
 */
export async function updateUserDoc(uid, updates, env) {
	const fields = {};
	if (updates.analysesRemaining !== undefined) {
		fields.analysesRemaining = { integerValue: updates.analysesRemaining };
	}
	if (updates.lastReset) {
		fields.lastReset = { timestampValue: updates.lastReset };
	}
	return patchUserDoc(uid, fields, env);
}
