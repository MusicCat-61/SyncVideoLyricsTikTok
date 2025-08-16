// ffmpeg-worker.js
let ffmpeg;

async function initializeFFmpeg() {
  if (!ffmpeg) {
    // Загружаем FFmpeg из файла
    const ffmpegScript = await fetch('/ffmpeg.min.js').then(r => r.text());
    new Function(ffmpegScript)(); // Исполняем загруженный скрипт

    const { createFFmpeg } = FFmpeg;
    ffmpeg = createFFmpeg({
      log: true,
      corePath: '/ffmpeg-core.js',
      mainName: 'main',
      MEMFS: 2048
    });

    await ffmpeg.load();
  }
}

self.onmessage = async function(e) {
  if (e.data.type === 'process') {
    try {
      await initializeFFmpeg();

      const { webmData, audioData } = e.data;
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