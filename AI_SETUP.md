# CyberPath V2.2 — OpenRouter AI setup

## Important

Do **not** paste an OpenRouter API key into `app.js`, `index.html`, GitHub commits, screenshots, Mission Notes, or chat messages. CyberPath now has an in-app AI settings screen specifically so the key does not need to live in the project files.

## Connect AI

1. Start CyberPath V2.2.
2. Press the **✨** button in the top-right corner.
3. Paste your OpenRouter key into **OpenRouter API key**.
4. Keep **Free-only mode** enabled. This forces the model to `openrouter/free`.
5. Leave **Remember key on this device** disabled if you want the key to disappear after the browser session. Enable it only on your own trusted device if convenience is more important.
6. Press **Save settings**.
7. Press **Test AI**. A successful test should return a short “CyberPath AI online” response.

## How AI is used

- **✨ AI hint** gives a progressive clue and is instructed not to reveal the final answer.
- Open-ended Explain / Report / Keywords missions can use AI to judge meaning instead of requiring exact wording.
- **Ask Cyber Coach** lets you ask conceptual questions from inside CyberPath.
- If OpenRouter is unavailable or rate-limited, CyberPath falls back to its local checks and local hint system.

## Privacy

When an AI function is used, CyberPath sends the current mission context, question, and relevant learner answer to OpenRouter/model providers. It does **not** put the API key or Mission Notes inside the AI prompt. Avoid entering passwords, tokens, personal secrets, or sensitive real-system data into AI answers.

## GitHub Pages

The API key is not contained in this repository. On each device/browser, configure the key from the CyberPath AI dialog. Browser storage is per-device and is not cloud synchronization.
