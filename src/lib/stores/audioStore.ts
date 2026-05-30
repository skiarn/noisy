import { writable } from 'svelte/store';
import type { DecodedAudio } from '$lib/audio/decoder';
import type { SpectrumData } from '$lib/audio/fft';
import type { TrainPassByMetrics, LoudnessPoint } from '$lib/audio/loudness';
import type { NoiseStatistics } from '$lib/audio/statistics';

export interface RegionSelection {
  startSec: number;
  endSec: number;
}

export interface ExportPayload {
  fileName: string;
  generatedAtIso: string;
  region: RegionSelection;
  statistics: NoiseStatistics | null;
  spectrum: SpectrumData | null;
  passByMetrics: TrainPassByMetrics | null;
}

interface AudioState {
  fileName: string;
  decodedAudio: DecodedAudio | null;
  region: RegionSelection;
  statistics: NoiseStatistics | null;
  spectrum: SpectrumData | null;
  loudnessTimeline: LoudnessPoint[];
  passByMetrics: TrainPassByMetrics | null;
  loading: boolean;
  error: string | null;
}

const initialState: AudioState = {
  fileName: '',
  decodedAudio: null,
  region: { startSec: 0, endSec: 0 },
  statistics: null,
  spectrum: null,
  loudnessTimeline: [],
  passByMetrics: null,
  loading: false,
  error: null
};

export const audioStore = writable<AudioState>(initialState);
