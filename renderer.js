
const { createFFmpeg, fetchFile } = FFmpeg;

const ffmpeg = createFFmpeg({
  log: true,
  corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
  mainName: 'main',
  MEMFS: 2048,
  workerPath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js'
});

async function renderVideo(options) {
  try {
    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    const { bgImageUrl, lyrics, audioBuffer, textAlign, textShadowEnabled, fontSize, textColor, fontUrl } = options;

    // Создаем канвас и рендерим видео как раньше
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

    // Конвертируем аудио в правильный формат
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    const audioData = new Uint8Array(await audioBlob.arrayBuffer());
    ffmpeg.FS('writeFile', 'audio.wav', audioData);

    // Записываем видео с канваса
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
    const webmData = new Uint8Array(await webmBlob.arrayBuffer());
    ffmpeg.FS('writeFile', 'input.webm', webmData);

    // Запускаем FFmpeg и получаем результат в память
    await ffmpeg.run(
      '-i', 'input.webm',
      '-i', 'audio.wav',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-strict', 'experimental',
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov',
      '-'
    );

    // Получаем результат из памяти
    const output = ffmpeg.FS('readFile', '-');
    return new Blob([output.buffer], { type: 'video/mp4' });

  } catch (error) {
    console.error('Ошибка при создании видео:', error);
    throw new Error(`Не удалось создать видео: ${error.message}`);
  }
}

// Остальные функции остаются без изменений
async function loadImage(url) {
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