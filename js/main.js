import init, { AudioHandler } from '../pkg/audio_transcriber.js';
import { log } from './utils/logger.js';
import { initializeEffectsController } from './effects/effectsController.js';
import { initializeAudioController } from './audio/audioController.js';
import { initializeUI } from './ui/uiController.js';

async function initializeApp() {
    try {
        // Initialize WASM module
        await init();
        log('WASM initialized');

        // Initialize AudioHandler
        const audioHandler = new AudioHandler();
        log('AudioHandler initialized');

        // Initialize controllers
        initializeEffectsController(audioHandler);
        initializeAudioController(audioHandler);
        initializeUI();

        log('App initialization complete');
    } catch (error) {
        log('Initialization error:', error);
        console.error('Failed to initialize:', error);
    }
}

// Start the application
initializeApp().catch(error => {
    log('Main function error', error);
    console.error('Application error:', error);
});
