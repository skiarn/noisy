export interface LoudnessPoint {
  timeSec: number;
  rms: number;
  dbfs: number;
}

export interface TrainPassByMetrics {
  peakEventTimeSec: number;
  eventDurationSec: number;
  noiseEnergy: number;
}

function dbfsFromRms(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 1e-12));
}

export function buildLoudnessTimeline(
  samples: Float32Array,
  sampleRate: number,
  windowMs = 80,
  hopMs = 40
): LoudnessPoint[] {
  const windowSize = Math.max(32, Math.floor((windowMs / 1000) * sampleRate));
  const hopSize = Math.max(16, Math.floor((hopMs / 1000) * sampleRate));
  const points: LoudnessPoint[] = [];

  for (let start = 0; start + windowSize < samples.length; start += hopSize) {
    let energy = 0;
    for (let i = 0; i < windowSize; i += 1) {
      const sample = samples[start + i];
      energy += sample * sample;
    }

    const rms = Math.sqrt(energy / windowSize);
    points.push({
      timeSec: start / sampleRate,
      rms,
      dbfs: dbfsFromRms(rms)
    });
  }

  return points;
}

export function detectTrainPassBy(
  timeline: LoudnessPoint[],
  thresholdBelowPeakDb = 10
): TrainPassByMetrics {
  if (timeline.length === 0) {
    return {
      peakEventTimeSec: 0,
      eventDurationSec: 0,
      noiseEnergy: 0
    };
  }

  let peakIndex = 0;
  for (let i = 1; i < timeline.length; i += 1) {
    if (timeline[i].dbfs > timeline[peakIndex].dbfs) peakIndex = i;
  }

  const threshold = timeline[peakIndex].dbfs - thresholdBelowPeakDb;
  let startIndex = peakIndex;
  let endIndex = peakIndex;

  while (startIndex > 0 && timeline[startIndex].dbfs >= threshold) {
    startIndex -= 1;
  }

  while (endIndex < timeline.length - 1 && timeline[endIndex].dbfs >= threshold) {
    endIndex += 1;
  }

  let noiseEnergy = 0;
  for (let i = startIndex; i <= endIndex; i += 1) {
    noiseEnergy += timeline[i].rms * timeline[i].rms;
  }

  return {
    peakEventTimeSec: timeline[peakIndex].timeSec,
    eventDurationSec: Math.max(0, timeline[endIndex].timeSec - timeline[startIndex].timeSec),
    noiseEnergy
  };
}
