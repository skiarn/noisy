<script lang="ts">
    import type { TrainPassByMetrics } from "$lib/audio/loudness";
    import type { NoiseStatistics } from "$lib/audio/statistics";

    let {
        stats,
        passBy,
        selectedStart,
        selectedEnd,
        onExport,
        onOpenEmailDraft,
        onShareEmailWithAttachment,
        emailBusy,
        emailRecipient,
        onEmailRecipientChange,
        emailTitle,
        onEmailTitleChange,
        emailTemplateText,
        onEmailTemplateTextChange,
    } = $props<{
        stats: NoiseStatistics | null;
        passBy: TrainPassByMetrics | null;
        selectedStart: number;
        selectedEnd: number;
        onExport: (type: "json" | "csv") => void;
        onOpenEmailDraft: () => void;
        onShareEmailWithAttachment: () => Promise<void>;
        emailBusy: boolean;
        emailRecipient: string;
        onEmailRecipientChange: (value: string) => void;
        emailTitle: string;
        onEmailTitleChange: (value: string) => void;
        emailTemplateText: string;
        onEmailTemplateTextChange: (value: string) => void;
    }>();

    function format(value: number, digits = 3): string {
        if (!Number.isFinite(value)) return "N/A";
        return value.toFixed(digits);
    }

    function formatSeconds(seconds: number): string {
        if (!Number.isFinite(seconds)) return "N/A";
        const mm = Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0");
        const ss = Math.floor(seconds % 60)
            .toString()
            .padStart(2, "0");
        return `${mm}:${ss}`;
    }

    function handleRecipientInput(event: Event): void {
        const input = event.currentTarget as HTMLInputElement;
        onEmailRecipientChange(input.value);
    }

    function handleTitleInput(event: Event): void {
        const input = event.currentTarget as HTMLInputElement;
        onEmailTitleChange(input.value);
    }

    function handleTemplateInput(event: Event): void {
        const input = event.currentTarget as HTMLTextAreaElement;
        onEmailTemplateTextChange(input.value);
    }
</script>

<section class="panel p-5 md:p-6">
    <div
        class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
    >
        <div>
            <h2 class="section-title">Statistics</h2>
            <p class="mt-1 text-sm text-[var(--muted)]">
                Start: {formatSeconds(selectedStart)} | End: {formatSeconds(
                    selectedEnd,
                )} | Length: {formatSeconds(selectedEnd - selectedStart)}
            </p>
        </div>

        <div class="flex flex-wrap gap-2 md:justify-end">
            <button
                class="rounded-lg border border-[var(--card-border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]"
                type="button"
                onclick={() => onExport("json")}
            >
                Export JSON
            </button>
            <button
                class="rounded-lg border border-[var(--card-border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]"
                type="button"
                onclick={() => onExport("csv")}
            >
                Export CSV
            </button>
            <button
                class="rounded-lg border border-[var(--card-border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[var(--accent)]"
                type="button"
                onclick={onOpenEmailDraft}
            >
                Oppna E-postutkast
            </button>
            <button
                class="rounded-lg border border-[var(--card-border)] bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onclick={onShareEmailWithAttachment}
                disabled={emailBusy}
            >
                {emailBusy ? "Forbereder bilaga..." : "Dela e-post + MP4-klipp"}
            </button>
        </div>
    </div>

    <div class="mt-4 w-full">
        <div class="flex w-full flex-col gap-2">
            <label
                class="text-xs uppercase tracking-wide text-[var(--muted)]"
                for="email-recipient-input"
            >
                Email mottagare
            </label>
            <input
                id="email-recipient-input"
                class="w-full rounded-lg border border-[var(--card-border)] bg-white px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                type="email"
                value={emailRecipient}
                oninput={handleRecipientInput}
                placeholder="namn@exempel.se"
            />

            <label
                class="mt-2 text-xs uppercase tracking-wide text-[var(--muted)]"
                for="email-title-input"
            >
                Ämne
            </label>
            <input
                id="email-title-input"
                class="w-full rounded-lg border border-[var(--card-border)] bg-white px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                type="text"
                value={emailTitle}
                oninput={handleTitleInput}
                placeholder="Uppföljning ärende [buller spårtrafik]"
            />

            <label
                class="mt-2 text-xs uppercase tracking-wide text-[var(--muted)]"
                for="email-template-input"
            >
                Meddelandemall
            </label>
            <textarea
                id="email-template-input"
                class="min-h-[180px] w-full rounded-lg border border-[var(--card-border)] bg-white px-3 py-2 text-sm leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)]"
                value={emailTemplateText}
                oninput={handleTemplateInput}
                placeholder="Skriv din mall har."
            ></textarea>
        </div>
    </div>

    {#if stats}
        <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article class="rounded-xl bg-[var(--accent-soft)] p-3">
                <p class="text-xs uppercase tracking-wide text-[var(--muted)]">
                    Recording Length
                </p>
                <p class="metric-value">
                    {format(stats.recordingDurationSec, 2)} s
                </p>
            </article>

            <article class="rounded-xl bg-[var(--accent-soft)] p-3">
                <p class="text-xs uppercase tracking-wide text-[var(--muted)]">
                    Peak Amplitude
                </p>
                <p class="metric-value">{format(stats.peakAmplitude)}</p>
            </article>

            <article class="rounded-xl bg-[var(--accent-soft)] p-3">
                <p class="text-xs uppercase tracking-wide text-[var(--muted)]">
                    RMS Loudness
                </p>
                <p class="metric-value">{format(stats.rmsAmplitude)}</p>
            </article>

            <article class="rounded-xl bg-[var(--accent-soft)] p-3">
                <p class="text-xs uppercase tracking-wide text-[var(--muted)]">
                    Dynamic Range
                </p>
                <p class="metric-value">{format(stats.dynamicRange)}</p>
            </article>

            <article class="rounded-xl bg-[var(--accent-soft)] p-3">
                <p class="text-xs uppercase tracking-wide text-[var(--muted)]">
                    Crest Factor
                </p>
                <p class="metric-value">{format(stats.crestFactor)}</p>
            </article>

            <article class="rounded-xl bg-[var(--accent-soft)] p-3">
                <p class="text-xs uppercase tracking-wide text-[var(--muted)]">
                    Average dBFS / Peak dBFS
                </p>
                <p class="metric-value">
                    {format(stats.rmsDbfs, 1)} / {format(stats.peakDbfs, 1)} dBFS
                </p>
            </article>
        </div>

        {#if passBy}
            <div
                class="mt-4 rounded-xl border border-[var(--card-border)] bg-white/75 p-4"
            >
                <h3 class="font-semibold">Train Pass-By Metrics</h3>
                <div
                    class="mt-2 grid grid-cols-1 gap-2 text-sm text-[var(--muted)] sm:grid-cols-3"
                >
                    <p>
                        Peak event time: {format(passBy.peakEventTimeSec, 2)} s
                    </p>
                    <p>
                        Event duration: {format(passBy.eventDurationSec, 2)} s
                    </p>
                    <p>Noise energy: {format(passBy.noiseEnergy, 5)}</p>
                </div>
            </div>
        {/if}

        <p
            class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-[var(--warn)]"
        >
            Consumer recordings are shown as relative dBFS values. Accurate SPL
            (dB) needs microphone calibration.
        </p>
    {/if}
</section>
