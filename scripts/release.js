const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'chasinghues/Hatch';
const TAG = 'v1.0.12';
const RELEASE_NAME = 'Hatch v1.0.12';
const BODY = `### Release Notes: Hatch v1.0.12

**Summary**
This update introduces dynamic configuration capabilities, allowing Hatch to sync project types and directory structures directly from GitHub Gists. This enables seamless updates to standardized workflows across multiple installations without requiring a manual app update.

**Bug Fixes**
*   **Template Persistence:** Fixed a bug where default templates were sometimes re-added to the user's list on every launch, causing duplicates.
*   **First-Run Experience:** Resolved an issue where the initial download of project structures would fail to cache correctly on some systems.
*   **Sync Logic:** Improved the robustness of the remote-fetch mechanism to handle network timeouts gracefully without blocking the UI.

**Feature Additions**
*   **Dynamic Gist Synchronization:**
    *   **Remote Templates:** The app now automatically pulls the latest directory structures from your central GitHub Gist (\`TemplateTypes.json\`).
    *   **Live Project Types:** Project types are now fetched dynamically, ensuring any organizational additions are instantly available to users.
*   **Standardized Fallbacks:** Implemented a robust "local-first" fallback system that ensures the app remains fully functional using built-in defaults if the user is offline.
*   **UI Polish:** Minor refinements to the template selection dropdown for better readability of long template names.

**Notes for Mac Installation**

Since Hatch is a specialized productivity tool distributed independently, macOS requires a one-time permission to run the "unidentified" binary:

1.  **The "Right-Click" Method (Recommended):**
    *   Download \`Hatch-1.0.12-universal.dmg\` and drag the **Hatch** icon to your **Applications** folder.
    *   **Right-click** (or Control-click) the Hatch app in your Applications folder and select **Open**.
    *   Click **Open** on the security warning dialog. *You will only need to do this once.*

2.  **The Terminal Method (Bypass):**
    *   If you see a message saying the app "is damaged" or cannot be verified, open your Terminal and run:
    \`\`\`bash
    xattr -cr /Applications/Hatch.app
    \`\`\`
4.  You can now open the app normally.`;

async function getOrCreateRelease() {
    console.log(`Checking for release ${TAG}...`);

    // 1. Check if release exists
    const checkRes = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`, {
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Hatch-Release-Script'
        }
    });

    if (checkRes.ok) {
        const release = await checkRes.json();
        console.log(`Release ${TAG} found: ${release.html_url}`);
        return release;
    }

    // 2. Create if not exists
    console.log('Creating new release...');
    const createRes = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Hatch-Release-Script'
        },
        body: JSON.stringify({
            tag_name: TAG,
            target_commitish: 'main',
            name: RELEASE_NAME,
            body: BODY,
            draft: false,
            prerelease: false
        })
    });

    if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(`Failed to create release: ${createRes.status} ${err}`);
    }

    const data = await createRes.json();
    console.log(`Release created: ${data.html_url}`);
    return data;
}

async function uploadAsset(uploadUrl, filePath) {
    const fileName = path.basename(filePath);
    console.log(`Uploading ${fileName}...`);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const stats = fs.statSync(filePath);
    const fileStream = fs.readFileSync(filePath);

    // Remove template params {?name,label}
    const cleanUrl = uploadUrl.replace(/{.*}/, '');
    const targetUrl = `${cleanUrl}?name=${encodeURIComponent(fileName)}`;

    const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/octet-stream',
            'Content-Length': stats.size,
            'User-Agent': 'Hatch-Release-Script'
        },
        body: fileStream
    });

    if (!response.ok) {
        // If 422, likely already exists. We can ignore or try to delete and re-upload.
        // For now, logging error is sufficient.
        const err = await response.text();
        console.error(`Failed to upload ${fileName}: ${response.status} ${err}`);
    } else {
        console.log(`Uploaded ${fileName}`);
    }
}

async function main() {
    if (!TOKEN) {
        console.error('Error: GITHUB_TOKEN environment variable is required.');
        process.exit(1);
    }

    const releaseDir = path.join(__dirname, '../release');
    if (!fs.existsSync(releaseDir)) {
        console.error('Release directory not found.');
        process.exit(1);
    }

    try {
        const release = await getOrCreateRelease();

        // Find all relevant assets
        const files = fs.readdirSync(releaseDir);
        const assets = files.filter(f => {
            const ext = path.extname(f).toLowerCase();
            return ['.exe', '.dmg', '.zip', '.appimage', '.deb', '.yml'].includes(ext) && !f.endsWith('.blockmap');
        });

        console.log(`Found ${assets.length} artifacts to upload.`);

        for (const asset of assets) {
            await uploadAsset(release.upload_url, path.join(releaseDir, asset));
        }
        console.log('All assets processed.');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
