# Universal Chart Analyzer - Project Documentation

## Project Structure Overview

The repository is organized as follows:

- `src/` - Chrome extension source code (JavaScript, HTML, CSS)
- `snapchart-proxy/` - Cloudflare Worker proxy source
- `dist/` - Compiled extension files (output from Webpack)
- `icons/` - Extension icon images
- `LandingPage/` - Static website for extension promotion
- `node_modules/` - Node.js dependencies
- Root files - `manifest.json`, `webpack.config.js`, `package.json`, workspace config files

---

## Detailed Module Summaries

### Extension (`src/`)

- `background.js` - Chrome extension service worker. Manages screenshots, side panel activation, and proxy communication.
- `auth.js` - Manages user authentication via Firebase.
- `firebase-check.js` - Validates Firebase SDK loading.
- `modal.js` - Handles login/signup modals.
- `sidebar.js` - Controls sidebar UI and event listeners.
- `openai_api.js` - (Empty placeholder; not used).
- `sidebar.html`, `sidebar.css`, `styles.css` - Sidebar UI markup and styling.

### Proxy (`snapchart-proxy/src/`)

- `index.js` - Main Cloudflare Worker script. Authenticates requests and relays them to OpenAI.
- `auth.js` - Verifies Firebase ID tokens cryptographically.
- `config.js` (if any) - Holds configuration (API URLs, keys).

---

## Architecture and Workflow

**Typical flow:**

1. **User Interaction**

   - User opens TradingView.
   - Side panel (`sidebar.html`) loads.

2. **Authentication**

   - User logs in or signs up via Firebase Auth (handled in `auth.js`, `modal.js`).

3. **Capture & Send**

   - User clicks "Capture New Screenshot".
   - `background.js` captures screenshot and sends it along with Firebase ID token to `snapchart-proxy`.

4. **Proxy Handling**

   - `snapchart-proxy` verifies the token using Google public keys.
   - If valid, it relays the request to OpenAI's Chat Completion API.

5. **OpenAI Response**

   - OpenAI returns the generated analysis.
   - The proxy forwards the analysis back to the extension.

6. **Result Display**
   - Sidebar displays AI response to the user.

**Main communication path:**

```
Sidebar -> Background Script -> Cloudflare Worker -> OpenAI API -> Cloudflare Worker -> Background Script -> Sidebar
```

---

## Technologies Used

- **Chrome Extension APIs (Manifest V3)** - Service Worker, Side Panel, Tab Capture, Runtime Messaging.
- **Firebase Authentication** - User management and secure token generation.
- **Cloudflare Workers** - Serverless proxy deployment.
- **OpenAI API** - GPT-4.1 Chat Completions for AI analysis.
- **Webpack** - Bundles JavaScript modules.
- **Vitest** - Testing framework for Worker components.

---

## Development Setup

### Extension Setup

1. Clone the repository:

```bash
git clone https://github.com/blopp2/2025_05_TradingChat.git
cd 2025_05_TradingChat
```

2. Install dependencies:

```bash
npm install
```

3. Build the extension:

```bash
npx webpack --config webpack.config.js
```

4. Load unpacked extension in Chrome (`chrome://extensions`).

### Proxy Deployment

1. Navigate to proxy directory:

```bash
cd snapchart-proxy
npm install
```

2. Set up environment variables (OpenAI API key, Firebase Project ID).

3. Deploy using Wrangler:

```bash
npx wrangler publish
```

---

## Final Notes

- The system ensures security by verifying user identity via Firebase.
- The extension keeps the OpenAI API key secure on the server side via Cloudflare Workers.
- The modular design separates front-end user interaction and back-end API interaction cleanly.
