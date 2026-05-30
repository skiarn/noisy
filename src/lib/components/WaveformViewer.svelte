<script lang="ts">
  import { onMount } from 'svelte';
  import WaveSurfer from 'wavesurfer.js';
  import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

  let {
    audioUrl,
    onRegionChange
  } = $props<{
    audioUrl: string | null;
    onRegionChange: (startSec: number, endSec: number) => void;
  }>();

  let containerElement: HTMLDivElement | null = null;
  let waveSurfer: WaveSurfer | null = null;
  let regionsPlugin: ReturnType<typeof RegionsPlugin.create> | null = null;

  function setDefaultRegion(duration: number): void {
    if (!regionsPlugin) return;

    regionsPlugin.clearRegions();
    const end = Math.max(0.25, Math.min(duration, Math.max(5, duration * 0.2)));
    const region = regionsPlugin.addRegion({
      id: 'analysis-region',
      start: 0,
      end,
      color: 'rgba(0, 122, 82, 0.25)',
      drag: true,
      resize: true
    });

    onRegionChange(region.start, region.end);
  }

  function togglePlayback(): void {
    waveSurfer?.playPause();
  }

  onMount(() => {
    if (!containerElement) return;

    waveSurfer = WaveSurfer.create({
      container: containerElement,
      waveColor: '#8ccfb0',
      progressColor: '#007a52',
      height: 160,
      normalize: true,
      dragToSeek: true,
      cursorColor: '#102218',
      barWidth: 2,
      barGap: 1
    });

    regionsPlugin = waveSurfer.registerPlugin(RegionsPlugin.create());

    waveSurfer.on('decode', () => {
      const duration = waveSurfer?.getDuration() ?? 0;
      setDefaultRegion(duration);
    });

    regionsPlugin.on('region-created', (region: { start: number; end: number }) => {
      onRegionChange(region.start, region.end);
    });

    regionsPlugin.on('region-updated', (region: { start: number; end: number }) => {
      onRegionChange(region.start, region.end);
    });

    return () => {
      waveSurfer?.destroy();
      waveSurfer = null;
      regionsPlugin = null;
    };
  });

  $effect(() => {
    if (!audioUrl || !waveSurfer) return;
    waveSurfer.load(audioUrl);
  });
</script>

<section class="panel p-5 md:p-6">
  <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <h2 class="section-title">Waveform</h2>
    <div class="flex flex-wrap items-center gap-3">
      <button
        class="rounded-lg border border-[var(--card-border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]"
        type="button"
        onclick={togglePlayback}
      >
        Play / Pause
      </button>
    </div>
  </div>

  <div bind:this={containerElement} class="min-h-[180px] rounded-lg bg-[#f3faf6] p-2"></div>

  <p class="mt-3 text-xs text-[var(--muted)]">
    Drag across the waveform to set the analysis region. Move and resize handles for start/end trim.
  </p>
</section>
