import { createSessionToken, verifySessionToken, verifyFirebaseIdToken } from './auth.js';

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;

		// Only allow POST requests
		if (request.method !== 'POST') {
			return jsonResponse({ error: 'Only POST allowed' }, 405);
		}

		// 🔐 LOGIN via Firebase REST API (no session required)
		if (path === '/login') {
			const { email, password } = await safeJson(request);
			if (!email || !password) {
				return jsonResponse({ error: 'Missing email or password' }, 400);
			}

			// 1️⃣ Call Firebase signInWithPassword endpoint
			const firebaseRes = await fetch(
				`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_WEB_API_KEY}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password, returnSecureToken: true }),
				}
			);

			// 2️⃣ Handle Firebase errors
			if (!firebaseRes.ok) {
				const errJson = await firebaseRes.json().catch(() => ({}));
				const msg = errJson.error?.message || 'Invalid credentials';
				console.error('🔥 Firebase login error:', msg);
				return jsonResponse({ error: msg }, 401);
			}

			// 3️⃣ Verify the returned ID token
			const { idToken } = await firebaseRes.json();
			let payload;
			try {
				payload = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
			} catch (err) {
				console.error('❌ Token verification failed:', err.message);
				return jsonResponse({ error: 'Invalid ID token' }, 401);
			}

			// 4️⃣ Issue your own session token
			const uid = payload.user_id || payload.sub;
			const sessionToken = await createSessionToken(uid, env);
			return jsonResponse({ sessionToken });
		}

		// 🆕 SIGNUP via Firebase REST API (no session required)
		if (path === '/signup') {
			const { email, password } = await safeJson(request);
			if (!email || !password) {
				return jsonResponse({ error: 'Missing email or password' }, 400);
			}

			try {
				// Create a new user in Firebase
				const firebaseRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.FIREBASE_WEB_API_KEY}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password, returnSecureToken: true }),
				});

				if (!firebaseRes.ok) {
					const errJson = await firebaseRes.json().catch(() => ({}));
					const msg = errJson.error?.message || 'Firebase signup failed';
					console.error('🔥 Firebase signup error:', msg);
					return jsonResponse({ error: msg }, 400);
				}

				const { idToken } = await firebaseRes.json();
				const payload = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
				const uid = payload.user_id || payload.sub;
				const sessionToken = await createSessionToken(uid, env);
				return jsonResponse({ sessionToken });
			} catch (err) {
				console.error('❌ Signup error:', err.message);
				return jsonResponse({ error: 'Internal Server Error' }, 500);
			}
		}

		// ---- Session check ab hier für alle weiteren Endpoints ----
		const token = request.headers.get('Authorization')?.replace('Bearer ', '');
		if (!token) return unauthorized();

		const session = await env.SESSION_STORE.get(token);
		if (!session) return unauthorized();

		// 🤖 ANALYZE endpoint
		if (path === '/analyze') {
			const authHeader = request.headers.get('Authorization') || '';
			if (!authHeader.startsWith('Bearer ')) {
				return jsonResponse({ error: 'Missing session token' }, 401);
			}

			const sessionToken = authHeader.replace('Bearer ', '');
			let uid;
			try {
				uid = await verifySessionToken(sessionToken, env);
			} catch (err) {
				console.error('Session token invalid:', err.message);
				return jsonResponse({ error: 'Invalid session token' }, 401);
			}

			const { action, dataUrl, text } = await safeJson(request);
			if (!action || (!dataUrl && !text)) {
				return jsonResponse({ error: 'Invalid request body' }, 400);
			}

			const messages = [
				{
					role: 'system',
					content: env.SYSTEM_PROMPT || 'You are a trading assistant. Analyze charts and provide recommendations.',
				},
			];
			if (action === 'analyze' && dataUrl) {
				messages.push({
					role: 'user',
					content: [
						{ type: 'text', text: 'Please analyze this trading chart.' },
						{ type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
					],
				});
			} else if (action === 'ask' && text) {
				messages.push({ role: 'user', content: [{ type: 'text', text }] });
			} else {
				return jsonResponse({ error: 'Unsupported action' }, 400);
			}

			const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: { Authorization: `Bearer ${env.OPENAI_KEY}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ model: 'gpt-4.1', messages, max_tokens: 1500, temperature: 0.2 }),
			});

			if (!openaiRes.ok) {
				const errMsg = await openaiRes.text();
				console.error('OpenAI API error:', errMsg);
				return jsonResponse({ error: 'OpenAI error' }, 502);
			}

			const data = await openaiRes.json();
			const content = data.choices?.[0]?.message?.content || '';
			if (!content) {
				return jsonResponse({ error: 'Empty response from OpenAI' }, 502);
			}
			return jsonResponse({ answer: content });
		}

		// Default: Not Found
		return jsonResponse({ error: 'Not Found' }, 404);
	},
};

// 🔧 JSON Response Helper (mit CORS Header)
function jsonResponse(obj, status = 200) {
	return new Response(JSON.stringify(obj), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		},
	});
}

// 🔒 Fallback JSON body parser
async function safeJson(request) {
	try {
		return await request.json();
	} catch {
		return {};
	}
}

// 📛 UID generator (wird nicht mehr genutzt, aber falls doch...)
function toUid(email) {
	if (!email) throw new Error('Missing email for UID');
	return email.replace(/[@.]/g, '_');
}

// 401-Response Helper (mit CORS Header)
function unauthorized() {
	return new Response(JSON.stringify({ error: 'SESSION_EXPIRED' }), {
		status: 401,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		},
	});
}
