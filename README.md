# 🔥 AI Roast Me

A brutal, hilarious, viral AI roast generator web app. Upload a selfie and get absolutely cooked.

## Features

- Photo upload (camera or gallery)
- Multiple roast styles: Savage, Gen Z, British, Brutal, Dad Mode, Sigma
- Hilarious, shareable roast cards
- "Make it Meaner" escalation
- Download roast as high-quality PNG image
- Copy roast text
- Fully responsive + PWA (installable on mobile/desktop)
- Fake but convincing "AI" processing with funny loading states
- Dark, edgy, meme-ready aesthetic

## Tech

- 100% vanilla HTML + Tailwind (CDN) + JavaScript
- html2canvas for image export
- Progressive Web App (manifest + service worker)
- Works completely offline after first load

## Quick Deploy

### Vercel / Netlify / GitHub Pages

1. Push this folder to a repo
2. Connect to Vercel/Netlify
3. Deploy (it's static — instant)

Or simply open `index.html` locally.

## PWA

- Installable on iOS/Android/Desktop
- Works offline
- Add to home screen for full app feel

## Real AI Integration (v2)

This version connects to the real **xAI Grok Vision API** (model: `grok-4.3`).

### How to use real roasts:
1. Get an API key at https://console.x.ai/
2. In the app, click the **🔑 KEY** button in the top right (or it will prompt on first use)
3. Paste your key (stored only in your browser's localStorage)
4. Upload a photo — Grok will actually look at it and generate a personalized savage roast

The prompt is carefully engineered for **specific, witty, observational roasts** based on real visual details (clothing, expression, hair, vibe, etc.).

### Troubleshooting API errors (e.g. 403):
- 403 Forbidden: Your API key/team lacks permission for the model (Grok 4.3 + vision), or no billing/credits, or account blocked. 
  - Go to https://console.x.ai/ , check your team's API key permissions, add credits if needed, or create a new key.
  - Ask your team admin.
  - The app will clear the bad key and prompt again.
- Check browser console for full error details (we log the response).
- If persistent, fall back to demo roasts until you get a working key.

**Note:** API usage costs money (very cheap for this). For production use, proxy the calls through a backend.

## Deploy

Pure static site. Works great on Vercel, Netlify, GitHub Pages, or even just opening the HTML locally.

## Made with Grok

Upgraded with real vision + viral sharing features.