import play from 'play-dl';
async function test() {
    try {
        console.log("Fetching youtube via play-dl...");
        const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

        console.log("Starting stream...");
        const stream = await play.stream(url);

        const chunks = [];
        await new Promise((resolve, reject) => {
            stream.stream.on('data', c => chunks.push(c));
            stream.stream.on('end', () => resolve());
            stream.stream.on('error', reject);
        });

        const buffer = Buffer.concat(chunks);
        console.log("Stream successfully decoded! Total bytes:", buffer.length);
    } catch (e) {
        console.error("Play-dl Error: ", e.message);
    }
}
test();
