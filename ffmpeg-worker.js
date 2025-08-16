
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({
  log: true,
  corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
  mainName: 'main',
  MEMFS: 2048
});

let isLoaded = false;

async function loadFFmpeg() {
  if (!isLoaded) {
    await ffmpeg.load();
    isLoaded = true;
  }
}

self.onmessage = async (e) => {
  if (e.data.type === 'init') {
    // Создаем FFmpeg после инициализации
    const { FFmpeg } = e.data;
    const { createFFmpeg } = FFmpeg;

    const ffmpeg = createFFmpeg({
      log: true,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      mainName: 'main',
      MEMFS: 2048
    });

    let isLoaded = false;

    async function loadFFmpeg() {
      if (!isLoaded) {
        await ffmpeg.load();
        isLoaded = true;
      }
    }

    self.onmessage = async (e) => {
      const { type, data } = e.data;

      if (type === 'process') {
        try {
          await loadFFmpeg();
          const { webmData, audioData } = data;

          ffmpeg.FS('writeFile', 'input.webm', new Uint8Array(webmData));
          ffmpeg.FS('writeFile', 'audio.wav', new Uint8Array(audioData));

          ffmpeg.setProgress(({ ratio }) => {
            self.postMessage({ type: 'progress', progress: ratio });
          });

          await ffmpeg.run(
            '-i', 'input.webm',
            '-i', 'audio.wav',
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-strict', 'experimental',
            '-f', 'mp4',
            '-movflags', 'frag_keyframe+empty_moov',
            'output.mp4'
          );

          const output = ffmpeg.FS('readFile', 'output.mp4');
          self.postMessage({
            type: 'result',
            result: output.buffer
          }, [output.buffer]);

        } catch (error) {
          self.postMessage({
            type: 'error',
            error: error.message
          });
        }
      }
    };

    self.postMessage({ type: 'ready' });
  }
};