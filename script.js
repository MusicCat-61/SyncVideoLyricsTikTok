const ffmpegLoading = new Promise(async (resolve) => {
    const { createFFmpeg } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');
    const ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
    });
    await ffmpeg.load();
    // Сохраняем только необходимые методы, а не весь объект
    window.ffmpeg = {
        FS: ffmpeg.FS.bind(ffmpeg),
        run: ffmpeg.run.bind(ffmpeg),
        isLoaded: () => true
    };
    resolve();
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
    let videoWorker = null;

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

    async function initWorker() {
        console.log('[Main] Инициализация воркера...');

        if (videoWorker) return videoWorker;

        videoWorker = new Worker('video-worker.js');

        return new Promise((resolve, reject) => {
            const messageHandler = function(e) {
                switch (e.data.type) {
                    case 'ffmpeg_ready':
                        console.log('[Main] FFmpeg успешно инициализирован в воркере');
                        videoWorker.removeEventListener('message', messageHandler);
                        resolve(videoWorker);
                        break;

                    case 'error':
                        console.error('[Main] Ошибка в воркере:', e.data.error);
                        videoWorker.removeEventListener('message', messageHandler);
                        reject(new Error(e.data.error));
                        break;

                    case 'progress':
                        progressBar.style.width = `${e.data.progress}%`;
                        progressText.textContent = `${e.data.progress}%`;
                        break;

                    case 'complete':
                        const blob = e.data.blob;
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'video.mp4';
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(() => {
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            downloadBtn.disabled = false;
                            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Скачать видео';
                        }, 100);
                        break;
                }
            };

            videoWorker.addEventListener('message', messageHandler);

            // Передаем уже загруженный FFmpeg в воркер
            videoWorker.postMessage({
                type: 'init',

            });
        });
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

        try {
            console.log('[Main] Начало процесса генерации');

            // Инициализация воркера
            await initWorker();
            console.log('[Main] Воркер и FFmpeg готовы');
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log('[Main] Подготавливаю параметры...');

            const bgImg = await loadImage(backgroundImageInput.files[0]);
            const audioData = await readFileAsArrayBuffer(audioFileInput.files[0]);
            const lyrics = parseLyrics(lyricsText.value);

            const params = {
                bgImg: await getImageData(bgImg),
                audioData: audioData,
                lyrics: lyrics,
                audioDuration: audioBuffer.duration,
                textColor: textColor.value,
                textSize: textSize.value,
                textPosition: textPosition.value,
                fontName: fontName,
                width: 720,
                height: 1280,
                frameRate: 60
            };

            console.log('[Main] Запускаю генерацию видео');
            videoWorker.postMessage({
                type: 'start',
                params: params
            });
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка инициализации: ' + error.message);
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