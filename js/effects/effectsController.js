import { effectPresets } from './effectPresets.js';
import { log } from '../utils/logger.js';

let currentEffectChain = [];
let audioHandler = null;

export function initializeEffectsController(handler) {
    audioHandler = handler;
    setupEffectControls();
}

function setupEffectControls() {
    const addEffectSelect = document.getElementById('addEffect');
    Object.keys(effectPresets).forEach(effect => {
        const option = document.createElement('option');
        option.value = effect;
        option.textContent = effect.charAt(0).toUpperCase() + effect.slice(1);
        addEffectSelect.appendChild(option);
    });

    document.getElementById('addEffectBtn').onclick = () => {
        const effect = addEffectSelect.value;
        if (effect) {
            addEffect(effect);
        }
    };
}

export function createEffectControls(effectType) {
    const container = document.createElement('div');
    container.className = 'effect-controls';
    container.dataset.effect = effectType;

    const header = document.createElement('div');
    header.className = 'effect-header';

    const title = document.createElement('h4');
    title.textContent = effectType.charAt(0).toUpperCase() + effectType.slice(1);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.className = 'remove-effect-btn';
    removeBtn.onclick = () => {
        container.remove();
        currentEffectChain = currentEffectChain.filter(effect => effect !== effectType);
    };

    header.appendChild(title);
    header.appendChild(removeBtn);
    container.appendChild(header);

    // Preset selector
    const presetSelect = document.createElement('select');
    presetSelect.className = 'preset-select';
    Object.keys(effectPresets[effectType]).forEach(preset => {
        const option = document.createElement('option');
        option.value = preset;
        option.textContent = preset.charAt(0).toUpperCase() + preset.slice(1);
        presetSelect.appendChild(option);
    });

    presetSelect.onchange = () => {
        const preset = effectPresets[effectType][presetSelect.value];
        Object.entries(preset).forEach(([param, value]) => {
            const slider = container.querySelector(`[data-param="${param}"]`);
            if (slider) {
                slider.value = value;
                slider.dispatchEvent(new Event('input'));
            }
        });
    };

    container.appendChild(presetSelect);

    // Parameter sliders
    const params = effectPresets[effectType].default;
    Object.entries(params).forEach(([param, value]) => {
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'slider-container';

        const label = document.createElement('label');
        label.textContent = param.replace('_', ' ');

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = param.includes('time') ? 2 :
                    param === 'drive' ? 50 :
                    param === 'rate' ? 10 : 1;
        slider.step = 0.01;
        slider.value = value;
        slider.dataset.param = param;

        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = value.toFixed(2);

        slider.oninput = () => {
            valueDisplay.textContent = parseFloat(slider.value).toFixed(2);
            previewEffects();
        };

        sliderContainer.appendChild(label);
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(valueDisplay);
        container.appendChild(sliderContainer);
    });

    return container;
}

export function addEffect(effectType) {
    if (currentEffectChain.includes(effectType)) {
        alert('Effect already in chain');
        return;
    }

    currentEffectChain.push(effectType);
    const controls = createEffectControls(effectType);
    document.getElementById('effectsChain').appendChild(controls);
}

export async function processAudioWithEffects(audioData) {
    if (currentEffectChain.length === 0) return audioData;

    const effectParams = {};
    currentEffectChain.forEach(effectType => {
        const effectControls = document.querySelector(`.effect-controls[data-effect="${effectType}"]`);
        if (effectControls) {
            const params = {};
            effectControls.querySelectorAll('input[type="range"]').forEach(slider => {
                params[slider.dataset.param] = parseFloat(slider.value);
            });
            effectParams[effectType] = params;
        }
    });

    try {
        return await audioHandler.process_audio(audioData, JSON.stringify(effectParams));
    } catch (error) {
        log('Effect processing failed:', error);
        return audioData;
    }
}

async function previewEffects() {
    const player = document.getElementById('player');
    if (!player.src || isRecording) return;

    try {
        const response = await fetch(player.src);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioData = await audioContext.decodeAudioData(arrayBuffer);

        const inputData = audioData.getChannelData(0);
        const float32Array = new Float32Array(inputData);

        const processedData = await processAudioWithEffects(float32Array);

        const processedBuffer = audioContext.createBuffer(1, processedData.length, audioContext.sampleRate);
        processedBuffer.getChannelData(0).set(processedData);

        const source = audioContext.createBufferSource();
        source.buffer = processedBuffer;
        source.connect(audioContext.destination);
        source.start();
    } catch (error) {
        log('Error previewing effects:', error);
    }
}
