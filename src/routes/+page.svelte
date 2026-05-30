<script lang="ts">
    import { onMount } from "svelte";
    import AudioUploader from "$lib/components/AudioUploader.svelte";
    import LoudnessChart from "$lib/components/LoudnessChart.svelte";
    import SpectrumChart from "$lib/components/SpectrumChart.svelte";
    import StatisticsPanel from "$lib/components/StatisticsPanel.svelte";
    import WaveformViewer from "$lib/components/WaveformViewer.svelte";
    import {
        audioBufferToWavBlob,
        decodeAudioFile,
        transcodeWavBlobToMp4File,
        type DecodedAudio,
    } from "$lib/audio/decoder";
    import { computeSpectrum } from "$lib/audio/fft";
    import {
        buildLoudnessTimeline,
        detectTrainPassBy,
    } from "$lib/audio/loudness";
    import { computeNoiseStatistics } from "$lib/audio/statistics";
    import { audioStore } from "$lib/stores/audioStore";

    let audioUrl = $state<string | null>(null);
    let decodedAudio = $state<DecodedAudio | null>(null);
    let selectedStart = $state(0);
    let selectedEnd = $state(0);
    let emailBusy = $state(false);
    let emailNote = $state<string | null>(null);
    let emailRecipient = $state("");
    let emailTitle = $state(getDefaultEmailTitle(new Date()));
    let emailTemplateText = $state("");
    let emailTitleIsCustom = $state(false);

    const RECIPIENT_STORAGE_KEY = "noisy.emailRecipient";
    const TITLE_STORAGE_KEY = "noisy.emailTitle";
    const TEMPLATE_STORAGE_KEY = "noisy.emailTemplate";

    type NavWithShare = Navigator & {
        canShare?: (data?: ShareData) => boolean;
    };

    onMount(() => {
        const savedRecipient = localStorage.getItem(RECIPIENT_STORAGE_KEY);
        if (savedRecipient) emailRecipient = savedRecipient;

        const savedTitle = localStorage.getItem(TITLE_STORAGE_KEY);
        if (savedTitle) {
            emailTitle = savedTitle;
            emailTitleIsCustom = true;
        } else {
            emailTitle = getDefaultEmailTitle(new Date());
        }

        const savedTemplate = localStorage.getItem(TEMPLATE_STORAGE_KEY);
        emailTemplateText = savedTemplate || getDefaultMessageTemplate();
    });

    function getDefaultMessageTemplate(): string {
        return [
            "Hej,",
            "",
            "Jag följer härmed upp ärende [avseende bullerstörningar] från spårvagnstrafiken vid svängen nära [plats].",
            "Sedan föregående kontakt har störningarna fortsatt med liknande eller ökad frekvens. Nedan följer en sammanfattning av aktuella observationer:",
            "Period: ",
            "",
            "Återkommande gnissel vid passage, särskilt under [tider, t.ex. kväll/morgon]",
            "Upplevd påverkan: [störd i mitt hem / hög ljudnivå inomhus]",
            "",
            "Jag har även kompletterat med ytterligare ljudinspelningar från ovan period, vilka jag bifogar.",
            "Jag önskar att detta material löpande inkluderas i ärende bullerstörningar.",
            "",
            "Med vänlig hälsning,",
        ].join("\n");
    }

    function getSegmentSamples(
        samples: Float32Array,
        sampleRate: number,
        startSec: number,
        endSec: number,
    ): Float32Array {
        const startIndex = Math.max(0, Math.floor(startSec * sampleRate));
        const endIndex = Math.max(
            startIndex + 1,
            Math.floor(endSec * sampleRate),
        );
        return samples.slice(startIndex, Math.min(endIndex, samples.length));
    }

    function getRecordingDate(file: File): Date {
        return Number.isFinite(file.lastModified) && file.lastModified > 0
            ? new Date(file.lastModified)
            : new Date();
    }

    function getDefaultEmailTitle(date: Date): string {
        return `Uppföljning ${date.toLocaleDateString("sv-SE")} – ärende [buller spårtrafik]`;
    }

    async function onFileSelected(file: File): Promise<void> {
        audioStore.update((state) => ({
            ...state,
            loading: true,
            error: null,
        }));

        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            audioUrl = null;
        }

        if (!emailTitleIsCustom) {
            emailTitle = getDefaultEmailTitle(getRecordingDate(file));
            localStorage.setItem(TITLE_STORAGE_KEY, emailTitle);
        }

        try {
            decodedAudio = await decodeAudioFile(file);
            const wavBlob = audioBufferToWavBlob(decodedAudio.audioBuffer);
            audioUrl = URL.createObjectURL(wavBlob);
            selectedStart = 0;
            selectedEnd = Math.min(
                decodedAudio.duration,
                Math.max(5, decodedAudio.duration * 0.2),
            );

            audioStore.update((state) => ({
                ...state,
                fileName: file.name,
                decodedAudio,
                region: {
                    startSec: selectedStart,
                    endSec: selectedEnd,
                },
                loading: false,
                error: null,
            }));

            runAnalysis(selectedStart, selectedEnd);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to decode audio file.";
            audioStore.update((state) => ({
                ...state,
                loading: false,
                error: message,
            }));
        }
    }

    function onRegionChange(startSec: number, endSec: number): void {
        selectedStart = startSec;
        selectedEnd = endSec;
        runAnalysis(startSec, endSec);
    }

    function runAnalysis(startSec: number, endSec: number): void {
        if (!decodedAudio) return;

        const segment = getSegmentSamples(
            decodedAudio.monoSamples,
            decodedAudio.sampleRate,
            startSec,
            endSec,
        );
        const statistics = computeNoiseStatistics(
            segment,
            decodedAudio.sampleRate,
            decodedAudio.duration,
        );
        const spectrum = computeSpectrum(segment, decodedAudio.sampleRate);
        const loudnessTimeline = buildLoudnessTimeline(
            segment,
            decodedAudio.sampleRate,
        );
        const passByMetrics = detectTrainPassBy(loudnessTimeline);

        audioStore.update((state) => ({
            ...state,
            region: { startSec, endSec },
            statistics,
            spectrum,
            loudnessTimeline,
            passByMetrics,
        }));
    }

    function downloadFile(
        fileName: string,
        content: string,
        mimeType: string,
    ): void {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    function downloadBlob(fileName: string, blob: Blob): void {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    function formatMetric(value: number, digits = 2): string {
        if (!Number.isFinite(value)) return "N/A";
        return value.toFixed(digits);
    }

    function formatTimestamp(seconds: number): string {
        if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
        const mm = Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0");
        const ss = Math.floor(seconds % 60)
            .toString()
            .padStart(2, "0");
        return `${mm}:${ss}`;
    }

    function setEmailRecipient(value: string): void {
        emailRecipient = value;
        localStorage.setItem(RECIPIENT_STORAGE_KEY, value);
    }

    function setEmailTitle(value: string): void {
        emailTitle = value;
        localStorage.setItem(TITLE_STORAGE_KEY, value);
    }

    function setEmailTemplateText(value: string): void {
        emailTemplateText = value;
        localStorage.setItem(TEMPLATE_STORAGE_KEY, value);
    }

    function getMailtoTarget(): string {
        const recipient = emailRecipient.trim();
        return recipient
            ? `mailto:${encodeURIComponent(recipient)}`
            : "mailto:";
    }

    function buildEmailTemplate(): { subject: string; body: string } {
        const state = $audioStore;
        const now = new Date();
        const stats = state.statistics;
        const spectrum = state.spectrum;
        const passBy = state.passByMetrics;
        const segmentLength = Math.max(0, selectedEnd - selectedStart);
        const intervalLabel = `${formatTimestamp(selectedStart)}-${formatTimestamp(selectedEnd)}`;
        const templateRaw = (
            emailTemplateText || getDefaultMessageTemplate()
        ).trim();
        const messageIntro = templateRaw;
        const subjectTitle =
            emailTitle.trim() || getDefaultEmailTitle(new Date());
        const subject = `${subjectTitle} | ${now.toLocaleDateString("sv-SE")} | ${intervalLabel}`;
        const body = [
            messageIntro,
            "",
            "For transparens bifogas analys av vald ljudsektion:",
            `Fil: ${state.fileName || "N/A"}`,
            `Skapad: ${now.toLocaleString("sv-SE")}`,
            `Valt intervall: ${formatTimestamp(selectedStart)} - ${formatTimestamp(selectedEnd)} (${formatMetric(segmentLength, 2)} s)`,
            "",
            "Nyckeltal:",
            `- RMS-niva: ${formatMetric(stats?.rmsAmplitude ?? NaN, 4)} (${formatMetric(stats?.rmsDbfs ?? NaN, 1)} dBFS)`,
            `- Toppamplitud: ${formatMetric(stats?.peakAmplitude ?? NaN, 4)} (${formatMetric(stats?.peakDbfs ?? NaN, 1)} dBFS)`,
            `- Crest factor: ${formatMetric(stats?.crestFactor ?? NaN, 2)}`,
            `- Dynamiskt omfong: ${formatMetric(stats?.dynamicRange ?? NaN, 4)}`,
            "",
            "Frekvensband (relativ energi):",
            `- Lag (20-250 Hz): ${formatMetric(spectrum?.bandEnergy.low ?? NaN, 6)}`,
            `- Mellan (250-2000 Hz): ${formatMetric(spectrum?.bandEnergy.mid ?? NaN, 6)}`,
            `- Hog (2k-20k Hz): ${formatMetric(spectrum?.bandEnergy.high ?? NaN, 6)}`,
            "",
            "Tagpassage:",
            `- Tid for topphandelse: ${formatMetric(passBy?.peakEventTimeSec ?? NaN, 2)} s`,
            `- Handelsens varaktighet: ${formatMetric(passBy?.eventDurationSec ?? NaN, 2)} s`,
            `- Integrerad ljudenergi: ${formatMetric(passBy?.noiseEnergy ?? NaN, 6)}`,
            "",
            "Notering:",
            "- Varden visas i relativ dBFS och ar inte kalibrerade SPL-matningar.",
        ].join("\n");

        return { subject, body };
    }

    function openEmailDraft(): void {
        const { subject, body } = buildEmailTemplate();
        const mailtoUrl = `${getMailtoTarget()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
    }

    function createSelectedSegmentBuffer(
        buffer: AudioBuffer,
        startSec: number,
        endSec: number,
    ): AudioBuffer {
        const sampleRate = buffer.sampleRate;
        const startFrame = Math.max(0, Math.floor(startSec * sampleRate));
        const endFrame = Math.min(
            buffer.length,
            Math.max(startFrame + 1, Math.floor(endSec * sampleRate)),
        );
        const length = Math.max(1, endFrame - startFrame);

        const segment = new AudioBuffer({
            length,
            numberOfChannels: buffer.numberOfChannels,
            sampleRate,
        });

        for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            const source = buffer
                .getChannelData(channel)
                .subarray(startFrame, endFrame);
            segment.copyToChannel(source, channel, 0);
        }

        return segment;
    }

    async function shareEmailWithAttachment(): Promise<void> {
        if (!decodedAudio) return;
        emailBusy = true;
        emailNote = null;

        try {
            const segmentBuffer = createSelectedSegmentBuffer(
                decodedAudio.audioBuffer,
                selectedStart,
                selectedEnd,
            );
            const segmentWav = audioBufferToWavBlob(segmentBuffer);
            const state = $audioStore;
            const safeName = (state.fileName || "recording").replace(
                /\.[^/.]+$/,
                "",
            );
            const clipName = `${safeName}-segment-${formatMetric(selectedStart, 0)}-${formatMetric(selectedEnd, 0)}.mp4`;

            let attachment: File;
            try {
                attachment = await transcodeWavBlobToMp4File(
                    segmentWav,
                    clipName,
                );
            } catch {
                attachment = new File(
                    [segmentWav],
                    clipName.replace(/\.mp4$/i, ".wav"),
                    { type: "audio/wav" },
                );
            }

            const { subject, body } = buildEmailTemplate();
            const navigatorWithShare = navigator as NavWithShare;

            if (
                typeof navigatorWithShare.share === "function" &&
                (!navigatorWithShare.canShare ||
                    navigatorWithShare.canShare({ files: [attachment] }))
            ) {
                await navigatorWithShare.share({
                    title: subject,
                    text: body,
                    files: [attachment],
                });
                emailNote =
                    "Delningspanelen oppnades med rapporttext och valt klipp som bilaga.";
                return;
            }

            downloadBlob(attachment.name, attachment);
            openEmailDraft();
            emailNote =
                "Din webblasare kan inte bifoga filer direkt i e-postutkast. Klippet laddades ned for manuell bilaga.";
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                emailNote = "Delning avbrots.";
                return;
            }

            const message =
                error instanceof Error
                    ? error.message
                    : "Kunde inte forbereda e-postbilagan.";
            emailNote = message;
        } finally {
            emailBusy = false;
        }
    }

    function handleExport(type: "json" | "csv"): void {
        const state = $audioStore;
        if (
            !state.statistics ||
            !state.spectrum ||
            !state.passByMetrics ||
            !state.fileName
        )
            return;

        const payload = {
            fileName: state.fileName,
            generatedAtIso: new Date().toISOString(),
            region: state.region,
            statistics: state.statistics,
            spectrumBands: state.spectrum.bandEnergy,
            passByMetrics: state.passByMetrics,
        };

        if (type === "json") {
            downloadFile(
                `${state.fileName}-analysis.json`,
                JSON.stringify(payload, null, 2),
                "application/json",
            );
            return;
        }

        const rows = [
            ["key", "value"],
            ["fileName", payload.fileName],
            ["generatedAtIso", payload.generatedAtIso],
            ["region.startSec", payload.region.startSec.toString()],
            ["region.endSec", payload.region.endSec.toString()],
            ["stats.rmsDbfs", payload.statistics.rmsDbfs.toString()],
            ["stats.peakDbfs", payload.statistics.peakDbfs.toString()],
            [
                "stats.peakAmplitude",
                payload.statistics.peakAmplitude.toString(),
            ],
            ["stats.rmsAmplitude", payload.statistics.rmsAmplitude.toString()],
            ["bands.low", payload.spectrumBands.low.toString()],
            ["bands.mid", payload.spectrumBands.mid.toString()],
            ["bands.high", payload.spectrumBands.high.toString()],
            [
                "passBy.peakEventTimeSec",
                payload.passByMetrics.peakEventTimeSec.toString(),
            ],
            [
                "passBy.eventDurationSec",
                payload.passByMetrics.eventDurationSec.toString(),
            ],
            [
                "passBy.noiseEnergy",
                payload.passByMetrics.noiseEnergy.toString(),
            ],
        ];

        const csv = rows.map((row) => row.join(",")).join("\n");
        downloadFile(
            `${state.fileName}-analysis.csv`,
            csv,
            "text/csv;charset=utf-8",
        );
    }
</script>

<main class="noisy-shell">
    <header class="mb-6">
        <p class="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
            Client-Side Environmental Analysis
        </p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight md:text-5xl">
            Noisy
        </h1>
        <p class="mt-3 max-w-3xl text-sm text-[var(--muted)] md:text-base">
            Upload a recording, select a waveform region, and inspect relative
            dBFS, FFT bands, and noisy pass-by behavior.
        </p>
    </header>

    <div class="grid gap-5">
        <AudioUploader {onFileSelected} />

        {#if $audioStore.loading}
            <section class="panel p-5 text-sm text-[var(--muted)]">
                Decoding and preparing waveform...
            </section>
        {/if}

        {#if $audioStore.error}
            <section
                class="panel border-red-200 bg-red-50 p-5 text-sm text-red-700"
            >
                {$audioStore.error}
            </section>
        {/if}

        {#if audioUrl}
            <WaveformViewer {audioUrl} {onRegionChange} />
            <StatisticsPanel
                stats={$audioStore.statistics}
                passBy={$audioStore.passByMetrics}
                {selectedStart}
                {selectedEnd}
                onExport={handleExport}
                onOpenEmailDraft={openEmailDraft}
                onShareEmailWithAttachment={shareEmailWithAttachment}
                {emailBusy}
                {emailRecipient}
                onEmailRecipientChange={setEmailRecipient}
                {emailTitle}
                onEmailTitleChange={setEmailTitle}
                {emailTemplateText}
                onEmailTemplateTextChange={setEmailTemplateText}
            />
            {#if emailNote}
                <section
                    class="panel border-sky-200 bg-sky-50 p-4 text-sm text-sky-800"
                >
                    {emailNote}
                </section>
            {/if}
            <div class="grid gap-5 lg:grid-cols-2">
                <SpectrumChart spectrum={$audioStore.spectrum} />
                <LoudnessChart points={$audioStore.loudnessTimeline} />
            </div>
        {/if}
    </div>
</main>
