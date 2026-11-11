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

export const playNotificationChime = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        // Elegant 2-tone alert chime (E5 -> G#5)
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc.frequency.setValueAtTime(830.61, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
        // AudioContext silently ignored if user hasn't interacted with page yet
    }
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
