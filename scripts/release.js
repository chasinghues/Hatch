const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'chasinghues/Hatch';
const TAG = 'v1.0.14';
const RELEASE_NAME = 'Hatch v1.0.14';
const BODY = `### Release Notes: Hatch v1.0.14

**Summary**
This update stabilizes the template synchronization logic and ensures the "Social Media" default is strictly followed across all installations.

**Bug Fixes**
*   **Gist Sync Fix:** Updated Template Gist URL to point to the latest raw version, ensuring users always receive the most up-to-date folder structures.
*   **Initialization Logic:** Refined the logic for picking up default templates from local storage to prevent old defaults from overriding new organizational standards.
*   **UI Selection:** Fixed an issue where the project structure dropdown would sometimes display the incorrect template name during initial load.

*   **Atomic Defaults:** The app now prioritizes the 'isDefault' flag from the Gist, allowing for instant organization-wide default changes.

**Notes for Mac Installation**

Since Hatch is a specialized productivity tool distributed independently, macOS requires a one-time permission to run the "unidentified" binary:

1.  **The "Right-Click" Method (Recommended):**
    *   Download the appropriate version for your Mac: **Apple Silicon** (M1/M2/M3) or **Universal/Intel**.
    *   Drag the **Hatch** icon to your **Applications** folder.
    *   **Right-click** (or Control-click) the Hatch app in your Applications folder and select **Open**.
    *   Click **Open** on the security warning dialog. *You will only need to do this once.*

2.  **The Terminal Method (Bypass):**
    *   If you see a message saying the app "is damaged" or cannot be verified, open your Terminal and run:
    \`\`\`bash
    xattr -cr /Applications/Hatch.app
    \`\`\`
3. You can now open the app normally.`;

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

    const files = fs.readdirSync(releaseDir);

    // Define required patterns for platforms
    const requiredPlatforms = {
        'Mac (Apple Silicon)': `Hatch-${TAG.substring(1)}-arm64.dmg`,
        'Mac (Universal)': `Hatch-${TAG.substring(1)}-universal.dmg`,
        'Windows': `Hatch-Setup-${TAG.substring(1)}.exe`,
        'Linux': `Hatch-${TAG.substring(1)}-x86_64.AppImage`
    };

    console.log('Validating platform artifacts...');
    const missing = [];
    for (const [platform, fileName] of Object.entries(requiredPlatforms)) {
        if (!files.includes(fileName)) {
            missing.push(`${platform} (${fileName})`);
        } else {
            console.log(`✓ Found ${platform} artifact: ${fileName}`);
        }
    }

    if (missing.length > 0) {
        console.error('\n❌ ERROR: Missing required platform artifacts:');
        missing.forEach(m => console.error(`   - ${m}`));
        console.error('\nPlease ensure all builds are completed before running this script.');
        process.exit(1);
    }

    console.log('\nAll required platforms found. Proceeding with upload...');

    try {
        const release = await getOrCreateRelease();

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
