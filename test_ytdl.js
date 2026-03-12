import youtubedl from 'youtube-dl-exec';
import fs from 'fs';

async function test() {
    console.log("Downloading via youtube-dl-exec...");
    try {
        await youtubedl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
            extractAudio: true,
            audioFormat: 'mp3',
            output: 'test_download.mp3'
        });
        console.log("Success!");
    } catch (e) {
        console.error(e);
    }
}
test();
