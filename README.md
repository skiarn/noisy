# Noisy

Noisy is a client-side audio analysis tool for investigating recurring environmental noise (for example tram squeal near curves). It lets you upload a recording, select a time range, analyze the selected section, and prepare a structured follow-up email with attached audio.

## Features

- Upload and decode local audio recordings directly in the browser.
- Interactive waveform with region selection for focused analysis.
- Noise statistics for the selected segment:
  - RMS amplitude and RMS dBFS
  - Peak amplitude and Peak dBFS
  - Crest factor
  - Dynamic range
- Frequency analysis (FFT) with low/mid/high relative band energy.
- Loudness timeline plus pass-by event detection (peak event time, duration, integrated noise energy).
- Export analysis results as JSON or CSV.
- Email workflow helpers:
  - Editable Swedish message template
  - Pre-filled mailto draft (recipient/subject/body)
  - Web Share API flow with generated audio attachment when supported
- Local persistence of email recipient, title, and template via localStorage.
- Fully client-side processing (no backend required for analysis).

## Tech Stack

- SvelteKit + Svelte 5
- TypeScript
- Tailwind CSS
- WaveSurfer.js (waveform visualization)
- Chart.js (charts)
- fft.js and Meyda (audio feature/spectral support)
- ffmpeg.wasm (@ffmpeg/ffmpeg) for in-browser audio transcoding fallback flow

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start development server

```bash
npm run dev
```

Open the local URL shown in your terminal.

### 3. Type and Svelte checks

```bash
npm run check
```

## Available Scripts

- `npm run dev` - Start Vite dev server.
- `npm run build` - Build production assets.
- `npm run preview` - Preview production build locally.
- `npm run check` - Run Svelte/TypeScript checks.
- `npm run check:watch` - Run checks in watch mode.

## How to Use

1. Upload an audio file.
2. Select the time region in the waveform.
3. Review statistics, spectrum, and loudness/pass-by metrics.
4. Export results as JSON/CSV if needed.
5. Use the email panel to generate and share a follow-up report with attachment.

## Notes

- Metrics are relative (dBFS) and are not calibrated SPL measurements.
- Browser capability affects attachment sharing behavior:
  - If Web Share with files is supported, sharing opens with the clip attached.
  - Otherwise, the clip is downloaded for manual attachment in email.
