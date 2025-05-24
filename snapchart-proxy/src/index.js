import { createSessionToken, verifySessionToken, verifyFirebaseIdToken } from './auth.js';
import { getUserDoc, setUserDoc, updateUserDoc } from './firestore.js';

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;

		// Nur POST zulassen
		if (request.method !== 'POST') {
			return jsonResponse({ error: 'Only POST allowed' }, 405);
		}

		// Default-Werte aus env oder Fallback
		const INITIAL_QUOTA = env.INITIAL_QUOTA ? parseInt(env.INITIAL_QUOTA, 10) : 10;
		const RESET_INTERVAL_MS = env.RESET_INTERVAL_MS ? parseInt(env.RESET_INTERVAL_MS, 10) : 24 * 60 * 60 * 1000; // 24h

		// ─── Unauthenticated Endpoints ─────────────────────────────────────
		if (path === '/feedback') {
			const auth = request.headers.get('Authorization')?.replace('Bearer ', '');
			if (!auth) return unauthorized();

			let uid;
			try {
				uid = await verifySessionToken(auth, env);
			} catch {
				return jsonResponse({ error: 'Invalid session' }, 401);
			}

			const { text } = await safeJson(request);
			if (!text) return jsonResponse({ error: 'Missing feedback' }, 400);

			// write to Firestore collection "feedback"
			const now = new Date().toISOString();
			await addFeedback(uid, text, now, env);
			return jsonResponse({ success: true }, 200);
		}

		if (path === '/login') {
			const { email, password } = await safeJson(request);
			if (!email || !password) {
				return jsonResponse({ error: 'Missing email or password' }, 400);
			}

			// Firebase-Login
			const firebaseRes = await fetch(
				`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_WEB_API_KEY}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password, returnSecureToken: true }),
				}
			);
			if (!firebaseRes.ok) {
				const err = await firebaseRes.json().catch(() => ({}));
				return jsonResponse({ error: err.error?.message || 'Invalid credentials' }, 401);
			}
			const { idToken } = await firebaseRes.json();
			const payload = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
			const uid = payload.user_id || payload.sub;

			// Erstes Anlegen mit lastReset, falls noch kein Doc existiert
			try {
				const existing = await getUserDoc(uid, env);
				if (!existing) {
					const nowIso = new Date().toISOString();
					await setUserDoc(uid, { email, analysesRemaining: INITIAL_QUOTA, lastReset: nowIso }, env);
				}
			} catch (e) {
				console.error('❌ Firestore init error:', e.message);
				return jsonResponse({ error: 'Failed to initialize user data' }, 500);
			}

			// Session-Token ausgeben
			const sessionToken = await createSessionToken(uid, env);
			return jsonResponse({ sessionToken });
		}

		if (path === '/signup') {
			const { email, password } = await safeJson(request);
			if (!email || !password) {
				return jsonResponse({ error: 'Missing email or password' }, 400);
			}
			try {
				const firebaseRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.FIREBASE_WEB_API_KEY}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password, returnSecureToken: true }),
				});
				if (!firebaseRes.ok) {
					const err = await firebaseRes.json().catch(() => ({}));
					return jsonResponse({ error: err.error?.message || 'Firebase signup failed' }, 400);
				}
				const { idToken } = await firebaseRes.json();
				const payload = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
				const uid = payload.user_id || payload.sub;

				// Initiales Anlegen mit lastReset
				const nowIso = new Date().toISOString();
				await setUserDoc(uid, { email, analysesRemaining: INITIAL_QUOTA, lastReset: nowIso }, env);

				const sessionToken = await createSessionToken(uid, env);
				return jsonResponse({ sessionToken });
			} catch (e) {
				console.error('❌ Signup error:', e.message);
				return jsonResponse({ error: e.message || 'Internal Server Error' }, 500);
			}
		}

		// ─── Ab hier nur mit gültiger Session ───────────────────────────────

		const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
		if (!authHeader) return unauthorized();

		let uid;
		try {
			uid = await verifySessionToken(authHeader, env);
		} catch (e) {
			console.error('❌ Invalid session token:', e.message);
			return jsonResponse({ error: 'Invalid session token' }, 401);
		}

		// ➡️ USAGE: individuelles Reset-on-demand
		if (path === '/usage') {
			// 1) UserDoc holen oder initial erstellen
			let userDoc = await getUserDoc(uid, env);
			if (!userDoc) {
				const nowIso = new Date().toISOString();
				await setUserDoc(uid, { analysesRemaining: INITIAL_QUOTA, lastReset: nowIso }, env);
				userDoc = await getUserDoc(uid, env);
			}

			const f = userDoc.fields || {};
			let remaining = parseInt(f.analysesRemaining?.integerValue || '0', 10);
			const lastResetTs = f.lastReset?.timestampValue ? new Date(f.lastReset.timestampValue).getTime() : 0;
			const nowTime = Date.now();
			const nextResetTime = lastResetTs + RESET_INTERVAL_MS;

			// Reset nur beim ersten Mal oder nach Ablauf des Intervalls
			if (lastResetTs === 0 || nowTime >= nextResetTime) {
				remaining = INITIAL_QUOTA;
				const nowIso = new Date(nowTime).toISOString();
				await updateUserDoc(uid, { analysesRemaining: INITIAL_QUOTA, lastReset: nowIso }, env);
			}

			const waitMs = remaining > 0 ? 0 : nextResetTime - nowTime;
			return jsonResponse({ analysesRemaining: remaining, waitMs });
		}

		// 🤖 ANALYZE
		if (path === '/analyze') {
			const { action, dataUrl, text } = await safeJson(request);
			if (!action || (!dataUrl && !text)) {
				return jsonResponse({ error: 'Invalid request body' }, 400);
			}

			const userDoc = await getUserDoc(uid, env);
			const analysesRemaining = parseInt(userDoc.fields?.analysesRemaining?.integerValue || '0', 10);
			if (analysesRemaining <= 0) {
				return jsonResponse({ error: 'Analysis limit reached. Please donate to get more analyses.' }, 403);
			}

			// OpenAI-Request aufbauen
			const messages = [
				{ role: 'system', content: env.SYSTEM_PROMPT || 'You are a trading assistant. Analyze charts and provide recommendations.' },
			];
			if (action === 'analyze' && dataUrl) {
				messages.push({
					role: 'user',
					content: [
						{ type: 'text', text: 'Please analyze this trading chart.' },
						{ type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
					],
				});
			} else {
				messages.push({ role: 'user', content: [{ type: 'text', text }] });
			}

			const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: { Authorization: `Bearer ${env.OPENAI_KEY}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ model: 'gpt-4.1', messages, max_tokens: 1500, temperature: 0.2 }),
			});
			if (!openaiRes.ok) {
				const errMsg = await openaiRes.text();
				console.error('❌ OpenAI API error:', errMsg);
				return jsonResponse({ error: 'OpenAI error', details: errMsg }, 502);
			}
			const data = await openaiRes.json();
			const content = data.choices?.[0]?.message?.content || '';
			if (!content) {
				return jsonResponse({ error: 'Empty response from OpenAI' }, 502);
			}

			// Kontingent reduzieren
			await updateUserDoc(uid, { analysesRemaining: analysesRemaining - 1 }, env);
			return jsonResponse({ answer: content });
		}

		// Default: Not Found
		return jsonResponse({ error: 'Not Found' }, 404);
	},
};

// ─── Helfer ───────────────────────────────────────────────────────────

function jsonResponse(obj, status = 200) {
	return new Response(JSON.stringify(obj), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		},
	});
}

async function safeJson(request) {
	try {
		return await request.json();
	} catch {
		return {};
	}
}

function unauthorized() {
	return new Response(JSON.stringify({ error: 'SESSION_EXPIRED' }), {
		status: 401,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		},
	});
}
