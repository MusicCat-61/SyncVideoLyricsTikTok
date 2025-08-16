// video-worker.js
self.importScripts('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');

const { createFFmpeg } = FFmpeg;
const ffmpeg = createFFmpeg({ log: false });

let canvas;
let ctx;
let gl;
let program;
let texture;

async function initWebGL(width, height) {
    canvas = new OffscreenCanvas(width, height);
    gl = canvas.getContext('webgl');

    if (!gl) {
        console.warn('WebGL не доступен, используется Canvas 2D');
        return false;
    }

    const vsSource = `
        attribute vec2 aPosition;
        attribute vec2 aTexCoord;
        varying vec2 vTexCoord;
        void main() {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            vTexCoord = aTexCoord;
        }
    `;

    const fsSource = `
        precision mediump float;
        varying vec2 vTexCoord;
        uniform sampler2D uSampler;
        void main() {
            gl_FragColor = texture2D(uSampler, vTexCoord);
        }
    `;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vsSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fsSource);
    gl.compileShader(fragmentShader);

    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positions = new Float32Array([
        -1.0, -1.0, 0.0, 0.0,
         1.0, -1.0, 1.0, 0.0,
        -1.0,  1.0, 0.0, 1.0,
         1.0,  1.0, 1.0, 1.0
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);

    const aTexCoord = gl.getAttribLocation(program, 'aTexCoord');
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 16, 8);

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return true;
}

async function renderFrameWebGL(img) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return canvas.transferToImageBitmap();
}

async function renderFrame2D(img, width, height, textParams, currentText) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0, width, height);

    if (currentText) {
        ctx.fillStyle = textParams.textColor;
        ctx.font = `${textParams.textSize}px '${textParams.fontName}'`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        const yPos = height - (height * (textParams.textPosition / 100));
        const xPos = width / 2;

        const lines = currentText.split('\n');
        const lineHeight = parseInt(textParams.textSize) * 1.2;

        for (let j = 0; j < lines.length; j++) {
            ctx.fillText(lines[j], xPos, yPos - (lines.length - j - 1) * lineHeight);
        }
    }

    return canvas.transferToImageBitmap();
}

self.onmessage = async function(e) {
    if (e.data.type === 'start') {
        try {
            const params = e.data.params;
            const { width, height, frameRate } = params;

            if (!ffmpeg.isLoaded()) {
                await ffmpeg.load();
            }

            const useWebGL = await initWebGL(width, height);
            const bgImg = await createImageBitmap(await (await fetch(params.bgImg)).blob());

            const lyrics = params.lyrics;
            const audioDuration = params.audioDuration;
            const frameCount = Math.ceil(audioDuration * frameRate);
            const batchSize = 50;

            for (let i = 0; i < frameCount; i += batchSize) {
                const batchEnd = Math.min(i + batchSize, frameCount);
                const framePromises = [];

                for (let j = i; j < batchEnd; j++) {
                    const time = j / frameRate;
                    let currentText = '';

                    for (const line of lyrics) {
                        if (line.time <= time) {
                            currentText = line.text;
                        } else {
                            break;
                        }
                    }

                    const framePromise = useWebGL
                        ? renderFrameWebGL(bgImg)
                        : renderFrame2D(bgImg, width, height, params, currentText);

                    framePromises.push(framePromise);
                }

                const frames = await Promise.all(framePromises);

                for (let j = 0; j < frames.length; j++) {
                    const frameIndex = i + j;
                    const frame = frames[j];
                    const jpegBlob = await frame.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
                    const jpegData = await jpegBlob.arrayBuffer();
                    ffmpeg.FS('writeFile', `frame${frameIndex.toString().padStart(5, '0')}.jpg`, new Uint8Array(jpegData));
                }

                const progress = Math.floor((batchEnd / frameCount) * 100);
                self.postMessage({ type: 'progress', progress });
            }

            ffmpeg.FS('writeFile', 'audio.mp3', new Uint8Array(params.audioData));

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

            const data = ffmpeg.FS('readFile', 'output.mp4');
            const blob = new Blob([data.buffer], { type: 'video/mp4' });

            self.postMessage({ type: 'complete', blob });
        } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
        }
    }
};