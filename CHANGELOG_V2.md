# CyberPath V2 Training Core — implementation summary

## Implemented now
1. New progression model: XP, Mastery, Boss Exams and Rank are separate.
2. 8 training modules with module and sub-skill mastery.
3. Progressive prerequisites and boss-gated unlocks.
4. Optional 15-question placement test with beginner fast-track.
5. Real task types: Learn, Quiz, Lab, Investigation, Explain, Report, Project.
6. Locally verified answers for MCQ, commands, keywords and minimum report quality gates.
7. Real hands-on exercises for ipconfig, ARP cache, nslookup, tracert, Linux shell, grep/find/chmod, Nmap on authorized labs, curl, DevTools and Burp.
8. Official PortSwigger Academy links for the SQLi and XSS hands-on labs.
9. Spaced-repetition review system using 1, 3, 7, 14 and 30 day intervals.
10. Weak-skill tracking from wrong answers.
11. 8 Boss Exams with mastery requirements and reduced XP reward when hints are used.
12. Final Junior Pentester exam requires strong mastery and at least two projects.
13. Mission notes, field journal and searchable glossary.
14. Activity heatmap, mastery statistics and meaningful achievements.
15. JSON export/import progress backups.
16. PWA/offline support and Windows/macOS local launchers.
17. V1-safe migration: existing activity/name can be imported without pretending V1 XP equals knowledge.

## Deliberately not implemented yet
- Embedded AI Game Master / semantic grading of free-text answers (would require an API/backend or supported integration).
- Cloud account/sync across devices.
- Automatic verification that an external PortSwigger/HTB/THM lab was actually completed.
- A custom vulnerable VM/container bundled with CyberPath.

These are better V3/V4 features because they need infrastructure beyond a static free PWA.


## V2.2 — AI Coach & Fair Hints

- Optional OpenRouter AI Coach using `openrouter/free` by default.
- API key is never hard-coded into project files. Session-only storage is the default; device persistence is opt-in.
- AI progressive hints that are explicitly instructed not to reveal final answers.
- Optional meaning-based AI grading for open answers with local fallback when AI is unavailable.
- Quiz/investigation/lab study notes are now hidden before the attempt instead of exposing answers immediately.
- Local progressive hint system and Mastery reduction when hints are used; XP remains activity XP.
- Review Mode no longer reveals the correct answer after the first mistake.
- Curated official learning resources are shown for each module.
- `openrouter/free` can change underlying free models and rate limits; CyberPath continues to work without AI.

- Added Free-only mode (default) to force `openrouter/free` and reduce accidental paid-model use.
- Added explicit privacy note: mission context/answers are sent to OpenRouter when AI features are used; mission notes and the key are not put into prompts.
