document.addEventListener('DOMContentLoaded', async function() {
    // Добавим статус загрузки в интерфейс
    const statusElement = document.createElement('div');
    statusElement.id = 'ffmpeg-status';
    statusElement.style.padding = '10px';
    statusElement.style.backgroundColor = '#f8f9fa';
    statusElement.style.borderRadius = '4px';
    statusElement.style.marginBottom = '10px';
    statusElement.textContent = 'Загрузка FFmpeg...';
    document.querySelector('.editor-panel').prepend(statusElement);

    // Элементы интерфейса
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const fontFileInput = document.getElementById('font-file');
    const fontFileInfo = document.getElementById('font-file-info');
    const backgroundImageInput = document.getElementById('background-image');
    const backgroundImageInfo = document.getElementById('background-image-info');
    const audioFileInput = document.getElementById('audio-file');
    const audioFileInfo = document.getElementById('audio-file-info');
    const lyricsText = document.getElementById('lyrics-text');
    const textColor = document.getElementById('text-color');
    const textColorValue = document.getElementById('text-color-value');
    const textSize = document.getElementById('text-size');
    const textSizeValue = document.getElementById('text-size-value');
    const textPosition = document.getElementById('text-position');
    const textPositionValue = document.getElementById('text-position-value');
    const downloadBtn = document.getElementById('download-btn');
    const playBtn = document.getElementById('play-btn');
    const stopBtn = document.getElementById('stop-btn');
    const previewBackground = document.getElementById('preview-background');
    const previewText = document.getElementById('preview-text');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    // Переменные состояния
    let audioContext;
    let audioBuffer;
    let audioSource;
    let isPlaying = false;
    let startTime;
    let lyrics = [];
    let animationFrameId;
    let backgroundImageUrl = '';
    let audioFileUrl = '';
    let fontName = 'sans-serif';
    let ffmpeg = null;
    let ffmpegLoaded = false;

    try {
        // Ждем загрузки FFmpeg
        await window.ffmpegLoading;
        statusElement.textContent = 'FFmpeg успешно загружен!';
        statusElement.style.color = 'green';
        
        // Теперь можно безопасно использовать window.ffmpeg
        ffmpeg = window.ffmpeg;
        ffmpegLoaded = true;
        
        // Через 3 секунды скрываем статус
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    } catch (error) {
        console.error('Ошибка загрузки FFmpeg:', error);
        statusElement.textContent = 'Ошибка загрузки FFmpeg!';
        statusElement.style.color = 'red';
        return;
    }

    // Переключение табов
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        });
    });

    // Загрузка фонового изображения
    backgroundImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            backgroundImageInfo.textContent = file.name;
            backgroundImageUrl = URL.createObjectURL(file);
            previewBackground.src = backgroundImageUrl;
        }
    });

    // Загрузка шрифта
    fontFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            fontFileInfo.textContent = file.name;
            const fontUrl = URL.createObjectURL(file);
            fontName = file.name.replace(/\.[^/.]+$/, "");

            const fontFace = new FontFace(fontName, `url(${fontUrl})`);
            fontFace.load().then((loadedFace) => {
                document.fonts.add(loadedFace);
                previewText.style.fontFamily = `'${fontName}', sans-serif`;
            }).catch(error => {
                console.error('Ошибка загрузки шрифта:', error);
                alert('Ошибка загрузки шрифта');
            });
        }
    });

    // Загрузка аудио файла
    audioFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            audioFileInfo.textContent = file.name;
            audioFileUrl = URL.createObjectURL(file);
            loadAudioFile(audioFileUrl);
        }
    });

    // Настройки текста
    textColor.addEventListener('input', function() {
        const color = this.value;
        const colorName = getColorName(color);
        textColorValue.textContent = `${colorName} (${color.toUpperCase()})`;
        previewText.style.color = color;
    });

    textSize.addEventListener('input', function() {
        const size = this.value;
        textSizeValue.textContent = size;
        previewText.style.fontSize = `${size}px`;
    });

    textPosition.addEventListener('input', function() {
        const position = this.value;
        textPositionValue.textContent = position;
        previewText.style.bottom = `${position}%`;
    });

    // Воспроизведение предпросмотра
    playBtn.addEventListener('click', startPreview);
    stopBtn.addEventListener('click', stopPreview);

    // Скачивание видео
    downloadBtn.addEventListener('click', async function() {
        if (!window.ffmpeg || !ffmpegLoaded) {
            alert('FFmpeg еще не загружен. Подождите несколько секунд...');
            return;
        }

        if (!backgroundImageInput.files[0]) {
            alert('Пожалуйста, выберите фоновое изображение');
            return;
        }

        if (!audioFileInput.files[0]) {
            alert('Пожалуйста, выберите аудио файл');
            return;
        }

        if (!lyricsText.value.trim()) {
            alert('Пожалуйста, добавьте текст с таймкодами');
            return;
        }

        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Генерация видео...';

        try {
            await generateVideo();
        } catch (error) {
            console.error('Ошибка генерации видео:', error);
            alert('Ошибка генерации видео. Проверьте консоль для подробностей.');
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Скачать видео';
        }
    });

    // Функции
    function loadAudioFile(url) {
        if (audioContext) {
            audioContext.close();
        }

        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        fetch(url)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
            .then(buffer => {
                audioBuffer = buffer;
            })
            .catch(error => {
                console.error('Ошибка загрузки аудио:', error);
                alert('Ошибка загрузки аудио файла');
            });
    }

    function parseLyrics(text) {
        const lines = text.split('\n');
        const result = [];

        for (const line of lines) {
            const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2})\](.*)$/);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const hundredths = parseInt(match[3]);
                const text = match[4].trim();

                const time = minutes * 60 + seconds + hundredths / 100;
                result.push({ time, text });
            }
        }

        return result;
    }

    function startPreview() {
        if (isPlaying) return;

        lyrics = parseLyrics(lyricsText.value);
        if (lyrics.length === 0) {
            alert('Добавьте текст с таймкодами для предпросмотра');
            return;
        }

        if (!audioBuffer) {
            alert('Добавьте аудио файл для предпросмотра');
            return;
        }

        isPlaying = true;
        startTime = audioContext.currentTime;

        audioSource = audioContext.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(audioContext.destination);
        audioSource.start();

        updateLyrics();

        audioSource.onended = function() {
            stopPreview();
        };
    }

    function stopPreview() {
        if (!isPlaying) return;

        isPlaying = false;
        if (audioSource) {
            audioSource.stop();
            audioSource = null;
        }

        cancelAnimationFrame(animationFrameId);
        previewText.classList.remove('active');
        previewText.textContent = '';
    }

    function updateLyrics() {
        if (!isPlaying) return;

        const currentTime = audioContext.currentTime - startTime;
        let currentText = '';
        let nextText = '';

        // Находим текущий и следующий текст
        for (let i = 0; i < lyrics.length; i++) {
            if (lyrics[i].time <= currentTime) {
                currentText = lyrics[i].text;

                if (i < lyrics.length - 1) {
                    nextText = lyrics[i+1].text;
                }
            } else {
                break;
            }
        }

        // Обновляем отображение текста
        if (currentText) {
            previewText.textContent = currentText;
            previewText.classList.add('active');
        } else {
            previewText.classList.remove('active');
        }

        animationFrameId = requestAnimationFrame(updateLyrics);
    }

    function getColorName(hex) {
        const colors = {
            '#FFFFFF': 'Белый',
            '#000000': 'Чёрный',
            '#FF0000': 'Красный',
            '#00FF00': 'Зелёный',
            '#0000FF': 'Синий',
            '#FFFF00': 'Жёлтый',
            '#FF00FF': 'Пурпурный',
            '#00FFFF': 'Бирюзовый'
        };

        return colors[hex.toUpperCase()] || hex;
    }

    async function generateVideo() {
        // Разрешение 720x1280 (9:16)
        const width = 720;
        const height = 1280;
        const frameRate = 60;

        // Создаем canvas для рендеринга кадров
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Показываем прогрессбар
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';

        // Загружаем фоновое изображение
        const bgImg = await loadImage(backgroundImageInput.files[0]);

        // Параметры текста
        const textColorValue = document.getElementById('text-color').value;
        const textSizeValue = document.getElementById('text-size').value;
        const textPositionValue = document.getElementById('text-position').value;

        // Разбираем текст с таймкодами
        const lyrics = parseLyrics(lyricsText.value);

        // Получаем длину аудио
        const audioDuration = audioBuffer.duration;

        // Количество кадров (60 кадров в секунду)
        const frameCount = Math.ceil(audioDuration * frameRate);

        // Создаем массив для хранения кадров
        const frames = [];

        // Генерируем кадры с прогрессом
        for (let i = 0; i < frameCount; i++) {
            const time = i / frameRate;

            // Обновляем прогресс
            const progress = Math.floor((i / frameCount) * 100);
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;

            // Даем браузеру возможность обновить UI
            if (i % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0));

            // Очищаем canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Рисуем фон с масштабированием и центрированием
            const imgRatio = bgImg.width / bgImg.height;
            const targetRatio = width / height;

            let drawWidth, drawHeight, offsetX, offsetY;

            if (imgRatio > targetRatio) {
                drawHeight = height;
                drawWidth = bgImg.width * (height / bgImg.height);
                offsetX = (width - drawWidth) / 2;
                offsetY = 0;
            } else {
                drawWidth = width;
                drawHeight = bgImg.height * (width / bgImg.width);
                offsetX = 0;
                offsetY = (height - drawHeight) / 2;
            }

            ctx.drawImage(bgImg, offsetX, offsetY, drawWidth, drawHeight);

            // Находим текст для текущего времени
            let currentText = '';
            for (const line of lyrics) {
                if (line.time <= time) {
                    currentText = line.text;
                } else {
                    break;
                }
            }

            // Рисуем текст, если он есть
            if (currentText) {
                ctx.fillStyle = textColorValue;
                ctx.font = `${textSizeValue}px '${fontName}'`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                const yPos = height - (height * (textPositionValue / 100));
                const xPos = width / 2;

                // Разбиваем текст на строки, если есть переносы
                const lines = currentText.split('\n');
                const lineHeight = parseInt(textSizeValue) * 1.2;

                for (let j = 0; j < lines.length; j++) {
                    ctx.fillText(lines[j], xPos, yPos - (lines.length - j - 1) * lineHeight);
                }
            }

            // Добавляем кадр в массив
            frames.push(canvas.toDataURL('image/jpeg'));
        }

        // Финальное обновление прогресса
        progressBar.style.width = '100%';
        progressText.textContent = '100%';

        // Конвертируем кадры в видео с помощью FFmpeg
        await createVideoFromFrames(frames, audioFileInput.files[0], frameRate);

        // Скрываем прогрессбар после завершения
        progressContainer.style.display = 'none';
    }

    async function createVideoFromFrames(frames, audioFile, frameRate) {
        // Показываем прогресс конвертации
        progressText.textContent = 'Обработка FFmpeg...';

        // Создаем временный файл для аудио
        const audioData = await readFileAsArrayBuffer(audioFile);
        ffmpeg.FS('writeFile', 'audio.mp3', new Uint8Array(audioData));

        // Записываем кадры с прогрессом
        const batchSize = 100; // Записываем кадры пачками по 100
        for (let i = 0; i < frames.length; i += batchSize) {
            const batchEnd = Math.min(i + batchSize, frames.length);
            for (let j = i; j < batchEnd; j++) {
                const frameData = await fetch(frames[j]).then(res => res.arrayBuffer());
                ffmpeg.FS('writeFile', `frame${j.toString().padStart(5, '0')}.jpg`, new Uint8Array(frameData));
            }

            // Обновляем прогресс
            const progress = Math.floor((batchEnd / frames.length) * 100);
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Создаем файл со списком кадров
        const frameList = Array.from({ length: frames.length }, (_, i) =>
            `file 'frame${i.toString().padStart(5, '0')}.jpg'\nduration ${1/frameRate}`
        ).join('\n');
        ffmpeg.FS('writeFile', 'frame_list.txt', new TextEncoder().encode(frameList));

        // Выполняем команды FFmpeg с высоким качеством
        await ffmpeg.run(
            '-f', 'concat',
            '-i', 'frame_list.txt',
            '-i', 'audio.mp3',
            '-r', frameRate.toString(),
            '-c:v', 'libx264',
            '-preset', 'slow',
            '-crf', '18',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-shortest',
            '-vf', 'scale=720:1280', // Явно указываем масштаб 720x1280
            'output.mp4'
        );

        // Получаем результат
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        // Создаем ссылку для скачивания
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generated-video.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Освобождаем память
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
});