// ffmpeg-worker.js
importScripts('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');

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
  const { type, data } = e.data;

  if (type === 'process') {
    try {
      await loadFFmpeg();

      const { webmData, audioData } = data;

      // Записываем файлы в виртуальную файловую систему
      ffmpeg.FS('writeFile', 'input.webm', new Uint8Array(webmData));
      ffmpeg.FS('writeFile', 'audio.wav', new Uint8Array(audioData));

      // Отправляем прогресс
      ffmpeg.setProgress(({ ratio }) => {
        self.postMessage({ type: 'progress', progress: ratio });
      });

      // Запускаем обработку
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

      // Читаем результат
      const output = ffmpeg.FS('readFile', 'output.mp4');

      // Отправляем результат
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