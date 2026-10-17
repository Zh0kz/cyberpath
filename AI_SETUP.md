# CyberPath V2.2.1 — OpenRouter setup

## Important
Do **not** paste an OpenRouter API key into `app.js`, `index.html`, GitHub commits, screenshots, Mission Notes, or chat messages. Use the in-app AI settings screen.

## Connect AI
1. Start CyberPath V2.2.1.
2. Press the **✨** button in the top-right corner.
3. Paste your OpenRouter key into **OpenRouter API key**.
4. Keep **Free-only mode** enabled if you want CyberPath to force `openrouter/free`.
5. Leave **Remember key on this device** disabled for session-only storage, or enable it only on your own trusted device.
6. Press **Save settings**.
7. Press **Test AI**.

## How AI is used now
### ⚖️ Challenge grading
AI Hint has been removed. First answer the task yourself and press **Verify & complete**. If CyberPath rejects an answer that you believe is correct, press **⚖️ Challenge grading**.

The AI receives:
- the mission question;
- an instructor-only rubric / accepted concepts;
- your exact submitted answer.

It must return one of three verdicts:
- **correct** — the local validator was too strict; CyberPath overrides it and completes the mission;
- **almost_correct** — your idea is close, but something technical is wrong/missing; CyberPath gives a targeted clue without revealing the full answer;
- **incorrect** — the rejection stands; you get a short explanation without the final answer.

Each exact submitted answer can be appealed only once. If you change your answer and verify it again, the new submission can be appealed.

When an appeal is accepted for a text answer, CyberPath learns that normalized answer variant locally so the same wording can be accepted later without another API call.

### Long open answers
If **Use AI semantic grading** is enabled, Explain / Report / Keywords missions may use AI after the local quality gate to judge meaning rather than exact wording.

### Ask Cyber Coach
The separate Cyber Coach remains available for conceptual questions. It is not part of the hint budget.

## Hints are local, not AI
Missions now have at most **3 progressive local hints**. After `3/3`, the hint button is disabled and **Show answer** becomes available. Viewing the answer reduces the Mastery reward and schedules review.

## Privacy
When an AI function is used, CyberPath sends the current mission context, question, rubric and relevant learner answer to OpenRouter/model providers. It does **not** include the OpenRouter API key or Mission Notes in the prompt. Do not enter passwords, tokens, personal secrets, or sensitive real-system data into training answers.

## GitHub Pages
The key is not contained in the repository. Configure it separately on each browser/device. API-key storage is currently per-device and is not cloud synchronization.
