export const effectPresets = {
    delay: {
        default: { delay_time: 0.5, feedback: 0.3, mix: 0.5 },
        short: { delay_time: 0.2, feedback: 0.2, mix: 0.4 },
        long: { delay_time: 1.0, feedback: 0.4, mix: 0.6 }
    },
    distortion: {
        default: { drive: 10.0, tone: 0.5, mix: 0.5 },
        light: { drive: 5.0, tone: 0.7, mix: 0.3 },
        heavy: { drive: 20.0, tone: 0.3, mix: 0.7 }
    },
    chorus: {
        default: { rate: 1.5, depth: 0.3, mix: 0.5 },
        subtle: { rate: 0.8, depth: 0.2, mix: 0.3 },
        intense: { rate: 2.5, depth: 0.5, mix: 0.7 }
    },
    tremolo: {
        default: { rate: 5.0, depth: 0.5 },
        slow: { rate: 2.0, depth: 0.6 },
        fast: { rate: 8.0, depth: 0.4 }
    }
};
