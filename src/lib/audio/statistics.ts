export interface NoiseStatistics {
  recordingDurationSec: number;
  segmentDurationSec: number;
  peakAmplitude: number;
  rmsAmplitude: number;
  averageAmplitude: number;
  crestFactor: number;
  dynamicRange: number;
  peakDbfs: number;
  rmsDbfs: number;
}

function clampToNonZero(value: number): number {
  return Math.max(value, 1e-12);
}

export function toDbfs(amplitude: number): number {
  return 20 * Math.log10(clampToNonZero(Math.abs(amplitude)));
}

export function computeNoiseStatistics(
  segment: Float32Array,
  sampleRate: number,
  recordingDurationSec: number
): NoiseStatistics {
  if (segment.length === 0) {
    return {
      recordingDurationSec,
      segmentDurationSec: 0,
      peakAmplitude: 0,
      rmsAmplitude: 0,
      averageAmplitude: 0,
      crestFactor: 0,
      dynamicRange: 0,
      peakDbfs: -Infinity,
      rmsDbfs: -Infinity
    };
  }

  let peakAmplitude = 0;
  let absSum = 0;
  let energySum = 0;

  for (let i = 0; i < segment.length; i += 1) {
    const sample = segment[i];
    const abs = Math.abs(sample);
    absSum += abs;
    energySum += sample * sample;
    if (abs > peakAmplitude) peakAmplitude = abs;
  }

  const averageAmplitude = absSum / segment.length;
  const rmsAmplitude = Math.sqrt(energySum / segment.length);
  const crestFactor = rmsAmplitude === 0 ? 0 : peakAmplitude / rmsAmplitude;

  return {
    recordingDurationSec,
    segmentDurationSec: segment.length / sampleRate,
    peakAmplitude,
    rmsAmplitude,
    averageAmplitude,
    crestFactor,
    dynamicRange: peakAmplitude - averageAmplitude,
    peakDbfs: toDbfs(peakAmplitude),
    rmsDbfs: toDbfs(rmsAmplitude)
  };
}
