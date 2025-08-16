// video-worker.js
let ffmpeg = null;
let isInitialized = false;

async function loadFFmpeg() {
    const { createFFmpeg } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');
    ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
    });
    await ffmpeg.load();
    return ffmpeg;
}

self.onmessage = async function(e) {
    console.log(`[Worker] Получено сообщение типа: ${e.data.type}`);

    try {
        switch (e.data.type) {
            case 'init':
                console.log('[Worker] Инициализация FFmpeg...');
                ffmpeg = await loadFFmpeg();
                isInitialized = true;
                self.postMessage({ type: 'ffmpeg_ready' });
                break;


            case 'start':
                console.log('[Worker] Получена команда start');

                if (!isInitialized || !ffmpeg) {
                    throw new Error('FFmpeg не инициализирован');
                }

                console.log('[Worker] FFmpeg готов, начинаю обработку видео...');
                const params = e.data.params;
                console.log('[Worker] Параметры:', {
                    width: params.width,
                    height: params.height,
                    frameRate: params.frameRate,
                    audioDuration: params.audioDuration
                });

                // Загружаем фоновое изображение
                console.log('[Worker] Загрузка фонового изображения...');
                const bgImg = await createImageBitmap(await (await fetch(params.bgImg)).blob());

                // Создаем canvas
                const canvas = new OffscreenCanvas(params.width, params.height);
                const ctx = canvas.getContext('2d');
                const frameCount = Math.ceil(params.audioDuration * params.frameRate);
                console.log(`[Worker] Всего кадров: ${frameCount}`);

                // Обработка кадров
                for (let i = 0; i < frameCount; i += 30) {
                    const batchEnd = Math.min(i + 30, frameCount);

                    for (let j = i; j < batchEnd; j++) {
                        const time = j / params.frameRate;
                        let currentText = '';

                        // Поиск текста для текущего времени
                        for (const line of params.lyrics) {
                            if (line.time <= time) {
                                currentText = line.text;
                            } else {
                                break;
                            }
                        }

                        // Рендеринг кадра
                        ctx.clearRect(0, 0, params.width, params.height);
                        ctx.drawImage(bgImg, 0, 0, params.width, params.height);

                        if (currentText) {
                            ctx.fillStyle = params.textColor;
                            ctx.font = `${params.textSize}px '${params.fontName}'`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                            ctx.shadowBlur = 3;
                            ctx.shadowOffsetX = 1;
                            ctx.shadowOffsetY = 1;

                            const yPos = params.height - (params.height * (params.textPosition / 100));
                            const lines = currentText.split('\n');
                            const lineHeight = parseInt(params.textSize) * 1.2;

                            for (let k = 0; k < lines.length; k++) {
                                ctx.fillText(
                                    lines[k],
                                    params.width / 2,
                                    yPos - (lines.length - k - 1) * lineHeight
                                );
                            }
                        }

                        // Сохранение кадра
                        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
                        const arrayBuffer = await blob.arrayBuffer();
                        ffmpeg.FS('writeFile', `frame${j.toString().padStart(5, '0')}.jpg`, new Uint8Array(arrayBuffer));
                    }

                    // Отправка прогресса
                    const progress = Math.floor((batchEnd / frameCount) * 100);
                    self.postMessage({ type: 'progress', progress });
                    console.log(`[Worker] Прогресс: ${progress}%`);
                }

                // Запись аудио
                console.log('[Worker] Запись аудио...');
                ffmpeg.FS('writeFile', 'audio.mp3', new Uint8Array(params.audioData));

                // Создание видео
                console.log('[Worker] Создание видео...');
                await ffmpeg.run(
                    '-f', 'image2',
                    '-i', 'frame%05d.jpg',
                    '-i', 'audio.mp3',
                    '-r', params.frameRate.toString(),
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '20',
                    '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-shortest',
                    'output.mp4'
                );

                // Получение результата
                console.log('[Worker] Видео создано, отправка результата...');
                const data = ffmpeg.FS('readFile', 'output.mp4');
                const blob = new Blob([data.buffer], { type: 'video/mp4' });
                self.postMessage({ type: 'complete', blob });
                break;

            default:
                console.warn(`Неизвестный тип сообщения: ${e.data.type}`);
        }
    } catch (error) {
        console.error('[Worker] Ошибка:', error);
        self.postMessage({
            type: 'error',
            error: error.message
        });
    }
};

console.log('[Worker] Воркер загружен и готов к работе');