import youtubedl from 'youtube-dl-exec';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDownload() {
    console.log("Testing yt-dlp...");
    const url = "https://youtu.be/O9SCPsGBsKI";
    try {
        console.log("Fetching info...");
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
        });
        console.log("Info fetched successfully. Title:", info.title);

        const outPath = path.join(__dirname, 'test_output.mp3');
        console.log("Downloading audio...");
        await youtubedl(url, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: 0,
            output: outPath,
            noCheckCertificates: true,
            noWarnings: true,
        });
        console.log("Download complete:", outPath);
    } catch (e) {
        console.error("Download failed!");
        console.error(e.message || e);
    }
}

testDownload();
