const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'chasinghues/Hatch';
const TAG = 'v1.0.10';
const RELEASE_NAME = 'Hatch v1.0.10';
const BODY = `### Release Notes: Hatch v1.0.10

**Summary**
This release introduces a significant visual overhaul with a premium dark theme, new typography, and improved component polish. It also addresses several key bugs in the Ingest workflow and project management, alongside performance optimizations.

**Bug Fixes**
*   **Project Actions:** Fixed the "Open in Finder" issue where the button was unresponsive for certain project types.
*   **Ingest Interface:** Resolved layout inconsistencies in the Ingest Details "Structure" tab to ensure correct padding and alignment.
*   **Build Artifacts:** Fixed a critical issue where application icons were missing or rendering incorrectly in production builds.

**Feature Additions**
*   **Premium UI Overhaul:**
    *   **Dark Theme:** Implemented a unified, high-contrast dark theme across the entire application interface.
    *   **Typography:** Updated the application font to **Inter**, improving readability and modernizing the aesthetic.
    *   **Component Styling:** Refined borders, inputs, and checkbox scales for a cleaner, more professional look.
*   **Ingest Hub:** Introduced the \`IngestHub\` and improved directory structure visualization for better project import management.
*   **Optimization:** Reduced application bundle size for improved startup performance.

**Mac Installation Notes**

**Option 1: Standard Method (Click)**
1.  Download the \`Hatch-1.0.10-universal.dmg\` file.
2.  Double-click the \`.dmg\` file and drag **Hatch** to your **Applications** folder.
3.  **Right-click** (or Control-click) the Hatch app in your Applications folder and select **Open**.
4.  Click **Open** in the security dialog to bypass the check.

**Option 2: Terminal Method (Bypass Code Signing)**
If you prefer to completely remove the security quarantine attribute via the terminal (useful if the app is damaged or refuses to open), follow these steps:

1.  Drag **Hatch** to your **Applications** folder.
2.  Open **Terminal**.
3.  Run the following command:
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
