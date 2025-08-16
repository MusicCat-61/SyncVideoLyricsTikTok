// Обновляем версии библиотек
const FFMPEG_VERSION = '0.11.6';
const CORE_VERSION = '0.11.0';

const ffmpegLoading = new Promise(async (resolve, reject) => {
    try {
        // Проверяем, что FFmpeg загружен
        if (!window.FFmpeg) {
            throw new Error('FFmpeg не загружен');
        }

        const { createFFmpeg } = window.FFmpeg;
        const ffmpeg = createFFmpeg({
            log: false,
            corePath: `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/ffmpeg-core.js`
        });

        await ffmpeg.load();

        window.ffmpeg = {
            FS: ffmpeg.FS.bind(ffmpeg),
            run: ffmpeg.run.bind(ffmpeg),
            isLoaded: () => true
        };

        resolve();
    } catch (error) {
        console.error('Ошибка загрузки FFmpeg:', error);
        reject(error);
    }
});

window.ffmpegLoading = ffmpegLoading;

document.addEventListener('DOMContentLoaded', async function() {
    // Добавим статус загрузки в интерфейс
    const statusElement = document.createElement('div');
    statusElement.id = 'ffmpeg-status';
    statusElement.style.padding = '10px';
    statusElement.style.backgroundColor = '#f8f9fa';
    statusElement.style.borderRadius = '4px';
    statusElement.style.marginBottom = '10px';
    statusElement.textContent = 'Загружается FFmpeg...';
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
    const progressText1 = document.getElementById('progress-text1');

    previewText.style.color = textColor.value;
    previewText.style.fontSize = `${textSize.value}px`;
    previewText.style.bottom = `${textPosition.value}%`;

    const strokeColor = document.getElementById('stroke-color');
    const strokeColorValue = document.getElementById('stroke-color-value');
    const strokeSize = document.getElementById('stroke-size');
    const strokeSizeValue = document.getElementById('stroke-size-value');
    const previewTimeline = document.getElementById('preview-timeline');
    const currentTimeDisplay = document.getElementById('current-time');
    const totalTimeDisplay = document.getElementById('total-time');

    // Инициализация стилей обводки
    previewText.style.textShadow = `${strokeSize.value}px ${strokeSize.value}px ${strokeSize.value}px ${strokeColor.value}`;




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

    // Генерация случайного имени файла
    function generateRandomFilename(audioFile) {
        const trackName = audioFile.name.replace(/\.[^/.]+$/, ""); // Удаляем расширение
        const randomDigits = Math.floor(10000000 + Math.random() * 90000000); // 8 случайных цифр
        return `video_${trackName}_${randomDigits}.mp4`;
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

    strokeColor.addEventListener('input', function() {
        const color = this.value;
        const colorName = getColorName(color);
        strokeColorValue.textContent = `${colorName} (${color.toUpperCase()})`;
        updateTextStroke();
    });

    strokeSize.addEventListener('input', function() {
        strokeSizeValue.textContent = this.value;
        updateTextStroke();
    });

    function updateTextStroke() {
        previewText.style.textShadow = `${strokeSize.value}px ${strokeSize.value}px ${strokeSize.value}px ${strokeColor.value}`;
    }

    // Обработчик для ползунка предпросмотра
    previewTimeline.addEventListener('input', function() {
        if (audioBuffer && !isPlaying) {
            const seekTime = (this.value / 100) * audioBuffer.duration;
            currentTimeDisplay.textContent = formatTime(seekTime);
        }
    });

    previewTimeline.addEventListener('change', function() {
        if (audioBuffer && isPlaying) {
            stopPreview();
            startTime = audioContext.currentTime - (this.value / 100) * audioBuffer.duration;
            startPreview();
        }
    });

    // Функция форматирования времени
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

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
        if (!ffmpegLoaded) {
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
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        progressText1.textContent = "Не переключайте вкладку. Это ограничение фреймворка."

        try {
            console.log('[Main] Начало процесса генерации');

            // Подготавливаем параметры
            const bgImg = await loadImage(backgroundImageInput.files[0]);
            const audioData = await readFileAsArrayBuffer(audioFileInput.files[0]);
            const lyrics = parseLyrics(lyricsText.value);
            const filename = generateRandomFilename(audioFileInput.files[0]);

            const params = {
                bgImg: await getImageData(bgImg),
                audioData: audioData,
                lyrics: lyrics,
                audioDuration: audioBuffer.duration,
                textColor: textColor.value,
                strokeColor: strokeColor.value,
                strokeSize: strokeSize.value,
                textSize: textSize.value,
                textPosition: textPosition.value,
                fontName: fontName,
                width: 720,
                height: 1280,
                frameRate: 24,
                filename: filename
            };

            // Запускаем генерацию видео
            await generateVideo(params);

        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка генерации видео: ' + error.message);
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Скачать видео';
        }
    });

    // Функция генерации видео
    async function generateVideo(params) {
        try {
            updateProgress(0, 'Подготовка данных...');

            const bgImg = await createImage(params.bgImg);
            const canvas = document.createElement('canvas');
            canvas.width = params.width;
            canvas.height = params.height;
            const ctx = canvas.getContext('2d');
            const frameCount = Math.ceil(params.audioDuration * params.frameRate);

            // Очистка предыдущих файлов
            try {
                ffmpeg.FS('unlink', 'audio.mp3');
                for (let i = 0; i < frameCount; i++) {
                    const filename = `frame${i.toString().padStart(5, '0')}.jpg`;
                    try { ffmpeg.FS('unlink', filename); } catch {}
                }
            } catch (e) {}

            updateProgress(10, 'Генерация кадров... (0%)');
            const framesProgressStep = 70;

            // Асинхронная генерация кадров с возможностью обновления UI
            const batchSize = 10; // Размер пакета кадров
            for (let i = 0; i < frameCount; i += batchSize) {
                await processFrameBatch(i, Math.min(i + batchSize, frameCount));
                await new Promise(resolve => setTimeout(resolve, 0)); // Освобождаем поток
            }

            async function processFrameBatch(start, end) {
                for (let j = start; j < end; j++) {
                    const exactTime = (j * params.audioDuration) / frameCount;
                    let currentText = getCurrentLyric(params.lyrics, exactTime);

                    ctx.clearRect(0, 0, params.width, params.height);
                    ctx.drawImage(bgImg, 0, 0, params.width, params.height);

                    if (currentText) {
                        renderText(ctx, currentText, params);
                    }

                    const blob = await new Promise(resolve =>
                        canvas.toBlob(resolve, 'image/jpeg', 0.9)
                    );
                    const arrayBuffer = await blob.arrayBuffer();
                    ffmpeg.FS('writeFile', `frame${j.toString().padStart(5, '0')}.jpg`,
                        new Uint8Array(arrayBuffer));
                }

                const framesProgress = Math.floor((end / frameCount) * framesProgressStep);
                updateProgress(10 + framesProgress, `Генерация кадров... (${Math.floor((end / frameCount) * 100)}%)`);
            }

            // Этап 2: Запись аудио
            updateProgress(85, 'Загрузка аудио...');
            ffmpeg.FS('writeFile', 'audio.mp3', new Uint8Array(params.audioData));

            // Этап 3: Создание видео
            updateProgress(90, 'Создание видео... (это может занять несколько минут, зависит от мощности устройства)');
            await ffmpeg.run(
                '-f', 'image2',
                '-i', 'frame%05d.jpg',
                '-i', 'audio.mp3',
                '-r', params.frameRate.toString(),
                '-c:v', 'libx264',
                '-preset', 'fast', // Быстрее, чем 'fast'
                '-crf', '23', // Немного лучше качество
                '-vsync', 'cfr', // Переменный FPS для точности
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-shortest',
                'output.mp4'
            );

            // Этап 4: Подготовка к скачиванию
            updateProgress(95, 'Подготовка видео...');
            const data = ffmpeg.FS('readFile', 'output.mp4');
            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = params.filename;
            document.body.appendChild(a);
            a.click();

            // Завершение
            updateProgress(100, 'Готово!');

            // Очистка
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = '<i class="fas fa-download"></i> Скачать видео';
            }, 100);

        } catch (error) {
            console.error('[Main] Ошибка генерации видео:', error);
            updateProgress(0, `Ошибка: ${error.message}`);
            throw error;
        }
    }

    function updateProgress(percent, message) {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${percent}%`;

        // Добавим элемент для отображения сообщения
        if (!document.getElementById('progress-message')) {
            const messageElement = document.createElement('div');
            messageElement.id = 'progress-message';
            messageElement.style.marginTop = '5px';
            messageElement.style.fontSize = '0.9em';
            messageElement.style.color = '#666';
            progressContainer.appendChild(messageElement);
        }

        document.getElementById('progress-message').textContent = message;
    }

    // Вспомогательные функции
    async function createImage(dataUrl) {
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = dataUrl;
        });
        return img;
    }

    function getCurrentLyric(lyrics, time) {
        // Добавляем поиск следующего текста для плавного перехода
        for (let i = 0; i < lyrics.length; i++) {
            const nextTime = i < lyrics.length - 1 ? lyrics[i+1].time : Infinity;
            if (time >= lyrics[i].time && time < nextTime) {
                return lyrics[i].text;
            }
        }
        return '';
    }


    function wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + ' ' + word).width;
            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }


    function renderText(ctx, text, params) {

        const scale = window.devicePixelRatio || 1; // Масштаб для HiDPI-экранов
        ctx.scale(scale, scale); // Применяем масштаб

        ctx.fillStyle = params.textColor;
        ctx.font = `${params.textSize * scale}px '${params.fontName}'`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // Вычисляем позицию и параметры текста
        const yPos = params.height - (params.height * (params.textPosition / 100));
        const lines = wrapText(ctx, text, params.width * 0.9); // Перенос текста
        const lineHeight = parseInt(params.textSize) * 1.2;

        for (let k = 0; k < lines.length; k++) {
            // Обводка
            ctx.strokeStyle = params.strokeColor || '#000000';
            ctx.lineWidth = params.strokeSize || 2;
            ctx.strokeText(
                lines[k],
                params.width / 2 / scale, // Учитываем масштаб
                yPos - (lines.length - k - 1) * lineHeight
            );

            // Основной текст
            ctx.fillText(
                lines[k],
                params.width / 2 / scale, // Учитываем масштаб
                yPos - (lines.length - k - 1) * lineHeight
            );

        }
    }

    // Остальные функции остаются без изменений
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
        startTime = audioContext.currentTime - (previewTimeline.value / 100) * audioBuffer.duration;

        audioSource = audioContext.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(audioContext.destination);
        audioSource.start(0, (previewTimeline.value / 100) * audioBuffer.duration);

        // Установите общее время
        totalTimeDisplay.textContent = formatTime(audioBuffer.duration);

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

        if (audioBuffer) {
            currentTimeDisplay.textContent = formatTime((previewTimeline.value / 100) * audioBuffer.duration);
        }
    }


    function updateLyrics() {
        if (!isPlaying) return;

        const currentTime = audioContext.currentTime - startTime;
        const progress = (currentTime / audioBuffer.duration) * 100;
        previewTimeline.value = progress;
        currentTimeDisplay.textContent = formatTime(currentTime);

        let currentText = '';
        let nextText = '';

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

    function getImageData(img) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg'));
        });
    }
});