<script lang="ts">
  import { onMount } from 'svelte';
  import {
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    LinearScale,
    Tooltip,
    Legend,
    type ChartConfiguration
  } from 'chart.js';
  import type { SpectrumData } from '$lib/audio/fft';

  Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

  let { spectrum } = $props<{ spectrum: SpectrumData | null }>();

  let canvasEl: HTMLCanvasElement | null = null;
  let chart: Chart | null = null;

  function updateChart(data: SpectrumData | null): void {
    if (!chart || !data) return;

    chart.data.labels = ['Low (20-250 Hz)', 'Mid (250-2k Hz)', 'High (2k-20k Hz)'];
    chart.data.datasets[0].data = [data.bandEnergy.low, data.bandEnergy.mid, data.bandEnergy.high];
    chart.update('none');
  }

  onMount(() => {
    if (!canvasEl) return;

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: ['Low (20-250 Hz)', 'Mid (250-2k Hz)', 'High (2k-20k Hz)'],
        datasets: [
          {
            label: 'Relative Energy',
            data: [0, 0, 0],
            backgroundColor: ['#50b689', '#1f9d69', '#0f7f53']
          }
        ]
      },
      options: {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            labels: {
              color: '#2b4437',
              boxWidth: 12,
              boxHeight: 12
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#2b4437',
              maxRotation: 0,
              minRotation: 0
            },
            grid: {
              color: 'rgba(16, 34, 24, 0.08)'
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#2b4437',
              maxTicksLimit: 6
            },
            grid: {
              color: 'rgba(16, 34, 24, 0.08)'
            }
          }
        }
      }
    };

    chart = new Chart(canvasEl, config);
    updateChart(spectrum);

    return () => chart?.destroy();
  });

  $effect(() => {
    updateChart(spectrum);
  });
</script>

<section class="panel p-5 md:p-6">
  <h2 class="section-title">Frequency Spectrum</h2>
  <p class="mt-1 text-sm text-[var(--muted)]">Band energy from FFT in low/mid/high ranges.</p>
  <div class="mt-4 h-[260px]">
    <canvas bind:this={canvasEl}></canvas>
  </div>
</section>
