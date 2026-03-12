import youtubedl from 'youtube-dl-exec';

async function test() {
    try {
        const url = 'https://music.youtube.com/watch?v=pG9kNEbCmnA&list=PLpdVaQbu1Rb19yoM9cwGdjfH5S_pAtrJj';

        let cleanUrl = url;
        const parsed = new URL(url);
        if (parsed.hostname.includes('youtube.com')) {
            const v = parsed.searchParams.get('v');
            if (v) cleanUrl = `https://www.youtube.com/watch?v=${v}`;
        } else if (parsed.hostname.includes('youtu.be')) {
            cleanUrl = `https://youtu.be${parsed.pathname}`;
        }

        console.log("CLEAN URL:", cleanUrl);

        await youtubedl(cleanUrl, {
            extractAudio: true,
            audioFormat: 'mp3',
            output: 'test1234.mp3',
            noPlaylist: true
        });
        console.log("Success!");
    } catch (e) {
        console.error("DEBUG ERROR:", e.message);
    }
}
test();
