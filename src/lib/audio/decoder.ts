export interface DecodedAudio {
  audioBuffer: AudioBuffer;
  monoSamples: Float32Array;
  sampleRate: number;
  duration: number;
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const channelCount = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const totalFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = totalFrames * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < totalFrames; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = buffer.getChannelData(channel)[frame] ?? 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      const pcm = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(offset, Math.round(pcm), true);
      offset += bytesPerSample;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

export async function transcodeWavBlobToMp4File(
  wavBlob: Blob,
  outputFileName = 'selected-segment.mp4'
): Promise<File> {
  const ffmpeg = await getFFmpeg();
  const runId = Date.now().toString(36);
  const inputPath = `segment-${runId}.wav`;
  const outputPath = `segment-${runId}.mp4`;

  await ffmpeg.writeFile(inputPath, new Uint8Array(await wavBlob.arrayBuffer()));

  try {
    await ffmpeg.exec([
      '-i',
      inputPath,
      '-vn',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      outputPath
    ]);

    const mp4Data = await ffmpeg.readFile(outputPath);
    if (!(mp4Data instanceof Uint8Array)) {
      throw new Error('FFmpeg did not return binary MP4 data.');
    }

    const copy = new Uint8Array(mp4Data.byteLength);
    copy.set(mp4Data);

    return new File([copy.buffer], outputFileName, { type: 'audio/mp4' });
  } finally {
    await ffmpeg.deleteFile(inputPath).catch(() => undefined);
    await ffmpeg.deleteFile(outputPath).catch(() => undefined);
  }
}

type FFmpegType = import('@ffmpeg/ffmpeg').FFmpeg;

let ffmpegInstance: FFmpegType | null = null;
let ffmpegLoadPromise: Promise<FFmpegType> | null = null;

function isM4aFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  const lowerType = file.type.toLowerCase();

  return (
    lowerName.endsWith('.m4a') ||
    lowerType === 'audio/mp4' ||
    lowerType === 'audio/x-m4a' ||
    lowerType === 'audio/aac'
  );
}

function m4aSupportHint(): string {
  if (typeof document === 'undefined') {
    return 'This browser may not support the codec used inside this M4A container.';
  }

  const probe = document.createElement('audio');
  const canPlayAacInMp4 = probe.canPlayType('audio/mp4; codecs="mp4a.40.2"');

  if (!canPlayAacInMp4) {
    return 'This browser does not report support for AAC in M4A/MP4 audio.';
  }

  return 'This specific M4A codec may not be supported (for example ALAC or HE-AAC variants).';
}

function createAudioContext(): AudioContext {
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('Web Audio API is not available in this browser.');
  }

  return new AudioContextCtor();
}

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex < 0) return 'bin';

  return fileName.slice(dotIndex + 1).toLowerCase();
}

async function getFFmpeg(): Promise<FFmpegType> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util')
    ]);

    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await ffmpegLoadPromise;
  } finally {
    ffmpegLoadPromise = null;
  }
}

async function decodeViaFFmpeg(file: File): Promise<ArrayBuffer> {
  const ffmpeg = await getFFmpeg();

  const extension = getFileExtension(file.name);
  const inputPath = `input.${extension}`;
  const outputPath = 'output.wav';

  await ffmpeg.writeFile(inputPath, new Uint8Array(await file.arrayBuffer()));

  try {
    await ffmpeg.exec(['-i', inputPath, '-vn', '-acodec', 'pcm_s16le', outputPath]);
    const wavData = await ffmpeg.readFile(outputPath);
    if (!(wavData instanceof Uint8Array)) {
      throw new Error('FFmpeg produced non-binary output while decoding audio.');
    }

    const copy = new Uint8Array(wavData.byteLength);
    copy.set(wavData);
    return copy.buffer;
  } finally {
    await ffmpeg.deleteFile(inputPath).catch(() => undefined);
    await ffmpeg.deleteFile(outputPath).catch(() => undefined);
  }
}

function downmixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0).slice();
  }

  const mixed = new Float32Array(buffer.length);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i += 1) {
      mixed[i] += channelData[i] / buffer.numberOfChannels;
    }
  }

  return mixed;
}

export async function decodeAudioFile(file: File): Promise<DecodedAudio> {
  const arrayBuffer = await file.arrayBuffer();
  const context = createAudioContext();

  try {
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    const monoSamples = downmixToMono(audioBuffer);

    return {
      audioBuffer,
      monoSamples,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration
    };
  } catch (nativeError) {
    try {
      const ffmpegDecoded = await decodeViaFFmpeg(file);
      const audioBuffer = await context.decodeAudioData(ffmpegDecoded.slice(0));
      const monoSamples = downmixToMono(audioBuffer);

      return {
        audioBuffer,
        monoSamples,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration
      };
    } catch (ffmpegError) {
      if (isM4aFile(file)) {
        throw new Error(
          `Unable to decode this M4A file. Native decode and FFmpeg fallback both failed. ${m4aSupportHint()} Try re-exporting as AAC-LC (.m4a), WAV, or MP3.`
        );
      }

      const nativeMessage = nativeError instanceof Error ? nativeError.message : 'Unknown native decode error';
      const ffmpegMessage = ffmpegError instanceof Error ? ffmpegError.message : 'Unknown FFmpeg decode error';

      throw new Error(
        `Unable to decode audio data. Native decode failed: ${nativeMessage}. FFmpeg fallback failed: ${ffmpegMessage}`
      );
    }
  } finally {
    await context.close();
  }
}
