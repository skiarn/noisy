<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Chart,
    CategoryScale,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip,
    Legend,
    type ChartConfiguration
  } from 'chart.js';
  import type { LoudnessPoint } from '$lib/audio/loudness';

  Chart.register(
    CategoryScale,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip,
    Legend
  );

  let { points } = $props<{ points: LoudnessPoint[] }>();

  let canvasEl: HTMLCanvasElement | null = null;
  let chart: Chart | null = null;

  function update(pointsToPlot: LoudnessPoint[]): void {
    if (!chart) return;

    const labelStride = Math.max(1, Math.ceil(pointsToPlot.length / 12));
    chart.data.labels = pointsToPlot.map((point, index) =>
      index % labelStride === 0 ? point.timeSec.toFixed(1) : ''
    );
    chart.data.datasets[0].data = pointsToPlot.map((point) => point.dbfs);
    chart.update('none');
  }

  onMount(() => {
    if (!canvasEl) return;

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Loudness (dBFS)',
            data: [],
            borderColor: '#007a52',
            backgroundColor: 'rgba(0, 122, 82, 0.15)',
            fill: true,
            tension: 0.25,
            pointRadius: 0
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
              color: '#2b4437'
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#2b4437',
              maxRotation: 0,
              autoSkip: false
            },
            grid: {
              color: 'rgba(16, 34, 24, 0.08)'
            },
            title: {
              display: true,
              text: 'Time (s)',
              color: '#2b4437'
            }
          },
          y: {
            ticks: {
              color: '#2b4437',
              maxTicksLimit: 6
            },
            grid: {
              color: 'rgba(16, 34, 24, 0.08)'
            },
            title: {
              display: true,
              text: 'dBFS',
              color: '#2b4437'
            }
          }
        }
      }
    };

    chart = new Chart(canvasEl, config);
    update(points);

    return () => chart?.destroy();
  });

  $effect(() => {
    update(points);
  });
</script>

<section class="panel p-5 md:p-6">
  <h2 class="section-title">Loudness Timeline</h2>
  <p class="mt-1 text-sm text-[var(--muted)]">Time vs loudness to visualize pass-by rise and decay.</p>
  <div class="mt-4 h-[260px]">
    <canvas bind:this={canvasEl}></canvas>
  </div>
</section>
