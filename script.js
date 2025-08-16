document.addEventListener('DOMContentLoaded', async function() {
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
    const playBtn = document.getElementById('play-btn');
    const stopBtn = document.getElementById('stop-btn');
    const previewBackground = document.getElementById('preview-background');
    const previewText = document.getElementById('preview-text');
    const strokeColor = document.getElementById('stroke-color');
    const strokeColorValue = document.getElementById('stroke-color-value');
    const strokeSize = document.getElementById('stroke-size');
    const strokeSizeValue = document.getElementById('stroke-size-value');
    const previewTimeline = document.getElementById('preview-timeline');
    const currentTimeDisplay = document.getElementById('current-time');
    const totalTimeDisplay = document.getElementById('total-time');
    const previewContainer = document.querySelector('.preview-container');

    // Добавляем кнопку полноэкранного режима
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'btn fullscreen-btn';
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    fullscreenBtn.title = 'Полноэкранный режим';
    document.querySelector('.preview-controls').prepend(fullscreenBtn);

    // Инициализация стилей
    previewText.style.color = textColor.value;
    previewText.style.fontSize = `${textSize.value}px`;
    previewText.style.bottom = `${textPosition.value}%`;
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
    let posX = 0;
    let posY = 0;
    let moveDirectionX = 0.1;
    let moveDirectionY = 0.1;

    // Функция для обновления состояния кнопок
    function updateButtonsState() {
        if (isPlaying) {
            playBtn.classList.add('disabled');
            stopBtn.classList.remove('disabled');
        } else {
            playBtn.classList.remove('disabled');
            stopBtn.classList.add('disabled');
        }
    }

    // Инициализация состояния кнопок
    updateButtonsState();

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
            previewBackground.style.transform = 'translate(0, 0)';
            posX = 0;
            posY = 0;
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

    // Полноэкранный режим
    fullscreenBtn.addEventListener('click', function() {
        if (previewContainer.requestFullscreen) {
            previewContainer.requestFullscreen();
        } else if (previewContainer.webkitRequestFullscreen) {
            previewContainer.webkitRequestFullscreen();
        } else if (previewContainer.msRequestFullscreen) {
            previewContainer.msRequestFullscreen();
        }
    });

    // Анимация фонового изображения
    function animateBackground() {
        if (!isPlaying) return;

        // Плавное перемещение по горизонтали и вертикали
        posX += moveDirectionX;
        posY += moveDirectionY;

        // Меняем направление при достижении границ
        if (posX > 5 || posX < -5) {
            moveDirectionX *= -1;
        }
        if (posY > 5 || posY < -5) {
            moveDirectionY *= -1;
        }

        previewBackground.style.transform = `translate(${posX}px, ${posY}px)`;
        animationFrameId = requestAnimationFrame(animateBackground);
    }

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
                totalTimeDisplay.textContent = formatTime(buffer.duration);
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
        updateButtonsState();
        startTime = audioContext.currentTime - (previewTimeline.value / 100) * audioBuffer.duration;

        audioSource = audioContext.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(audioContext.destination);
        audioSource.start(0, (previewTimeline.value / 100) * audioBuffer.duration);

        // Запуск анимации фона
        animateBackground();
        updateLyrics();

        audioSource.onended = function() {
            stopPreview();
        };
    }

    function stopPreview() {
        if (!isPlaying) return;

        isPlaying = false;
        updateButtonsState();

        if (audioSource) {
            audioSource.stop();
            audioSource = null;
        }

        cancelAnimationFrame(animationFrameId);
        previewText.classList.remove('active');
        previewText.textContent = '';
        previewBackground.style.transform = 'translate(0, 0)';
        posX = 0;
        posY = 0;

        // Сброс прогрессбара в начало
        previewTimeline.value = 0;
        if (audioBuffer) {
            currentTimeDisplay.textContent = formatTime(0);
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
});