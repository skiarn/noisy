import FFT from 'fft.js';

export interface SpectrumData {
  frequencies: number[];
  magnitudes: number[];
  bandEnergy: {
    low: number;
    mid: number;
    high: number;
  };
}

function nearestPowerOfTwo(value: number): number {
  return 2 ** Math.floor(Math.log2(value));
}

function hannWindow(length: number): Float32Array {
  const window = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
  }
  return window;
}

export function computeSpectrum(
  samples: Float32Array,
  sampleRate: number,
  maxBins = 256
): SpectrumData {
  if (samples.length < 64) {
    return {
      frequencies: [],
      magnitudes: [],
      bandEnergy: { low: 0, mid: 0, high: 0 }
    };
  }

  const fftSize = Math.min(4096, nearestPowerOfTwo(samples.length));
  const signal = new Float32Array(fftSize);
  const sourceOffset = Math.floor((samples.length - fftSize) / 2);
  signal.set(samples.slice(sourceOffset, sourceOffset + fftSize));

  const window = hannWindow(fftSize);
  for (let i = 0; i < fftSize; i += 1) {
    signal[i] *= window[i];
  }

  const fft = new FFT(fftSize);
  const output = fft.createComplexArray();
  fft.realTransform(output, signal);

  const nyquistBins = fftSize / 2;
  const stride = Math.max(1, Math.floor(nyquistBins / maxBins));
  const frequencies: number[] = [];
  const magnitudes: number[] = [];

  let low = 0;
  let mid = 0;
  let high = 0;

  for (let bin = 0; bin < nyquistBins; bin += stride) {
    const real = output[2 * bin];
    const imag = output[2 * bin + 1];
    const magnitude = Math.sqrt(real * real + imag * imag) / fftSize;
    const frequency = (bin * sampleRate) / fftSize;

    frequencies.push(frequency);
    magnitudes.push(magnitude);

    if (frequency >= 20 && frequency < 250) low += magnitude;
    else if (frequency >= 250 && frequency < 2000) mid += magnitude;
    else if (frequency >= 2000 && frequency <= 20000) high += magnitude;
  }

  return {
    frequencies,
    magnitudes,
    bandEnergy: {
      low,
      mid,
      high
    }
  };
}
