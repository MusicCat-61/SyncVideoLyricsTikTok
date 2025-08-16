
const { createFFmpeg, fetchFile } = FFmpeg;
if (!crossOriginIsolated) {
  throw new Error('SharedArrayBuffer is not available. Enable cross-origin isolation.');
}
const ffmpeg = createFFmpeg({
  log: true,
  corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js' // ← core-st вместо core
});

async function renderVideo(options) {
  try {
    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    const { bgImageUrl, lyrics, audioBuffer, textAlign, textShadowEnabled, fontSize, textColor, fontUrl } = options;

    const canvas = document.createElement('canvas');
    canvas.width = 270;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    const bgImage = await loadImage(bgImageUrl);

    if (fontUrl) {
      const font = new FontFace('CustomFont', `url(${fontUrl})`);
      await font.load();
      document.fonts.add(font);
    }

    const audioBlob = await bufferToBlob(audioBuffer);
    ffmpeg.FS('writeFile', 'audio.wav', await fetchFile(audioBlob));

    const stream = canvas.captureStream();
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm',
      videoBitsPerSecond: 2500000
    });

    const videoChunks = [];
    mediaRecorder.ondataavailable = (e) => videoChunks.push(e.data);

    const renderPromise = new Promise((resolve) => {
      mediaRecorder.onstop = () => resolve(new Blob(videoChunks, { type: 'video/webm' }));
    });

    mediaRecorder.start();

    const audio = new Audio(URL.createObjectURL(audioBlob));
    audio.play();

    const startTime = Date.now();
    const duration = audioBuffer.duration * 1000;

    function renderFrame() {
      const currentTime = Date.now() - startTime;
      const currentTimeSec = currentTime / 1000;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

      ctx.textAlign = textAlign;
      ctx.fillStyle = textColor;
      ctx.font = `${fontSize}px ${fontUrl ? 'CustomFont' : 'sans-serif'}`;

      if (textShadowEnabled) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      let currentLine = null;
      for (let i = 0; i < lyrics.length; i++) {
        if (currentTimeSec >= lyrics[i].time) {
          currentLine = lyrics[i].text;
        } else {
          break;
        }
      }

      if (currentLine) {
        const x = textAlign === 'left' ? 20 :
                 textAlign === 'right' ? canvas.width - 20 :
                 canvas.width / 2;
        ctx.fillText(currentLine, x, canvas.height / 2);
      }

      if (currentTime < duration) {
        requestAnimationFrame(renderFrame);
      } else {
        mediaRecorder.stop();
        audio.pause();
      }
    }

    renderFrame();

    const webmBlob = await renderPromise;
    ffmpeg.FS('writeFile', 'input.webm', await fetchFile(webmBlob));

    await ffmpeg.run(
      '-i', 'input.webm',
      '-i', 'audio.wav',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-strict', 'experimental',
      '-pix_fmt', 'yuv420p',
      'output.mp4'
    );

    const data = ffmpeg.FS('readFile', 'output.mp4');
    return new Blob([data.buffer], { type: 'video/mp4' });

  } catch (error) {
    console.error('Ошибка рендеринга:', error);
    throw error;
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function bufferToBlob(buffer) {
  return new Blob([buffer], { type: 'audio/wav' });
}