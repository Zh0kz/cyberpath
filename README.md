# CyberPath V2 — Training Core

CyberPath V2 is an offline-first cybersecurity learning RPG. It keeps the visual style of V1 but changes the learning logic: XP tracks activity, while Mastery + Boss Exams determine real progression.

## Run on Windows
1. Extract the folder.
2. Close the old V1 server window first if it is still running.
3. Double-click `start_windows.bat`.
4. Keep the server window open.
5. CyberPath opens at `http://localhost:8080`.

## Run on macOS
Double-click `start_mac.command` (you may need to allow it in Security settings the first time).

## What V2 adds
- 8-module roadmap: Foundations → Networking → Linux → Recon → Web → Web Security → Linux PrivEsc → Pentesting.
- 80+ checked learning missions including labs, investigations, reports and projects.
- XP and knowledge Mastery separated.
- Prerequisite / boss-gated progression.
- Placement Test to fast-track beginner theory you already know.
- Spaced repetition Review Mode (1/3/7/14/30-day intervals).
- Weak-skill detection based on mistakes.
- 8 Boss Exams, including a final Junior Pentester checkpoint.
- Mission notes + free-form field journal + glossary.
- Local progress, offline PWA, export/import JSON backup.
- Safer lab framing: active testing is limited to your own systems, CTFs, and explicit training environments.

## Important limitation
V2 does **not** contain an AI model inside the app. Open-ended explanations/reports are checked locally using minimum length / simple keyword rules. For detailed qualitative feedback, bring the answer into ChatGPT. This keeps V2 free and offline.

## Progress model
- XP = activity / consistency.
- Mastery = checked learning evidence per skill.
- Bosses = module checkpoints.
- Rank = verified milestones; it cannot be farmed by repeating easy XP tasks.

## Safe practice
Only perform active scanning/testing against systems you own or have explicit authorization to test, or against purpose-built CTF/training labs.


## Optional AI Coach (V2.2)

CyberPath can call OpenRouter directly from the browser. Do **not** commit an API key to GitHub. Open **✨ AI Coach** inside the app and paste the key there. By default the key is stored only for the browser session; permanent local storage is an explicit opt-in. The default model is `openrouter/free`, so the exact underlying free model may vary. If the AI is unavailable or rate-limited, local missions, hints, checks, reviews and progress still work.

### AI privacy / cost note
AI requests send the current mission/question and the learner response to OpenRouter/model providers. CyberPath does not include Mission Notes or the API key inside the prompt. Free-only mode is enabled by default and forces `openrouter/free` to reduce the risk of accidentally selecting a paid model.
