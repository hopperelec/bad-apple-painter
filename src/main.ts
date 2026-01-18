// --- Canvas contexts ---

let canvasPreviewCtx: CanvasRenderingContext2D;
let gameStagingCanvasCtx: CanvasRenderingContext2D;
let gamePaintCanvasCtx: CanvasRenderingContext2D;
document.addEventListener('DOMContentLoaded', () => {
    canvasPreviewCtx = canvasPreview.getContext('2d', { willReadFrequently: true })!;
    gameStagingCanvasCtx = gameStagingCanvas.getContext('2d', { willReadFrequently: true })!;
    gamePaintCanvasCtx = gamePaintCanvas.getContext('2d', { willReadFrequently: true })!;
});

// --- Rendering ---

const BLACK_32 = 0xFF000000;
const COLOR_ROUNDING_THRESHOLD = 0xFF7F7F7F;
const WHITE_32 = 0xFFFFFFFF;

function renderFrameToCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    if (canvasScalingMethod === 'nearest') {
        ctx.imageSmoothingEnabled = false;
    } else {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Round to black and white
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data32 = new Uint32Array(imageData.data.buffer);
    for (let i = 0; i < data32.length; i++) {
        data32[i] = data32[i]! < COLOR_ROUNDING_THRESHOLD ? BLACK_32 : WHITE_32;
    }
    ctx.putImageData(imageData, 0, 0);
}

function startRenderLoop(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    handleFrame?: () => void
) {
    const callback = () => {
        renderFrameToCanvas(video, canvas, ctx);
        handleFrame?.();
        if (!video.paused && !video.ended) {
            video.requestVideoFrameCallback(callback);
        }
    };
    video.requestVideoFrameCallback(callback);
}

// --- Video Selection ---

const videoFileInput = document.getElementById('video-file-input') as HTMLInputElement;
const volumeInput = document.getElementById('volume-input') as HTMLInputElement;
const videoPreview = document.getElementById('video-preview') as HTMLVideoElement;
const videoNotSelectedOverlays = document.getElementsByClassName('video-not-selected-overlay') as HTMLCollectionOf<HTMLElement>;
const previewPlayPauseButton = document.getElementById('preview-play-pause') as HTMLButtonElement;
const previewSeekBar = document.getElementById('preview-seek-bar') as HTMLInputElement;

const savedVolume = localStorage.getItem('videoVolume');
if (savedVolume !== null) {
    videoPreview.volume = +savedVolume;
}
volumeInput.value = videoPreview.volume.toString();
volumeInput.addEventListener('input', () => {
    videoPreview.volume = +volumeInput.value;
    localStorage.setItem('videoVolume', volumeInput.value);
});

videoFileInput.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
        URL.revokeObjectURL(videoPreview.src);
        videoPreview.src = URL.createObjectURL(file);
        videoPreview.load();
        for (const overlay of videoNotSelectedOverlays) {
            overlay.style.display = 'none';
        }
        startGameButton.disabled = false;
    } else {
        videoPreview.src = '';
        for (const overlay of videoNotSelectedOverlays) {
            overlay.style.display = '';
        }
        startGameButton.disabled = true;
    }
    previewSeekBar.value = '0';
});

previewPlayPauseButton.addEventListener('click', async () => {
    if (videoPreview.paused) {
        await videoPreview.play()
    } else {
        videoPreview.pause();
    }
});

videoPreview.addEventListener('loadedmetadata', () => {
    previewSeekBar.max = videoPreview.duration.toString();
});

videoPreview.addEventListener('play', () => {
    previewPlayPauseButton.title = 'Pause';
    startRenderLoop(videoPreview, canvasPreview, canvasPreviewCtx);
});

videoPreview.addEventListener('pause', () => {
    previewPlayPauseButton.title = 'Play';
});

videoPreview.addEventListener('ended', () => {
    previewPlayPauseButton.title = 'Play';
});

videoPreview.addEventListener('timeupdate', () => {
    previewSeekBar.value = videoPreview.currentTime.toString();
});

previewSeekBar.addEventListener('input', () => {
    videoPreview.currentTime = +previewSeekBar.value;
});

// --- Canvas Settings ---

const canvasWidthInput = document.getElementById('canvas-width') as HTMLInputElement;
const canvasHeightInput = document.getElementById('canvas-height') as HTMLInputElement;
const canvasScalingMethodInputs = document.querySelectorAll('#scaling-method-fieldset input') as NodeListOf<HTMLInputElement>;
const canvasPreview = document.getElementById('canvas-preview') as HTMLCanvasElement;

function renderPreview() {
    renderFrameToCanvas(videoPreview, canvasPreview, canvasPreviewCtx);
}

canvasWidthInput.addEventListener('input', () => {
    canvasPreview.width = +canvasWidthInput.value;
    renderPreview();
});

canvasHeightInput.addEventListener('input', () => {
    canvasPreview.height = +canvasHeightInput.value;
    renderPreview();
});

let canvasScalingMethod: 'nearest' | 'bilinear' = 'nearest';
for (const input of canvasScalingMethodInputs) {
    input.addEventListener('input', () => {
        canvasScalingMethod = (document.querySelector('#scaling-method-fieldset input:checked') as HTMLInputElement).value as 'nearest' | 'bilinear';
        renderPreview();
    });
}

// --- Paint feature options ---

const enableFillCheckbox = document.getElementById('enable-fill') as HTMLInputElement;
const enableInvertCheckbox = document.getElementById('enable-invert') as HTMLInputElement;
const brushShapeInputs = document.querySelectorAll('#brush-shape-fieldset input') as NodeListOf<HTMLInputElement>;
const minBrushSizeInput = document.getElementById('min-brush-size') as HTMLInputElement;
const maxBrushSizeInput = document.getElementById('max-brush-size') as HTMLInputElement;

enableFillCheckbox.addEventListener('input', () => {
    keybinds.fillTool!.button.disabled = !enableFillCheckbox.checked;

    // Show/hide from game immediately, so it can be seen in the background
    fillToolButton.style.display = enableFillCheckbox.checked ? '' : 'none';
});

enableInvertCheckbox.addEventListener('input', () => {
    keybinds.invertTool!.button.disabled = !enableInvertCheckbox.checked;

    // Show/hide from game immediately, so it can be seen in the background
    invertToolButton.style.display = enableInvertCheckbox.checked ? '' : 'none';
});

let brushShape: 'square' | 'circle' = 'square';
for (const input of brushShapeInputs) {
    input.addEventListener('input', () => {
        brushShape = (document.querySelector('#brush-shape-fieldset input:checked') as HTMLInputElement).value as 'circle' | 'square';
    });
}

minBrushSizeInput.addEventListener('input', () => {
    const minBrushSize = +minBrushSizeInput.value;
    const maxBrushSize = +maxBrushSizeInput.value;
    if (minBrushSize > maxBrushSize) {
        maxBrushSizeInput.value = minBrushSize.toString();
        disableBrushSizeControls();
    } else if (minBrushSize === maxBrushSize) {
        disableBrushSizeControls();
    }
});

maxBrushSizeInput.addEventListener('input', () => {
    const minBrushSize = +minBrushSizeInput.value;
    const maxBrushSize = +maxBrushSizeInput.value;
    if (maxBrushSize < minBrushSize) {
        minBrushSizeInput.value = maxBrushSize.toString();
        disableBrushSizeControls();
    } else if (minBrushSize === maxBrushSize) {
        disableBrushSizeControls();
    } else {
        enableBrushSizeControls();
    }
});

// --- Control options ---

const addBrushSizePresetButton = document.getElementById('controls-add-brush-size-preset') as HTMLButtonElement;
const brushSizePresetsContainer = document.getElementById('brush-size-presets') as HTMLElement;

const keybinds: Record<string, {
    button: HTMLButtonElement;
    keys: string[];
}> = {};
const brushSizePresets: {
    valueInput: HTMLInputElement;
    keys: string[];
}[] = [];

function updateKeybindButtonDisplay(button: HTMLButtonElement, keys: string[]) {
    button.innerHTML = '';
    if (keys.length === 0) {
        button.textContent = 'Unset';
    } else {
        for (let [index, key] of keys.entries()) {
            if (key === ' ') {
                key = 'Space';
            } else if (key === 'Meta') {
                key = navigator.platform.includes('Mac') ? 'Cmd' : 'Win';
            } else if (key === 'Control') {
                key = 'Ctrl';
            }
            const kbd = button.appendChild(document.createElement('kbd'));
            kbd.textContent = key;
            if (index < keys.length - 1) {
                button.append(' + ');
            }
        }
    }
}

function keybindButtonOnClick(button: HTMLButtonElement, keys: string[]) {
    return () => {
        button.disabled = true;
        button.textContent = 'Press keys...';
        const originalKeys = [...keys];

        function cleanup() {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
            window.removeEventListener('click', cancel, { capture: true });
            button.disabled = false;
        }

        function setKeys(newKeys: string[]) {
            keys.length = 0;
            keys.push(...newKeys);
            updateKeybindButtonDisplay(button, keys);
            cleanup();
        }

        function cancel() {
            setKeys(originalKeys);
        }

        function handleKeyDown(event: KeyboardEvent) {
            event.preventDefault();
            event.stopPropagation();

            if (event.key === 'Escape') {
                cancel();
                return;
            }

            const newKeys: string[] = [];
            if (event.ctrlKey) newKeys.push('Control');
            if (event.altKey) newKeys.push('Alt');
            if (event.shiftKey) newKeys.push('Shift');
            if (event.metaKey) newKeys.push('Meta');

            if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
                updateKeybindButtonDisplay(button, newKeys);
            } else {
                newKeys.push(event.key);
                setKeys(newKeys);
            }
        }

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        window.addEventListener('click', cancel, { capture: true });
    };
}

function loadKeybind(key: string, buttonId: string) {
    const button = document.getElementById(buttonId) as HTMLButtonElement;
    const keys = [];
    for (const kbd of button.getElementsByTagName('kbd')) {
        let key = kbd.textContent;
        if (key === '') continue;
        if (key === 'Space') {
            key = ' ';
        } else if (key === 'Cmd' || key === 'Win') {
            key = 'Meta';
        } else if (key === 'Ctrl') {
            key = 'Control';
        }
        keys.push(key);
    }
    keybinds[key] = { button, keys };

    button.addEventListener('click', keybindButtonOnClick(button, keys));
}
loadKeybind('playPause', 'controls-play-pause');
loadKeybind('swapColors', 'controls-swap-colors');
loadKeybind('fillTool', 'controls-fill-tool');
loadKeybind('invertTool', 'controls-invert-tool');
loadKeybind('increaseBrushSize', 'controls-increase-brush-size');
loadKeybind('decreaseBrushSize', 'controls-decrease-brush-size');

addBrushSizePresetButton.addEventListener('click', () => {
    const li = brushSizePresetsContainer.appendChild(document.createElement('li'));

    const valueInput = li.appendChild(document.createElement('input'));
    valueInput.type = 'number';
    valueInput.className = 'brush-size-preset-value';
    valueInput.min = '1';
    // Default to one more than the current highest preset value, or 1 if no presets exist yet
    valueInput.value = Math.max(1, ...brushSizePresets.map(p => +p.valueInput.value + 1)).toString();

    const preset = {
        valueInput,
        keys: []
    };
    brushSizePresets.push(preset);

    const keybindButton = li.appendChild(document.createElement('button'));
    keybindButton.type = 'button';
    keybindButton.className = 'brush-size-preset-keybind keybind-button';
    updateKeybindButtonDisplay(keybindButton, preset.keys);

    const deleteButton = li.appendChild(document.createElement('button'));
    deleteButton.type = 'button';
    deleteButton.className = 'brush-size-preset-delete';
    deleteButton.ariaLabel = 'Delete preset';
    deleteButton.innerHTML = '&times;';

    keybindButton.addEventListener('click', keybindButtonOnClick(keybindButton, preset.keys));
    deleteButton.addEventListener('click', () => {
        brushSizePresetsContainer.removeChild(li);
        const index = brushSizePresets.indexOf(preset);
        if (index !== -1) {
            brushSizePresets.splice(index, 1);
        }
    });
});

function disableBrushSizeControls() {
    keybinds.increaseBrushSize!.button.disabled = true;
    keybinds.decreaseBrushSize!.button.disabled = true;
    addBrushSizePresetButton.disabled = true;
    brushSizePresetsContainer.style.pointerEvents = 'none';
    brushSizePresetsContainer.style.cursor = 'not-allowed';
}
disableBrushSizeControls();

function enableBrushSizeControls() {
    keybinds.increaseBrushSize!.button.disabled = false;
    keybinds.decreaseBrushSize!.button.disabled = false;
    addBrushSizePresetButton.disabled = false;
    brushSizePresetsContainer.style.pointerEvents = '';
    brushSizePresetsContainer.style.cursor = '';
}

// --- Start game ---

const startScreenContainer = document.getElementById('start-screen-container') as HTMLElement;
const startGameButton = document.getElementById('start-game-button') as HTMLButtonElement;

startGameButton.addEventListener('click', async () => {
    startGameButton.style.cursor = 'wait';

    videoPreview.pause();

    gameVideo.src = videoPreview.src;
    gameVideo.volume = videoPreview.volume;
    gameVideo.load();
    await gameVideo.play();

    points = 0;
    brushSize = Math.floor((+minBrushSizeInput.value + +maxBrushSizeInput.value) / 2);
    const width = +canvasWidthInput.value;
    const height = +canvasHeightInput.value;
    gamePaintCanvas.width = width;
    gamePaintCanvas.height = height;
    gameStagingCanvas.width = width;
    gameStagingCanvas.height = height;

    // Make game paint canvas opaque
    gamePaintCanvasCtx.fillStyle = '#000';
    gamePaintCanvasCtx.fillRect(0, 0, gamePaintCanvas.width, gamePaintCanvas.height);
    gamePaintCanvasCtx.fillStyle = '#fff';
    currentColor = 'white';

    startGameButton.style.cursor = '';
    startScreenContainer.style.display = 'none';
});

// --- Game ---

const MAX_POINTS_PER_FRAME = 10;

const gameContainer = document.getElementById('game-container') as HTMLElement;
const gameVideo = document.getElementById('game-video') as HTMLVideoElement;
const gamePaintCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const gameStagingCanvas = document.createElement('canvas');
const gameSeparator = document.getElementById('separator') as HTMLElement;

const gameCurrentTimeElement = document.getElementById('current-time') as HTMLElement;
const gameTotalTimeElement = document.getElementById('total-time') as HTMLElement;
const gamePointsElement = document.getElementById('points-value') as HTMLElement;
const accuracyElement = document.getElementById('accuracy-value') as HTMLElement;

const gameRestartButton = document.getElementById('game-restart-button') as HTMLButtonElement;
const gamePauseResumeButton = document.getElementById('pause-resume-button') as HTMLButtonElement;
const swapColorsButton = document.getElementById('swap-colors-button') as HTMLButtonElement;
const fillToolButton = document.getElementById('fill-tool-button') as HTMLButtonElement;
const invertToolButton = document.getElementById('invert-tool-button') as HTMLButtonElement;

let points = 0;
let currentColor: 'black' | 'white' = 'white';

function secondsToTimeString(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

gameVideo.addEventListener('loadedmetadata', () => {
    gameTotalTimeElement.textContent = secondsToTimeString(gameVideo.duration);
});

gameVideo.addEventListener('play', () => {
    gamePauseResumeButton.title = 'Pause';
    startRenderLoop(gameVideo, gameStagingCanvas, gameStagingCanvasCtx, () => {
        const paintData32 = new Uint32Array(
            gamePaintCanvasCtx.getImageData(0, 0, gamePaintCanvas.width, gamePaintCanvas.height).data.buffer
        );
        const stagingData32 = new Uint32Array(
            gameStagingCanvasCtx.getImageData(0, 0, gameStagingCanvas.width, gameStagingCanvas.height).data.buffer
        );

        let correctPixels = 0;
        for (let i = 0; i < paintData32.length; i++) {
            const stagingPixelIsBlack = stagingData32[i]! === BLACK_32;
            const paintPixelIsBlack = paintData32[i]! === BLACK_32;
            if (stagingPixelIsBlack === paintPixelIsBlack) {
                correctPixels++;
            }
        }

        const totalPixels = paintData32.length;
        const accuracy = totalPixels === 0 ? 1 : correctPixels / totalPixels;

        accuracyElement.textContent = (accuracy * 100).toFixed(2) + '%';

        points += accuracy * MAX_POINTS_PER_FRAME;
        gamePointsElement.textContent = points.toFixed(0);
    });
});

gameVideo.addEventListener('pause', () => {
    gamePauseResumeButton.title = 'Resume';
});

gameVideo.addEventListener('timeupdate', () => {
    gameCurrentTimeElement.textContent = secondsToTimeString(gameVideo.currentTime);
});

gameRestartButton.addEventListener('click', () => {
    gameVideo.pause();
    startScreenContainer.style.display = '';
});

function pauseResumeGame() {
    if (gameVideo.paused) {
        gameVideo.play().then();
    } else {
        gameVideo.pause();
    }
}
gamePauseResumeButton.addEventListener('click', pauseResumeGame);

// --- Paint tools ---

function swapColors() {
    currentColor = currentColor === 'black' ? 'white' : 'black';
    gamePaintCanvasCtx.fillStyle = currentColor === 'black' ? '#000' : '#fff';
}
swapColorsButton.addEventListener('click', swapColors);

function fillCanvas() {
    gamePaintCanvasCtx.fillRect(0, 0, gamePaintCanvas.width, gamePaintCanvas.height);
}
fillToolButton.addEventListener('click', fillCanvas);

function invertCanvas() {
    const imageData = gamePaintCanvasCtx.getImageData(0, 0, gamePaintCanvas.width, gamePaintCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i]!;
        data[i + 1] = 255 - data[i + 1]!;
        data[i + 2] = 255 - data[i + 2]!;
    }
    gamePaintCanvasCtx.putImageData(imageData, 0, 0);
}
invertToolButton.addEventListener('click', invertCanvas);

gamePaintCanvas.addEventListener('wheel', (event: WheelEvent) => {
    event.preventDefault();
    if (event.deltaY < 0) {
        // Scroll up
        if (brushSize < +maxBrushSizeInput.value) {
            brushSize++;
        }
    } else if (event.deltaY > 0) {
        // Scroll down
        if (brushSize > +minBrushSizeInput.value) {
            brushSize--;
        }
    }
});

// --- Keybind handling ---

function keybindsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const aSorted = [...a].sort();
    const bSorted = [...b].sort();
    for (let i = 0; i < aSorted.length; i++) {
        if (aSorted[i] !== bSorted[i]) return false;
    }
    return true;
}

function getPressedKeys(event: KeyboardEvent): string[] {
    const keys: string[] = [];
    if (event.ctrlKey) keys.push('Control');
    if (event.altKey) keys.push('Alt');
    if (event.shiftKey) keys.push('Shift');
    if (event.metaKey) keys.push('Meta');
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
        keys.push(event.key);
    }
    return keys;
}

window.addEventListener('keydown', (event) => {
    if (startScreenContainer.style.display !== 'none') {
        // Game not started
        return;
    }
    let handled = false;
    for (const [key, bind] of Object.entries(keybinds)) {
        if (keybindsEqual(bind.keys, getPressedKeys(event))) {
            handled = true;
            switch (key) {
                case 'playPause':
                    pauseResumeGame();
                    break;
                case 'swapColors':
                    swapColors();
                    break;
                case 'fillTool':
                    if (enableFillCheckbox.checked) {
                        fillCanvas();
                    }
                    break;
                case 'invertTool':
                    if (enableInvertCheckbox.checked) {
                        invertCanvas();
                    }
                    break;
                case 'increaseBrushSize':
                    if (brushSize < +maxBrushSizeInput.value) {
                        brushSize++;
                    }
                    break;
                case 'decreaseBrushSize':
                    if (brushSize > +minBrushSizeInput.value) {
                        brushSize--;
                    }
                    break;
            }
        }
    }
    for (const preset of brushSizePresets) {
        if (keybindsEqual(preset.keys, getPressedKeys(event))) {
            handled = true;
            brushSize = +preset.valueInput.value;
        }
    }
    if (handled) {
        event.preventDefault();
        event.stopPropagation();
    }
});

// --- Painting ---

let isPainting = false;
let brushSize = 1;
let lastPaintCoords: { x: number; y: number } | null = null;

gamePaintCanvas.addEventListener('mousedown', (event) => {
    isPainting = true;
    lastPaintCoords = null;
    paintAtEvent(event);
});

window.addEventListener('mouseup', () => {
    isPainting = false;
    lastPaintCoords = null;
});

gamePaintCanvas.addEventListener('mousemove', (event) => {
    if (isPainting) {
        paintAtEvent(event);
    }
});

gamePaintCanvas.addEventListener('mouseleave', () => {
    lastPaintCoords = null;
});

function paintAtEvent(event: MouseEvent) {
    // Calculate mouse position relative to canvas, accounting for letterboxing from `object-fit: contain`
    const rect = gamePaintCanvas.getBoundingClientRect();

    const canvasAspect = gamePaintCanvas.width / gamePaintCanvas.height;
    const rectAspect = rect.width / rect.height;

    let renderWidth: number, renderHeight: number, offsetX: number, offsetY: number;
    if (canvasAspect > rectAspect) {
        // Canvas is wider than container - letterboxed top/bottom
        renderWidth = rect.width;
        renderHeight = rect.width / canvasAspect;
        offsetX = 0;
        offsetY = (rect.height - renderHeight) / 2;
    } else {
        // Canvas is taller than container - letterboxed left/right
        renderHeight = rect.height;
        renderWidth = rect.height * canvasAspect;
        offsetX = (rect.width - renderWidth) / 2;
        offsetY = 0;
    }

    const scaleX = gamePaintCanvas.width / renderWidth;
    const scaleY = gamePaintCanvas.height / renderHeight;

    const x = Math.floor((event.clientX - rect.left - offsetX) * scaleX);
    const y = Math.floor((event.clientY - rect.top - offsetY) * scaleY);

    if (x < 0 || x >= gamePaintCanvas.width || y < 0 || y >= gamePaintCanvas.height) {
        // Out of bounds
        return;
    }

    // Now paint at the calculated position
    if (lastPaintCoords) {
        // Interpolate between lastPaintCoords and (x, y) to avoid gaps when moving quickly
        const dx = x - lastPaintCoords.x;
        const dy = y - lastPaintCoords.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.ceil(distance));

        for (let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
            const px = Math.round(lastPaintCoords.x + dx * t);
            const py = Math.round(lastPaintCoords.y + dy * t);
            paintAt(px, py);
        }
    } else {
        paintAt(x, y);
    }

    lastPaintCoords = { x, y };
}

function paintAt(x: number, y: number) {
    const radius = Math.floor(brushSize / 2);
    if (brushShape === 'circle') {
        gamePaintCanvasCtx.beginPath();
        gamePaintCanvasCtx.arc(x, y, radius, 0, Math.PI * 2);
        gamePaintCanvasCtx.fill();
    } else {
        gamePaintCanvasCtx.fillRect(x - radius, y - radius, brushSize, brushSize);
    }
}

// --- Separator dragging ---

let isDraggingSeparator = false;

gameSeparator.addEventListener('mousedown', (event) => {
    event.preventDefault();
    isDraggingSeparator = true;
});

window.addEventListener('mouseup', () => {
    isDraggingSeparator = false;
});

window.addEventListener('mousemove', (event) => {
    if (!isDraggingSeparator) return;

    const isVertical = window.matchMedia('(max-aspect-ratio: 1 / 1)').matches;
    const containerRect = gameContainer.getBoundingClientRect();
    const percent = isVertical
        ? (event.clientY - containerRect.top) / containerRect.height
        : (event.clientX - containerRect.left) / containerRect.width;

    gameSeparator.setAttribute('aria-valuenow', percent.toString());
    gameContainer.style.setProperty('--separator-position', percent.toString());
});

// -- End screen ---

const endScreenContainer = document.getElementById('end-screen-container') as HTMLElement;
const finalPointsElement = document.getElementById('final-points-value') as HTMLElement;
const endRestartButton = document.getElementById('end-restart-button') as HTMLButtonElement;

gameVideo.addEventListener('ended', () => {
    finalPointsElement.textContent = points.toFixed(0);
    endScreenContainer.style.display = 'block';
});

endRestartButton.addEventListener('click', () => {
    endScreenContainer.style.display = '';
    startScreenContainer.style.display = '';
});
