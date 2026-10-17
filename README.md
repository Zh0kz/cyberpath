# CyberPath V2.2.1 — Smart Learning Engine

CyberPath is an offline-first cybersecurity learning RPG. XP tracks activity, while Mastery + Boss Exams determine real progression. V2.2.1 focuses on fair learning: limited hints, smarter answer normalization, answer reveal only after the hint budget is exhausted, and optional AI grading appeals.

## Run on Windows
1. Extract the folder.
2. Close older CyberPath local server windows if they are still running.
3. Double-click `start_windows.bat`.
4. Keep the server window open.
5. CyberPath opens at `http://127.0.0.1:8094`.

## Run on macOS
Run `start_mac.command` (you may need to allow it in Security settings the first time). It uses port `8094`.

## Core training system
- 8-module roadmap: Foundations → Networking → Linux → Recon → Web → Web Security → Linux PrivEsc → Pentesting.
- 80+ checked missions: Learn, Quiz, Lab, Investigation, Explain, Report and Project.
- XP and Mastery are separate.
- Prerequisite / boss-gated progression.
- Placement Test for beginner fast-track.
- Spaced repetition Review Mode (1/3/7/14/30-day intervals).
- Weak-skill tracking from mistakes.
- 8 Boss Exams including the Junior Pentester checkpoint.
- Mission notes, field journal and glossary.
- Local progress, offline PWA and JSON export/import backup.

## V2.2.1 Smart Learning changes
- Mission hints are capped at **3/3**. Repeated clicks cannot generate Hint 4, 5, 11, etc.
- The three hints are progressive and deterministic, so reopening the mission shows the same used hints.
- **Show answer** appears only after all three hints are used.
- Revealing the answer reduces that attempt's Mastery reward and schedules the skill for review.
- **Quick retry** hides the revealed answer so you can recall it again, but the reveal penalty remains for fairness.
- `AI Hint` was removed.
- Local answer validation now normalizes case, arrows, spaces and common separators. For example, `SYN SYN/ACK ACK`, `SYN → SYN-ACK → ACK`, and `syn syn ack ack` are treated as equivalent.
- Technical mistakes that change meaning are not silently accepted; e.g. `ACK` → `ACT` is not auto-corrected.
- After a rejected answer, **⚖️ Challenge grading** can ask AI to judge the exact submitted answer.
- AI returns one of: `correct`, `almost_correct`, or `incorrect`.
- If an appeal is accepted, CyberPath overrides the local rejection, restores the unfairly counted mistake, completes the mission, and learns that answer variant locally.
- One appeal is allowed per exact submitted answer. Change the answer and verify again to create a new appeal opportunity.
- Open Explain/Report/Keywords tasks can still use optional semantic AI grading when enabled.
- Review Mode no longer allows endlessly repeating the same hint.

## Optional OpenRouter AI
CyberPath can use your own OpenRouter API key. The key is **not** included in project files. Configure it from the ✨ button in the app. `openrouter/free` remains the default when Free-only mode is enabled.

AI is now mainly used for:
1. **Grading appeals** when you believe a rejected answer is actually correct.
2. Optional semantic grading of long open answers.
3. The separate conceptual Cyber Coach chat.

Normal quizzes, hints, progress and offline training continue to work without AI.

## API key safety
Never put the OpenRouter key in `app.js`, GitHub commits, screenshots, notes, or reports. By default CyberPath stores it only in session storage; permanent storage is opt-in for your own trusted device.

## Progress model
- XP = activity / consistency.
- Mastery = checked learning evidence.
- Hints = lower Mastery, not activity XP.
- Answer reveal = strong Mastery reduction + review scheduling.
- Bosses = module checkpoints.
- Rank = verified milestones.

## Safe practice
Only perform active scanning/testing against systems you own, systems you have explicit authorization to test, or purpose-built CTF/training labs.
