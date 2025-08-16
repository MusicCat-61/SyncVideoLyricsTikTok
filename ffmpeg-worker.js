// ffmpeg-worker.js
const { createFFmpeg } = FFmpeg;
const ffmpeg = createFFmpeg({
  log: true,
  corePath: '/ffmpeg-core.js',
  workerPath: '/ffmpeg-core.worker.js'
});

self.onmessage = async function(e) {
  if (e.data.type === 'process') {
    try {
      if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
      }

      const { webmData, audioData } = e.data.data;

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