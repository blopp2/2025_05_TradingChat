export default {
	async fetch(request, env, ctx) {
		try {
			if (request.method !== 'POST') {
				return new Response('Only POST requests are allowed', { status: 405 });
			}

			const { action, dataUrl, text } = await request.json().catch(() => ({}));
			if (!action || (!dataUrl && !text)) {
				return new Response('Invalid request body', { status: 400 });
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
				messages.push({
					role: 'user',
					content: [{ type: 'text', text }],
				});
			} else {
				return new Response('Unsupported action', { status: 400 });
			}

			const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.OPENAI_KEY}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: 'gpt-4.1-mini', // Dein gewünschtes Modell!
					messages,
					max_tokens: 1500,
					temperature: 0.2,
				}),
			});

			if (!openaiResponse.ok) {
				const errorData = await openaiResponse.text();
				console.error('OpenAI API Error:', errorData);
				return new Response(`OpenAI Error: ${errorData}`, { status: 502 });
			}

			const openaiResult = await openaiResponse.json();
			const content = openaiResult.choices?.[0]?.message?.content || '';

			if (!content) {
				return new Response('OpenAI response was empty', { status: 502 });
			}

			return new Response(JSON.stringify({ answer: content }), {
				headers: { 'Content-Type': 'application/json' },
				status: 200,
			});
		} catch (error) {
			console.error('Unexpected Error:', error.message);
			return new Response('Internal Server Error', { status: 500 });
		}
	},
};
