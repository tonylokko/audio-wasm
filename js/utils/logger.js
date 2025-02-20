export function log(message, data = null) {
    const debug = document.getElementById('debugInfo');
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}`;
    console.log(logMessage, data);
    if (debug) {
        debug.textContent += logMessage + '\n';
        if (data) {
            debug.textContent += JSON.stringify(data, null, 2) + '\n';
        }
    }
}
