let ffmpeg = null;

self.onmessage = async function(e) {
   if (e.data.type === 'init') {
        try {
            ffmpeg = e.data.ffmpeg;
            // Добавляем проверку загрузки
            if (!ffmpeg.isLoaded()) {
                await ffmpeg.load();
            }
            self.postMessage({ type: 'ready' });
        } catch (error) {
            self.postMessage({ type: 'error', error: 'Ошибка инициализации FFmpeg: ' + error.message });
        }
        return;
    }

    if (e.data.type === 'start') {
        try {
            if (!ffmpeg || !ffmpeg.isLoaded()) {
                self.postMessage({ type: 'error', error: 'FFmpeg не готов к работе' });
                return;
            }

            const params = e.data.params;
            const { width, height, frameRate } = params;

            if (!ffmpeg.isLoaded()) {
                await ffmpeg.load();
            }
            console.log('Получил FFmpeg в воркере', ffmpeg !== null);

            // Загружаем фоновое изображение
            const bgImg = await createImageBitmap(await (await fetch(params.bgImg)).blob());

            // Создаем canvas для рендеринга
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');

            const lyrics = params.lyrics;
            const audioDuration = params.audioDuration;
            const frameCount = Math.ceil(audioDuration * frameRate);
            const batchSize = 30; // Размер пачки кадров

            for (let i = 0; i < frameCount; i += batchSize) {
                const batchEnd = Math.min(i + batchSize, frameCount);

                for (let j = i; j < batchEnd; j++) {
                    const time = j / frameRate;
                    let currentText = '';

                    // Находим текст для текущего времени
                    for (const line of lyrics) {
                        if (line.time <= time) {
                            currentText = line.text;
                        } else {
                            break;
                        }
                    }

                    // Очищаем canvas
                    ctx.clearRect(0, 0, width, height);

                    // Рисуем фон
                    ctx.drawImage(bgImg, 0, 0, width, height);

                    // Рисуем текст, если есть
                    if (currentText) {
                        ctx.fillStyle = params.textColor;
                        ctx.font = `${params.textSize}px '${params.fontName}'`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                        ctx.shadowBlur = 3;
                        ctx.shadowOffsetX = 1;
                        ctx.shadowOffsetY = 1;

                        const yPos = height - (height * (params.textPosition / 100));
                        const xPos = width / 2;

                        const lines = currentText.split('\n');
                        const lineHeight = parseInt(params.textSize) * 1.2;

                        for (let k = 0; k < lines.length; k++) {
                            ctx.fillText(lines[k], xPos, yPos - (lines.length - k - 1) * lineHeight);
                        }
                    }

                    // Сохраняем кадр
                    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
                    const arrayBuffer = await blob.arrayBuffer();
                    ffmpeg.FS('writeFile', `frame${j.toString().padStart(5, '0')}.jpg`, new Uint8Array(arrayBuffer));
                }

                // Отправляем прогресс
                const progress = Math.floor((batchEnd / frameCount) * 100);
                self.postMessage({ type: 'progress', progress });
            }

            // Записываем аудио
            ffmpeg.FS('writeFile', 'audio.mp3', new Uint8Array(params.audioData));

            // Создаем видео
            await ffmpeg.run(
                '-f', 'image2',
                '-i', 'frame%05d.jpg',
                '-i', 'audio.mp3',
                '-r', frameRate.toString(),
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '20',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-shortest',
                'output.mp4'
            );

            // Получаем результат
            const data = ffmpeg.FS('readFile', 'output.mp4');
            const blob = new Blob([data.buffer], { type: 'video/mp4' });

            self.postMessage({ type: 'complete', blob });
        } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
        }
    }
};