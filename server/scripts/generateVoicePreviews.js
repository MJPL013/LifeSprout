require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { PREVIEWS, getOrCreatePreview, getPreviewPath, PREVIEW_DIR } = require('../voicePreviewStore');

const CLIENT_PREVIEW_DIR = path.join(__dirname, '..', '..', 'client', 'public', 'voice-previews');

async function main() {
    fs.mkdirSync(PREVIEW_DIR, { recursive: true });
    fs.mkdirSync(CLIENT_PREVIEW_DIR, { recursive: true });

    const ids = Object.keys(PREVIEWS);
    console.log(`Generating ${ids.length} Deepgram voice preview files...`);

    for (const id of ids) {
        const serverPath = getPreviewPath(id);
        const clientPath = path.join(CLIENT_PREVIEW_DIR, `${id}.mp3`);
        if (fs.existsSync(serverPath)) fs.rmSync(serverPath, { force: true });

        const result = await getOrCreatePreview(id, { force: true });
        fs.copyFileSync(serverPath, clientPath);

        const size = fs.statSync(serverPath).size;
        console.log(`${id}: ${PREVIEWS[id].model} -> ${path.relative(process.cwd(), serverPath)} + ${path.relative(process.cwd(), clientPath)} (${size} bytes, cached=${result.cached})`);
    }

    console.log('Voice previews are ready.');
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
