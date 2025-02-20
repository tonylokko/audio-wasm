import { log } from '../utils/logger.js';
import { setS3Config, listRecordings, getSignedUrl, deleteRecording } from '../storage/s3Handler.js';
import { stopCurrentRecording } from '../audio/audioController.js';

export function initializeUI() {
    setupS3ConfigForm();
    setupRecordingsList();
    setupConfigChangeButton();
}

function setupS3ConfigForm() {
    const s3ConfigForm = document.getElementById('s3Config');
    const credentialsForm = document.getElementById('credentialsForm');
    const recorderDiv = document.getElementById('recorder');

    s3ConfigForm.onsubmit = async (e) => {
        e.preventDefault();
        log('S3 config form submitted');

        const config = {
            endpoint: document.getElementById('endpoint').value,
            accessKey: document.getElementById('accessKey').value,
            secretKey: document.getElementById('secretKey').value,
            bucket: document.getElementById('bucket').value
        };

        try {
            setS3Config(config);
            await listRecordings(); // Test the connection

            credentialsForm.style.display = 'none';
            recorderDiv.style.display = 'block';

            await refreshRecordingsList();
        } catch (error) {
            log('Failed to connect to S3', error);
            alert('Failed to connect to S3. Please check your credentials and console for details.');
        }
    };
}

async function refreshRecordingsList() {
    try {
        const data = await listRecordings();
        const container = document.getElementById('recordingsContainer');
        container.innerHTML = '';

        if (!data.Contents || data.Contents.length === 0) {
            container.innerHTML = '<p>No recordings found</p>';
            return;
        }

        const recordings = data.Contents
            .filter(obj => obj.Key.endsWith('.webm'))
            .map(obj => ({
                audioKey: obj.Key,
                date: new Date(obj.LastModified)
            }))
            .sort((a, b) => b.date - a.date);

        recordings.forEach(recording => {
            container.appendChild(createRecordingElement(recording));
        });
    } catch (error) {
        log('Error listing recordings:', error);
        const container = document.getElementById('recordingsContainer');
        container.innerHTML = '<p class="error">Failed to load recordings</p>';
    }
}

function createRecordingElement(recording) {
    const recordingDiv = document.createElement('div');
    recordingDiv.className = 'recording-item';

    // Play button
    const playButton = document.createElement('button');
    playButton.textContent = '▶';
    playButton.className = 'play-btn';
    playButton.onclick = async () => {
        try {
            const url = await getSignedUrl(recording.audioKey);
            const player = document.getElementById('player');
            player.src = url;
            player.play();
        } catch (error) {
            log('Error playing recording:', error);
            alert('Failed to play recording');
        }
    };

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.textContent = '🗑';
    deleteButton.className = 'delete-btn';
    deleteButton.onclick = async () => {
        if (confirm('Are you sure you want to delete this recording?')) {
            try {
                await deleteRecording(recording.audioKey);
                recordingDiv.remove();
            } catch (error) {
                log('Error deleting recording:', error);
                alert('Failed to delete recording');
            }
        }
    };

    const filename = recording.audioKey.split('/').pop();
    const date = recording.date.toLocaleString();
    const infoSpan = document.createElement('span');
    infoSpan.textContent = `${filename} (${date})`;

    recordingDiv.appendChild(playButton);
    recordingDiv.appendChild(deleteButton);
    recordingDiv.appendChild(infoSpan);

    return recordingDiv;
}

function setupRecordingsList() {
    const refreshListBtn = document.getElementById('refreshList');
    if (refreshListBtn) {
        refreshListBtn.onclick = refreshRecordingsList;
    }
}

function setupConfigChangeButton() {
    const changeConfigBtn = document.getElementById('changeConfig');
    const credentialsForm = document.getElementById('credentialsForm');
    const recorderDiv = document.getElementById('recorder');

    if (changeConfigBtn) {
        changeConfigBtn.onclick = async () => {
            await stopCurrentRecording();
            credentialsForm.style.display = 'block';
            recorderDiv.style.display = 'none';
        };
    }
}
