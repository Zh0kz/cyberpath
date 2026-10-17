# Update CyberPath on GitHub Pages

If your existing repository is `Zh0kz/cyberpath`:

1. Keep a backup of your current local folder.
2. Copy the **contents** of this V2.2.1 folder into the root of the cloned `cyberpath` repository, replacing old app files.
3. Do **not** put your OpenRouter API key into any project file.
4. In the repository folder run:

```bash
git status
git add .
git commit -m "Upgrade CyberPath to V2.2.1 Smart Learning"
git push origin main
```

5. Wait for GitHub Pages to deploy, then reopen the site.

This release uses `?v=221` cache-busting on the main CSS/JS files and a new Service Worker cache name to reduce the chance that an older V2.2 script is served after deployment.

Your existing progress uses the same `cyberpath:v2:state` local-storage key. V2.2.1 migrates saved hint counts above 3 down to 3/3 rather than deleting progress.
