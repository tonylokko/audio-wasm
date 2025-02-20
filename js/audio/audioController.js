import { log } from '../utils/logger.js';
import { uploadToS3 } from '../storage/s3Handler.js';
import { processAudioWithEffects } from '../effects/effectsController.js';

let audioHandler = null;
let isRecording = false;

export function initializeAudioController(handler) {
    audioHandler = handler;
    setupAudioControls();
}

function setupAudioControls() {
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const recordingStatus = document.getElementById('recordingStatus');
    const uploadStatus = document.getElementById('uploadStatus');
    const player = document.getElementById('player');

    startButton.onclick = async () => {
        if (!isRecording) {
            try {
                await audioHandler.start_recording();
                isRecording = true;
                startButton.disabled = true;
                stopButton.disabled = false;
                uploadStatus.textContent = '';
                recordingStatus.textContent = 'Recording...';
            } catch (error) {
                log('Failed to start recording', error);
                alert('Failed to start recording. Please check microphone permissions.');
            }
        }
    };

    stopButton.onclick = async () => {
        if (isRecording) {
            try {
                const blobPromise = await audioHandler.stop_recording();
                const blob = await blobPromise;

                isRecording = false;
                startButton.disabled = false;
                stopButton.disabled = true;
                recordingStatus.textContent = 'Recording stopped';

                // Process with effects
                const audioContext = new AudioContext();
                const arrayBuffer = await blob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                const inputData = audioBuffer.getChannelData(0);

                const processedData = await processAudioWithEffects(inputData);
                const processedBuffer = audioContext.createBuffer(1, processedData.length, audioContext.sampleRate);
                processedBuffer.getChannelData(0).set(processedData);

                // Convert to blob
                const mediaStreamDestination = audioContext.createMediaStreamDestination();
                const source = audioContext.createBufferSource();
                source.buffer = processedBuffer;
                source.connect(mediaStreamDestination);
                source.start();

                const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
                const processedChunks = [];

                mediaRecorder.ondataavailable = e => processedChunks.push(e.data);
                mediaRecorder.onstop = async () => {
                    const processedBlob = new Blob(processedChunks, { type: 'audio/webm' });
                    const url = URL.createObjectURL(processedBlob);
                    player.src = url;

                    try {
                        uploadStatus.textContent = 'Uploading...';
                        const filename = `recordings/${Date.now()}.webm`;
                        log('Starting upload', { filename });
                        await uploadToS3(processedBlob, filename);
                        uploadStatus.textContent = 'Upload complete!';

                        // Trigger recordings list refresh
                        document.getElementById('refreshList').click();
                    } catch (error) {
                        log('Failed to upload', error);
                        uploadStatus.textContent = 'Upload failed. Please check your S3 configuration.';
                    }
                };

                mediaRecorder.start();
                setTimeout(() => mediaRecorder.stop(), processedBuffer.duration * 1000 + 100);

            } catch (error) {
                log('Failed to stop recording', error);
                alert('Failed to stop recording.');
            }
        }
    };
}

export function getCurrentRecordingState() {
    return isRecording;
}

export function stopCurrentRecording() {
    if (isRecording && audioHandler) {
        return audioHandler.stop_recording();
    }
    return Promise.resolve(null);
}
