import { createFFmpeg, fetchFile } from './ffmpeg.min.js';

// Создаем прогрессбар
function createProgressBar() {
  const progressContainer = document.createElement('div');
  progressContainer.style.position = 'fixed';
  progressContainer.style.top = '0';
  progressContainer.style.left = '0';
  progressContainer.style.width = '100%';
  progressContainer.style.height = '5px';
  progressContainer.style.backgroundColor = 'rgba(0,0,0,0.1)';
  progressContainer.style.zIndex = '1000';

  const progressBar = document.createElement('div');
  progressBar.style.height = '100%';
  progressBar.style.width = '0%';
  progressBar.style.backgroundColor = '#4CAF50';
  progressBar.style.transition = 'width 0.3s';

  progressContainer.appendChild(progressBar);
  document.body.appendChild(progressContainer);

  return {
    update: (progress) => {
      progressBar.style.width = `${progress * 100}%`;
    },
    remove: () => {
      document.body.removeChild(progressContainer);
    }
  };
}

async function renderVideo(options) {
  const progress = createProgressBar();

  try {
    const { bgImageUrl, lyrics, audioBuffer, textAlign, textShadowEnabled, fontSize, textColor, fontUrl } = options;

    // Создаем канвас и рендерим видео
    const canvas = document.createElement('canvas');
    canvas.width = 270;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    // Загружаем фоновое изображение
    const bgImage = await loadImage(bgImageUrl);

    // Загружаем шрифт если указан
    if (fontUrl) {
      const font = new FontFace('CustomFont', `url(${fontUrl})`);
      await font.load();
      document.fonts.add(font);
    }

    // Подготавливаем аудио
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    const audio = new Audio(URL.createObjectURL(audioBlob));

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

    // Ждем завершения записи видео
    const webmBlob = await renderPromise;

    // Создаем Web Worker для обработки FFmpeg
    return new Promise((resolve, reject) => {
      const worker = new Worker('ffmpeg-worker.js');

      worker.onmessage = (e) => {
        const { type, progress: workerProgress, result, error } = e.data;

        if (type === 'progress') {
          progress.update(workerProgress);
        } else if (type === 'result') {
          progress.remove();
          resolve(new Blob([result], { type: 'video/mp4' }));
          worker.terminate();
        } else if (type === 'error') {
          progress.remove();
          reject(new Error(error));
          worker.terminate();
        }
      };

      // Подготавливаем данные для передачи в Worker
      Promise.all([
        webmBlob.arrayBuffer(),
        audioBlob.arrayBuffer()
      ]).then(([webmData, audioData]) => {
        worker.postMessage({
          type: 'process',
          data: { webmData, audioData }
        }, [webmData, audioData]);
      });
    });

  } catch (error) {
    progress.remove();
    console.error('Ошибка при создании видео:', error);
    throw new Error(`Не удалось создать видео: ${error.message}`);
  }
}

// Вспомогательные функции
async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Экспортируем функции для использования в других модулях
export { renderVideo, loadImage };