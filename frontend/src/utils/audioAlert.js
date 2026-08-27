let audioCtx;
let oscillator;
let gainNode;
let interval;

export const startSiren = () => {
    // Only start if not already running
    if (audioCtx) return;

    // Create audio context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Initial settings
    oscillator.type = 'square';
    oscillator.frequency.value = 600;
    gainNode.gain.value = 0.5; // volume

    oscillator.start();

    // Create siren effect (alternating frequencies)
    let isHigh = false;
    interval = setInterval(() => {
        if (!audioCtx) {
            clearInterval(interval);
            return;
        }
        if (isHigh) {
            oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        } else {
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        }
        isHigh = !isHigh;
    }, 500); // toggle every 500ms
};

export const stopSiren = () => {
    if (interval) {
        clearInterval(interval);
        interval = null;
    }
    if (oscillator) {
        try {
            oscillator.stop();
        } catch (e) {
            // Might already be stopped
        }
        oscillator.disconnect();
        oscillator = null;
    }
    if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
    }
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
};
