// Элементы интерфейса
const audioFileInput = document.getElementById('audio-file');
const audioBtn = document.getElementById('audio-btn');
const audioName = document.getElementById('audio-name');
const bgImageInput = document.getElementById('bg-image');
const bgBtn = document.getElementById('bg-btn');
const bgName = document.getElementById('bg-name');
const fontFileInput = document.getElementById('font-file');
const fontBtn = document.getElementById('font-btn');
const fontName = document.getElementById('font-name');
const lyricsInput = document.getElementById('lyrics-input');
const textColor = document.getElementById('text-color');
const colorPreview = document.getElementById('color-preview');
const fontSize = document.getElementById('font-size');
const fontSizeValue = document.getElementById('font-size-value');
const textShadow = document.getElementById('text-shadow');
const alignBtns = document.querySelectorAll('.align-btn');
const previewBtn = document.getElementById('preview-btn');
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const exportBtn = document.getElementById('export-btn');
const videoPreview = document.getElementById('video-preview');
const lyricsContainer = document.getElementById('lyrics-container');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

if (!crossOriginIsolated) {
  alert('Для работы экспорта видео требуется включить cross-origin isolation. Разместите эти файлы на веб-сервере или используйте локальный сервер для разработки.');
}


// Аудио элементы
let audioContext;
let audioBuffer;
let audioSource;
let isPlaying = false;
let startTime;
let lyrics = [];
let currentLyricIndex = 0;
let animationFrameId;
let bgImageUrl = '';
let fontUrl = '';

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Установка обработчиков событий
    audioBtn.addEventListener('click', () => audioFileInput.click());
    audioFileInput.addEventListener('change', handleAudioFile);

    bgBtn.addEventListener('click', () => bgImageInput.click());
    bgImageInput.addEventListener('change', handleBgImage);

    fontBtn.addEventListener('click', () => fontFileInput.click());
    fontFileInput.addEventListener('change', handleFontFile);

    textColor.addEventListener('input', updateTextStyle);
    fontSize.addEventListener('input', updateFontSize);
    textShadow.addEventListener('change', updateTextStyle);
    alignBtns.forEach(btn => btn.addEventListener('click', handleAlignBtn));

    previewBtn.addEventListener('click', previewVideo);
    playBtn.addEventListener('click', playAudio);
    pauseBtn.addEventListener('click', pauseAudio);
    exportBtn.addEventListener('click', exportVideo);

    // Табы
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Обновление предпросмотра цвета
    colorPreview.style.backgroundColor = textColor.value;
    textColor.addEventListener('input', () => {
        colorPreview.style.backgroundColor = textColor.value;
    });

    // Обновление размера шрифта
    fontSize.addEventListener('input', () => {
        fontSizeValue.textContent = fontSize.value;
        updateTextStyle();
    });
});

// Обработчики событий
function handleAudioFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    audioName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(e) {
        const audioData = e.target.result;

        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        audioContext.decodeAudioData(audioData.slice(0))
            .then(buffer => {
                audioBuffer = buffer;
                console.log('Аудио загружено');
            })
            .catch(err => {
                console.error('Ошибка загрузки аудио:', err);
                alert('Ошибка загрузки аудио файла');
            });
    };
    reader.readAsArrayBuffer(file);
}

function handleBgImage(e) {
    const file = e.target.files[0];
    if (!file) return;

    bgName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(e) {
        bgImageUrl = e.target.result;
        videoPreview.style.backgroundImage = `url(${bgImageUrl})`;
    };
    reader.readAsDataURL(file);
}

function handleFontFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    fontName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(e) {
        fontUrl = e.target.result;
        const font = new FontFace('CustomFont', `url(${fontUrl})`);
        font.load().then(loadedFont => {
            document.fonts.add(loadedFont);
            updateTextStyle();
        }).catch(err => {
            console.error('Ошибка загрузки шрифта:', err);
            alert('Ошибка загрузки шрифта');
        });
    };
    reader.readAsDataURL(file);
}

function handleAlignBtn(e) {
    const align = e.currentTarget.getAttribute('data-align');
    lyricsContainer.style.textAlign = align;

    alignBtns.forEach(btn => {
        btn.classList.remove('active-align');
    });

    e.currentTarget.classList.add('active-align');
}

function parseLyrics(text) {
    const lines = text.split('\n');
    const parsed = [];

    for (const line of lines) {
        if (!line.trim()) continue;

        const match = line.match(/^\[(\d+):(\d+)\.(\d+)\](.*)/);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const milliseconds = parseInt(match[3]);
            const text = match[4].trim();

            const time = minutes * 60 + seconds + milliseconds / 1000;
            parsed.push({ time, text });
        }
    }

    parsed.sort((a, b) => a.time - b.time);
    return parsed;
}

function previewVideo() {
    if (!audioBuffer) {
        alert('Пожалуйста, загрузите аудиофайл');
        return;
    }

    const lyricsText = lyricsInput.value;
    if (!lyricsText) {
        alert('Пожалуйста, введите текст песни с таймкодами');
        return;
    }

    lyrics = parseLyrics(lyricsText);
    if (lyrics.length === 0) {
        alert('Не удалось распознать текст с таймкодами. Проверьте формат.');
        return;
    }

    lyricsContainer.innerHTML = '';

    lyrics.forEach((lyric) => {
        const div = document.createElement('div');
        div.className = 'lyric-line';
        div.textContent = lyric.text;
        lyricsContainer.appendChild(div);
    });

    updateTextStyle();
}

function updateTextStyle() {
    const lyricLines = document.querySelectorAll('.lyric-line');
    lyricLines.forEach(line => {
        line.style.color = textColor.value;
        line.style.fontSize = `${fontSize.value}px`;

        if (fontFileInput.files.length > 0) {
            line.style.fontFamily = 'CustomFont, sans-serif';
        }

        if (textShadow.checked) {
            line.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
        } else {
            line.style.textShadow = 'none';
        }
    });
}

function updateFontSize() {
    const lyricLines = document.querySelectorAll('.lyric-line');
    lyricLines.forEach(line => {
        line.style.fontSize = `${fontSize.value}px`;
    });
}

function playAudio() {
    // Проверяем загружено ли аудио
    if (!audioBuffer) {
        alert('Пожалуйста, загрузите аудиофайл');
        return;
    }

    // Парсим текст песни при каждом воспроизведении
    const lyricsText = lyricsInput.value;
    if (!lyricsText) {
        alert('Пожалуйста, введите текст песни с таймкодами');
        return;
    }

    lyrics = parseLyrics(lyricsText);
    if (lyrics.length === 0) {
        alert('Не удалось распознать текст с таймкодами. Проверьте формат.');
        return;
    }

    // Обновляем контейнер с текстом
    lyricsContainer.innerHTML = '';
    lyrics.forEach((lyric) => {
        const div = document.createElement('div');
        div.className = 'lyric-line';
        div.textContent = lyric.text;
        lyricsContainer.appendChild(div);
    });

    // Применяем текущие стили
    updateTextStyle();

    // Если уже воспроизводится - ставим на паузу
    if (isPlaying) {
        pauseAudio();
        return;
    }

    // Запускаем воспроизведение
    audioContext.resume().then(() => {
        // Создаем новый источник звука
        audioSource = audioContext.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(audioContext.destination);

        // Запоминаем время начала
        startTime = audioContext.currentTime;
        audioSource.start(0);
        isPlaying = true;

        // Сбрасываем индекс текущей строки
        currentLyricIndex = 0;

        // Запускаем обновление текста
        updateLyrics();

        // Обработчик окончания трека
        audioSource.onended = () => {
            isPlaying = false;
            cancelAnimationFrame(animationFrameId);
            resetLyrics();
        };
    }).catch(error => {
        console.error('Ошибка воспроизведения:', error);
        alert('Ошибка при воспроизведении аудио');
    });
}

function pauseAudio() {
    if (!isPlaying) return;

    audioSource.stop();
    isPlaying = false;
    cancelAnimationFrame(animationFrameId);
}

function updateLyrics() {
    if (!isPlaying) return;

    const currentTime = audioContext.currentTime - startTime;
    const lyricLines = document.querySelectorAll('.lyric-line');

    lyricLines.forEach(line => line.classList.remove('active'));

    while (currentLyricIndex < lyrics.length - 1 &&
           currentTime >= lyrics[currentLyricIndex + 1].time) {
        currentLyricIndex++;
    }

    if (currentLyricIndex < lyricLines.length &&
        currentTime >= lyrics[currentLyricIndex].time) {
        lyricLines[currentLyricIndex].classList.add('active');
    }

    animationFrameId = requestAnimationFrame(updateLyrics);
}

function resetLyrics() {
    const lyricLines = document.querySelectorAll('.lyric-line');
    lyricLines.forEach(line => line.classList.remove('active'));
    currentLyricIndex = 0;
}

async function exportVideo() {
  try {
    // Проверяем все необходимые данные
    const missingFields = [];
    if (!audioBuffer) missingFields.push('аудиофайл');
    if (!lyricsInput.value) missingFields.push('текст песни');
    if (!bgImageInput.files[0]) missingFields.push('фоновое изображение');

    if (missingFields.length > 0) {
      alert(`Пожалуйста, загрузите: ${missingFields.join(', ')}`);
      return;
    }

    // Парсим текст песни
    const parsedLyrics = parseLyrics(lyricsInput.value);
    if (parsedLyrics.length === 0) {
      alert('Не удалось распознать текст с таймкодами. Проверьте формат.');
      return;
    }

    const exportBtn = document.getElementById('export-btn');
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Рендеринг...';

    // Получаем данные фона
    const bgImageFile = bgImageInput.files[0];
    const bgImageUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(bgImageFile);
    });

    // Получаем данные шрифта (если есть)
    let fontDataUrl = null;
    if (fontFileInput.files[0]) {
      fontDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(fontFileInput.files[0]);
      });
    }

    const videoBlob = await renderVideo({
      bgImageUrl,
      lyrics: parsedLyrics,
      audioBuffer,
      textAlign: document.querySelector('.align-btn.active')?.getAttribute('data-align') || 'center',
      textShadowEnabled: textShadow.checked,
      fontSize: fontSize.value,
      textColor: textColor.value,
      fontUrl: fontDataUrl
    });

    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'synclirycs-video.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Ошибка:', error);
    alert('Ошибка при создании видео: ' + error.message);
  } finally {
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.innerHTML = '<i class="fas fa-download"></i> Экспорт видео';
    }
  }
}

function switchTab(tabId) {
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    tabBtns.forEach(btn => {
        btn.classList.remove('active', 'border-blue-500');
        btn.classList.add('border-transparent');
    });

    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    activeBtn.classList.add('active', 'border-blue-500');
    activeBtn.classList.remove('border-transparent');
}