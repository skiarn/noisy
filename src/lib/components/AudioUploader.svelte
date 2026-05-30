<script lang="ts">
  let { onFileSelected } = $props<{ onFileSelected: (file: File) => void }>();

  const acceptedTypes = '.wav,.mp3,.flac,.ogg,.m4a,audio/wav,audio/mpeg,audio/flac,audio/ogg,audio/mp4,audio/x-m4a,audio/aac';

  function handleChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) onFileSelected(file);
  }
</script>

<section class="panel p-5 md:p-6">
  <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 class="section-title">Upload Audio</h2>
      <p class="mt-1 text-sm text-[var(--muted)]">Supported formats: WAV, MP3, FLAC, OGG, M4A</p>
    </div>

    <label class="inline-flex cursor-pointer items-center gap-3 rounded-xl bg-[var(--accent)] px-4 py-2.5 font-medium text-white transition hover:brightness-110">
      <span>Select File</span>
      <input class="hidden" type="file" accept={acceptedTypes} onchange={handleChange} />
    </label>
  </div>
</section>
