import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

let ffmpeg = null;

export const getFFmpeg = async (onProgress) => {
    if (ffmpeg && ffmpeg.loaded) return ffmpeg;
    ffmpeg = new FFmpeg();

    if (onProgress) {
        ffmpeg.on('progress', ({ progress }) => {
            onProgress(Math.round(progress * 100));
        });
    }

    try {
        await ffmpeg.load({
            coreURL,
            wasmURL,
        });
    } catch (e) {
        ffmpeg = null;
        throw e;
    }

    return ffmpeg;
};

export const extractAudioFromVideo = async (videoFile, onProgress) => {
    const ff = await getFFmpeg(onProgress);
    await ff.writeFile('input.mp4', await fetchFile(videoFile));

    // Extract audio to a temporary WAV file
    await ff.exec(['-i', 'input.mp4', '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', 'extracted.wav']);
    const audioData = await ff.readFile('extracted.wav');

    // delete extracted.wav to save RAM
    await ff.deleteFile('extracted.wav');
    await ff.deleteFile('input.mp4');

    return new Blob([audioData], { type: 'audio/wav' });
};

export const convertWavToMp3 = async (wavBlob, onProgress) => {
    const ff = await getFFmpeg(onProgress);
    await ff.writeFile('input.wav', await fetchFile(wavBlob));

    // Convert WAV to MP3 (VBR highest quality ~ 192kbps - 320kbps equivalent)
    await ff.exec(['-i', 'input.wav', '-codec:a', 'libmp3lame', '-qscale:a', '2', 'output.mp3']);

    const mp3Data = await ff.readFile('output.mp3');

    // cleanup
    await ff.deleteFile('input.wav');
    await ff.deleteFile('output.mp3');

    return new Blob([mp3Data], { type: 'audio/mp3' });
};

export const muxAudioToVideo = async (videoFile, audioBlob, onProgress) => {
    const ff = await getFFmpeg(onProgress);
    // write files to virtual fs
    await ff.writeFile('input.mp4', await fetchFile(videoFile));
    await ff.writeFile('processed_audio.wav', await fetchFile(audioBlob));

    // Mux: use input.mp4 for video, processed_audio.wav for audio
    // Copy video codec to avoid re-encoding video. Encode audio to aac for mp4.
    await ff.exec(['-i', 'input.mp4', '-i', 'processed_audio.wav', '-c:v', 'copy', '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0', '-shortest', 'output.mp4']);

    const outputData = await ff.readFile('output.mp4');

    // cleanup
    await ff.deleteFile('input.mp4');
    await ff.deleteFile('processed_audio.wav');
    await ff.deleteFile('output.mp4');

    return new Blob([outputData], { type: 'video/mp4' });
};
