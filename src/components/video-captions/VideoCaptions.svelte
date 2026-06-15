<script lang="ts">
  import Button from '../ui/Button.svelte';
  import { toastState } from '../../lib/toast.svelte';
  import {
    buildCaptionPreviewSections,
    buildEditedTimestamps,
    type CaptionPreviewSection,
    type CaptionPreviewWord,
    type CaptionReviewDecision,
    type CaptionReviewIssue,
    type CaptionReviewIssueKind,
  } from '../../lib/video-captions/preview';
  import {
    ENGINE_TOKEN_STORAGE_KEY,
    ENGINE_URL_STORAGE_KEY,
    createJob,
    downloadOutput,
    getHealth,
    getJob,
    parseEngineConnectionInput,
    startAlignment,
    startRender,
    uploadVideo,
    type CaptionJob,
    type CaptionLanguage,
    type CaptionMode,
    type CaptionPosition,
    type CaptionPreset,
    type EngineConnection,
    type EngineHealth,
    type TimestampsFile,
    type WhisperModel,
    validateSession,
  } from '../../lib/video-captions/client';

  interface Props {
    onback: () => void;
  }

  type InputMode = 'script' | 'manual';
  type ReviewIssueKind = CaptionReviewIssueKind;
  type ReviewDecision = CaptionReviewDecision;
  type ReviewIssue = CaptionReviewIssue;

  interface CaptionPresetDefaults {
    mode: CaptionMode;
    position: CaptionPosition;
    fontSize: number;
    maxWordsPerLine: number;
    primaryColor: string;
    highlightColor: string;
  }

  const CAPTION_PRESET_DEFAULTS: Record<CaptionPreset, CaptionPresetDefaults> = {
    youtube: {
      mode: 'phrase',
      position: 'bottom',
      fontSize: 48,
      maxWordsPerLine: 9,
      primaryColor: '#FFFFFF',
      highlightColor: '#FFD400',
    },
    shorts: {
      mode: 'karaoke',
      position: 'center',
      fontSize: 68,
      maxWordsPerLine: 3,
      primaryColor: '#FFFFFF',
      highlightColor: '#00FF66',
    },
    minimal: {
      mode: 'normal',
      position: 'bottom',
      fontSize: 42,
      maxWordsPerLine: 10,
      primaryColor: '#FFFFFF',
      highlightColor: '#FFFFFF',
    },
  };

  let { onback }: Props = $props();

  let videoInput: HTMLInputElement;
  let timestampsInput: HTMLInputElement;
  let engineUrl = $state(localStorage.getItem(ENGINE_URL_STORAGE_KEY) ?? 'http://127.0.0.1:4777');
  let engineToken = $state(localStorage.getItem(ENGINE_TOKEN_STORAGE_KEY) ?? '');
  let connection = $state<EngineConnection | null>(null);
  let health = $state<EngineHealth | null>(null);
  let isConnecting = $state(false);
  let isBusy = $state(false);
  let file = $state<File | null>(null);
  let job = $state<CaptionJob | null>(null);
  let error = $state('');
  let status = $state('');
  let progress = $state(0);
  let outputUrl = $state<string | null>(null);
  let outputName = $state('');
  let videoPreviewUrl = $state<string | null>(null);
  let inputMode = $state<InputMode>('script');
  let scriptText = $state('');
  let timedScriptText = $state('');
  let timestampsText = $state(sampleTimestampsText());
  let language = $state<CaptionLanguage>('de');
  let whisperModel = $state<WhisperModel>('medium');
  let preset = $state<CaptionPreset>('youtube');
  let mode = $state<CaptionMode>(CAPTION_PRESET_DEFAULTS.youtube.mode);
  let position = $state<CaptionPosition>(CAPTION_PRESET_DEFAULTS.youtube.position);
  let fontSize = $state(CAPTION_PRESET_DEFAULTS.youtube.fontSize);
  let maxWordsPerLine = $state(CAPTION_PRESET_DEFAULTS.youtube.maxWordsPerLine);
  let primaryColor = $state(CAPTION_PRESET_DEFAULTS.youtube.primaryColor);
  let highlightColor = $state(CAPTION_PRESET_DEFAULTS.youtube.highlightColor);
  let keywords = $state('');
  let baseReviewTimestamps = $state<TimestampsFile | null>(null);
  let editableTimestamps = $state<TimestampsFile | null>(null);
  let reviewIssues = $state<ReviewIssue[]>([]);
  let selectedReviewSectionId = $state('');
  let reviewConfirmed = $state(false);
  let sectionStopAt = $state<number | null>(null);
  let reviewVideo = $state<HTMLVideoElement | undefined>();
  let reviewScrollContainer = $state<HTMLDivElement | undefined>();

  const isConnected = $derived(Boolean(connection && health?.ok));
  const alignmentReady = $derived(Boolean(health?.alignmentReady));
  const hasGeneratedTimings = $derived(Boolean(job?.hasTimestamps));
  const resolvedReviewIssueCount = $derived(reviewIssues.filter((issue) => issue.decision).length);
  const unresolvedReviewIssueCount = $derived(reviewIssues.length - resolvedReviewIssueCount);
  const reviewSections = $derived(baseReviewTimestamps
    ? buildCaptionPreviewSections(baseReviewTimestamps, reviewIssues, { mode, maxWordsPerLine })
    : []
  );
  const scriptTimingsAreStale = $derived(Boolean(
    inputMode === 'script' && hasGeneratedTimings && scriptText.trim() !== timedScriptText
  ));

  $effect(() => {
    const url = outputUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  $effect(() => {
    const url = videoPreviewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  function handleVideoSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const selected = input.files?.[0];
    if (selected) selectVideo(selected);
    input.value = '';
  }

  function handleTimestampsSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const selected = input.files?.[0];
    if (!selected) return;

    selected.text().then((text) => {
      timestampsText = text;
      inputMode = 'manual';
      toastState.success('Timestamp JSON loaded.');
    }).catch((err) => {
      error = getErrorMessage(err);
      toastState.error('Could not read timestamp JSON.');
    });
    input.value = '';
  }

  function selectVideo(selected: File) {
    clearOutput();
    resetReviewState();
    error = '';
    job = null;
    file = selected;
    videoPreviewUrl = URL.createObjectURL(selected);
    timedScriptText = '';
    status = 'Video selected.';
    progress = 0;
  }

  async function connectEngine() {
    isConnecting = true;
    error = '';

    try {
      const parsed = parseEngineConnectionInput(engineUrl, engineToken);
      if (!parsed.token) {
        throw new Error('Paste the full engine connection URL including ?token=... or enter the token.');
      }
      const engineHealth = await getHealth(parsed);
      if (!engineHealth.ok) {
        throw new Error('The local engine is running, but FFmpeg or ffprobe is unavailable.');
      }
      await validateSession(parsed);

      connection = parsed;
      health = engineHealth;
      engineUrl = parsed.baseUrl;
      engineToken = parsed.token;
      localStorage.setItem(ENGINE_URL_STORAGE_KEY, parsed.baseUrl);
      localStorage.setItem(ENGINE_TOKEN_STORAGE_KEY, parsed.token);
      status = 'Local engine connected.';
      toastState.success('Video captions engine connected.');
    } catch (err) {
      connection = null;
      health = null;
      error = getErrorMessage(err);
      toastState.error('Could not connect to local engine.');
    } finally {
      isConnecting = false;
    }
  }

  function disconnectEngine() {
    connection = null;
    health = null;
    status = 'Local engine disconnected.';
  }

  async function generateTimings() {
    if (!connection || !file || isBusy) return;

    clearOutput();
    error = '';
    isBusy = true;
    progress = 0.1;

    try {
      let currentJob = await ensureUploadedJob(connection);
      status = 'Starting WhisperX alignment...';
      progress = 0.4;
      currentJob = await startAlignment(connection, currentJob.id, {
        script: scriptText.trim() || undefined,
        language,
        model: whisperModel,
      });
      job = currentJob;

      currentJob = await pollUntil(connection, currentJob.id, (candidate) =>
        candidate.hasTimestamps || candidate.status === 'failed' || candidate.status === 'cancelled'
      );
      job = currentJob;

      if (!currentJob.hasTimestamps) {
        throw new Error(currentJob.error || currentJob.progressLabel);
      }

      status = 'Timings ready. Render captions next.';
      timedScriptText = scriptText.trim();
      initializeReviewState(currentJob);
      progress = 1;
      toastState.success(scriptText.trim() ? 'Script timings generated.' : 'Whisper timings generated.');
    } catch (err) {
      error = getErrorMessage(err);
      status = '';
      progress = 0;
      toastState.error('Timing generation failed.');
    } finally {
      isBusy = false;
    }
  }

  async function renderCaptions() {
    if (!connection || !file || isBusy) return;

    clearOutput();
    error = '';
    isBusy = true;
    progress = inputMode === 'manual' ? 0.1 : 0.6;

    try {
      let timestamps: TimestampsFile | undefined;
      if (inputMode === 'manual') {
        timestamps = parseTimestamps(timestampsText);
      }

      let currentJob = await ensureUploadedJob(connection);
      if (inputMode === 'script' && !currentJob.hasTimestamps) {
        throw new Error('Generate script timings before rendering.');
      }
      if (inputMode === 'script' && scriptTimingsAreStale) {
        throw new Error('Script changed after timings were generated. Regenerate timings before rendering.');
      }
      if (inputMode === 'script') {
        timestamps = editableTimestamps ?? currentJob.reviewedTimestamps;
        if (!timestamps) {
          throw new Error('No script timings are available. Generate timings before rendering.');
        }
      }

      const reviewWarning = renderReviewWarning();
      status = reviewWarning
        ? `Starting render with ${reviewWarning}...`
        : 'Starting render...';
      progress = 0.65;
      currentJob = await startRender(connection, currentJob.id, {
        timestamps,
        preset,
        mode,
        style: {
          fontSize,
          primaryColor,
          highlightColor,
          position,
          maxWordsPerLine,
        },
        keywords: parseKeywords(keywords),
      });
      job = currentJob;

      currentJob = await pollUntil(connection, currentJob.id, (candidate) =>
        candidate.status === 'complete' || candidate.status === 'failed' || candidate.status === 'cancelled'
      );
      job = currentJob;

      if (currentJob.status !== 'complete') {
        throw new Error(currentJob.error || currentJob.progressLabel);
      }

      status = 'Downloading output...';
      progress = 0.95;
      const blob = await downloadOutput(connection, currentJob.id);
      outputUrl = URL.createObjectURL(blob);
      outputName = currentJob.outputFileName || makeOutputName(file.name);
      status = 'Render complete.';
      progress = 1;
      toastState.success('Captioned video rendered.');
    } catch (err) {
      error = getErrorMessage(err);
      status = '';
      progress = 0;
      toastState.error('Video caption render failed.');
    } finally {
      isBusy = false;
    }
  }

  function resetReviewState() {
    baseReviewTimestamps = null;
    editableTimestamps = null;
    reviewIssues = [];
    selectedReviewSectionId = '';
    reviewConfirmed = false;
    sectionStopAt = null;
    reviewVideo?.pause();
  }

  function initializeReviewState(currentJob: CaptionJob) {
    const base = currentJob.reviewedTimestamps ? cloneTimestamps(currentJob.reviewedTimestamps) : null;
    const issues = buildReviewIssues(currentJob);

    baseReviewTimestamps = base;
    reviewIssues = issues;
    editableTimestamps = base ? buildEditedTimestamps(base, issues) : null;
    selectedReviewSectionId = issues[0] ? findSectionIdForIssue(issues[0].id) : '';
    reviewConfirmed = false;
    sectionStopAt = null;

    if (issues[0]) {
      seekReviewRange(issues[0]);
    }
  }

  function buildReviewIssues(currentJob: CaptionJob): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    currentJob.scriptReviewWords?.forEach((word, index) => {
      if (word.status === 'changed') {
        issues.push({
          id: `changed-${index}`,
          kind: 'changed',
          wordIndex: index,
          start: word.start,
          end: word.end,
          scriptWord: word.word,
          whisperWord: word.transcriptWord ?? '',
          customText: word.word,
        });
      }

      if (word.status === 'missing') {
        issues.push({
          id: `missing-${index}`,
          kind: 'missing',
          wordIndex: index,
          start: word.start,
          end: word.end,
          scriptWord: word.word,
          whisperWord: '',
          customText: word.word,
        });
      }
    });

    currentJob.scriptReviewExtraWords?.forEach((word, index) => {
      issues.push({
        id: `extra-${index}`,
        kind: 'extra',
        extraIndex: index,
        start: word.start,
        end: word.end,
        scriptWord: '',
        whisperWord: word.word,
        customText: word.word,
      });
    });

    return issues;
  }

  function resolveIssue(issue: ReviewIssue, decision: ReviewDecision) {
    preserveReviewScroll(() => {
      const nextIssues = reviewIssues.map((candidate) =>
        candidate.id === issue.id ? { ...candidate, decision } : candidate
      );
      applyReviewIssues(nextIssues);
      selectReviewIssue(issue);
    });
  }

  function updateIssueCustomText(issue: ReviewIssue, customText: string) {
    preserveReviewScroll(() => {
      const nextIssues = reviewIssues.map((candidate) =>
        candidate.id === issue.id ? { ...candidate, customText } : candidate
      );
      applyReviewIssues(nextIssues);
    });
  }

  function acceptAllScriptReview() {
    preserveReviewScroll(() => {
      const nextIssues = reviewIssues.map((issue) => ({
        ...issue,
        decision: issue.kind === 'extra' ? 'ignore' as const : 'script' as const,
      }));
      applyReviewIssues(nextIssues);
    });
  }

  function acceptAllWhisperReview() {
    preserveReviewScroll(() => {
      const nextIssues = reviewIssues.map((issue) => ({
        ...issue,
        decision: issue.kind === 'changed' ? 'whisper' as const : issue.kind === 'missing' ? 'remove' as const : 'insert' as const,
      }));
      applyReviewIssues(nextIssues);
    });
  }

  function resetReviewEdits() {
    preserveReviewScroll(() => {
      const nextIssues = reviewIssues.map((issue) => ({
        ...issue,
        customText: defaultCustomText(issue),
        decision: undefined,
      }));
      applyReviewIssues(nextIssues);
    });
  }

  function applyReviewIssues(nextIssues: ReviewIssue[]) {
    reviewIssues = nextIssues;
    editableTimestamps = baseReviewTimestamps ? buildEditedTimestamps(baseReviewTimestamps, nextIssues) : null;
    reviewConfirmed = false;
  }

  function cloneTimestamps(timestamps: TimestampsFile): TimestampsFile {
    return {
      ...timestamps,
      words: timestamps.words.map((word) => ({ ...word })),
    };
  }

  function defaultCustomText(issue: ReviewIssue): string {
    return issue.kind === 'extra' ? issue.whisperWord : issue.scriptWord;
  }

  function selectReviewIssue(issue: ReviewIssue, section?: CaptionPreviewSection) {
    selectedReviewSectionId = section?.id ?? findSectionIdForIssue(issue.id);
    seekReviewRange(section ?? issue);
  }

  function selectReviewIssueById(issueId: string, section?: CaptionPreviewSection) {
    const issue = findReviewIssue(issueId);
    if (issue) {
      selectReviewIssue(issue, section);
    }
  }

  function selectReviewSection(section: CaptionPreviewSection) {
    selectedReviewSectionId = section.id;
    seekReviewRange(section);
  }

  function seekReviewRange(range: { start: number }) {
    if (!reviewVideo) return;
    sectionStopAt = null;
    reviewVideo.currentTime = Math.max(0, range.start - 1);
  }

  async function playReviewSection(section: CaptionPreviewSection) {
    if (!reviewVideo) return;
    selectedReviewSectionId = section.id;
    const start = Math.max(0, section.start - 1);
    sectionStopAt = Math.max(start + 0.25, section.end + 1);
    reviewVideo.currentTime = start;
    try {
      await reviewVideo.play();
    } catch {
      status = 'Press play in the video preview to hear this section.';
    }
  }

  function handleReviewVideoTimeUpdate() {
    if (sectionStopAt === null || !reviewVideo) return;
    if (reviewVideo.currentTime >= sectionStopAt) {
      reviewVideo.pause();
      sectionStopAt = null;
    }
  }

  function confirmReview() {
    if (reviewIssues.length === 0 || unresolvedReviewIssueCount > 0) return;
    reviewConfirmed = true;
    status = 'Caption review confirmed.';
    toastState.success('Caption review confirmed.');
  }

  function preserveReviewScroll(update: () => void) {
    const container = reviewScrollContainer;
    const scrollTop = container?.scrollTop ?? 0;
    const scrollLeft = container?.scrollLeft ?? 0;

    update();

    window.requestAnimationFrame(() => {
      if (!container) return;
      container.scrollTop = Math.min(scrollTop, Math.max(0, container.scrollHeight - container.clientHeight));
      container.scrollLeft = scrollLeft;
    });
  }

  async function ensureUploadedJob(activeConnection: EngineConnection): Promise<CaptionJob> {
    if (!file) {
      throw new Error('Choose a video first.');
    }

    if (job?.hasInput) {
      return job;
    }

    status = 'Creating render job...';
    progress = 0.15;
    let currentJob = await createJob(activeConnection, file);
    job = currentJob;

    status = 'Uploading video...';
    progress = 0.25;
    currentJob = await uploadVideo(activeConnection, currentJob.id, file);
    job = currentJob;
    return currentJob;
  }

  async function pollUntil(
    activeConnection: EngineConnection,
    jobId: string,
    isDone: (candidate: CaptionJob) => boolean
  ): Promise<CaptionJob> {
    for (;;) {
      await delay(1000);
      const currentJob = await getJob(activeConnection, jobId);
      job = currentJob;
      status = currentJob.progressLabel;
      progress = progressForStatus(currentJob);

      if (isDone(currentJob)) {
        return currentJob;
      }
    }
  }

  function parseTimestamps(text: string): TimestampsFile {
    const parsed = JSON.parse(text) as TimestampsFile;
    if (!Array.isArray(parsed.words)) {
      throw new Error('Timestamp JSON must include a words array.');
    }
    return {
      totalDuration: typeof parsed.totalDuration === 'number' ? parsed.totalDuration : 0,
      wordCount: typeof parsed.wordCount === 'number' ? parsed.wordCount : parsed.words.length,
      language: parsed.language || language,
      words: parsed.words,
    };
  }

  function parseKeywords(value: string): string[] {
    return value
      .split(',')
      .map((word) => word.trim())
      .filter(Boolean);
  }

  function handlePresetChange(event: Event) {
    const nextPreset = (event.currentTarget as HTMLSelectElement).value as CaptionPreset;
    preset = nextPreset;
    applyCaptionPreset(nextPreset);
  }

  function applyCaptionPreset(nextPreset: CaptionPreset) {
    const defaults = CAPTION_PRESET_DEFAULTS[nextPreset];
    mode = defaults.mode;
    position = defaults.position;
    fontSize = defaults.fontSize;
    maxWordsPerLine = defaults.maxWordsPerLine;
    primaryColor = defaults.primaryColor;
    highlightColor = defaults.highlightColor;
  }

  function clearOutput() {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = null;
    outputName = '';
  }

  function progressForStatus(currentJob: CaptionJob): number {
    switch (currentJob.status) {
      case 'created':
        return currentJob.hasTimestamps ? 1 : 0.15;
      case 'uploading':
        return 0.25;
      case 'probing':
        return 0.35;
      case 'extracting-audio':
        return 0.42;
      case 'transcribing':
        return 0.48;
      case 'aligning':
        return 0.55;
      case 'reviewing-script':
        return 0.58;
      case 'generating-subtitles':
        return 0.7;
      case 'rendering':
        return 0.82;
      case 'complete':
        return 1;
      case 'failed':
      case 'cancelled':
        return 0;
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatMetadata(currentJob: CaptionJob): string {
    const metadata = currentJob.metadata;
    if (!metadata) return 'Metadata pending';
    return `${metadata.width}x${metadata.height} - ${metadata.frameRate.toFixed(2)} fps`;
  }

  function hasReviewIssues(currentJob: CaptionJob): boolean {
    const summary = currentJob.scriptReview;
    return Boolean(summary && (summary.changed > 0 || summary.missing > 0 || summary.extra > 0));
  }

  function findReviewIssue(issueId: string): ReviewIssue | undefined {
    return reviewIssues.find((issue) => issue.id === issueId);
  }

  function findSectionIdForIssue(issueId: string): string {
    return reviewSections.find((section) => section.issueIds.includes(issueId))?.id ?? '';
  }

  function sectionIssues(section: CaptionPreviewSection): ReviewIssue[] {
    return section.issueIds
      .map((issueId) => findReviewIssue(issueId))
      .filter((issue): issue is ReviewIssue => Boolean(issue));
  }

  function sectionResolvedCount(section: CaptionPreviewSection): number {
    return sectionIssues(section).filter((issue) => issue.decision).length;
  }

  function reviewSectionTone(section: CaptionPreviewSection): string {
    if (selectedReviewSectionId === section.id) return 'border-accent bg-accent-light/20';
    if (sectionIssues(section).some((issue) => !issue.decision)) return 'border-danger/50 bg-danger/5';
    if (section.issueIds.length > 0) return 'border-success/50 bg-success/5';
    return 'border-border bg-surface';
  }

  function previewWordTone(word: CaptionPreviewWord): string {
    if (word.issueIds.length === 0) return 'text-text';
    if (word.issueIds.some((issueId) => !findReviewIssue(issueId)?.decision)) {
      return 'rounded bg-danger/15 px-1 text-danger';
    }
    return 'rounded bg-success/15 px-1 text-success';
  }

  function previewWordTitle(word: CaptionPreviewWord): string {
    const issue = word.issueIds.map((issueId) => findReviewIssue(issueId)).find(Boolean);
    return issue ? reviewIssueDescription(issue) : word.word;
  }

  function reviewIssueKindLabel(issue: ReviewIssue): string {
    if (issue.kind === 'changed') return 'Changed';
    if (issue.kind === 'missing') return 'Estimated';
    return 'Extra audio';
  }

  function reviewIssueDescription(issue: ReviewIssue): string {
    if (issue.kind === 'changed') {
      return `Script: ${issue.scriptWord} - Whisper: ${issue.whisperWord || 'unknown'}`;
    }
    if (issue.kind === 'missing') {
      return `Script: ${issue.scriptWord} - not heard clearly`;
    }
    return `Whisper heard: ${issue.whisperWord}`;
  }

  function reviewIssueDecisionLabel(issue: ReviewIssue): string {
    switch (issue.decision) {
      case 'script':
        return 'Using script';
      case 'whisper':
        return 'Using Whisper';
      case 'custom':
        return issue.kind === 'extra' ? 'Custom insert' : 'Custom';
      case 'remove':
        return 'Removed';
      case 'ignore':
        return 'Ignored';
      case 'insert':
        return 'Inserted';
      default:
        return 'Unresolved';
    }
  }

  function customActionLabel(issue: ReviewIssue): string {
    return issue.kind === 'extra' ? 'Custom insert' : 'Custom';
  }

  function customPlaceholder(issue: ReviewIssue): string {
    if (issue.kind === 'extra') return 'Insert caption text';
    return 'Caption text';
  }

  function reviewWarningText(count: number): string {
    return `${count} unresolved ${count === 1 ? 'issue' : 'issues'}. You can still render if it sounds correct.`;
  }

  function reviewConfirmationWarningText(): string {
    if (unresolvedReviewIssueCount > 0) {
      return reviewWarningText(unresolvedReviewIssueCount);
    }
    return 'All issues are resolved. Confirm review after reading the caption sections once.';
  }

  function renderReviewWarning(): string {
    if (inputMode !== 'script' || reviewIssues.length === 0) return '';
    if (unresolvedReviewIssueCount > 0) {
      return `${unresolvedReviewIssueCount} unresolved review ${unresolvedReviewIssueCount === 1 ? 'issue' : 'issues'}`;
    }
    if (!reviewConfirmed) {
      return 'caption review is not confirmed';
    }
    return '';
  }

  function formatTimeRange(word: { start: number; end: number }): string {
    return `${formatTime(word.start)}-${formatTime(word.end)}`;
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.max(0, seconds - minutes * 60);
    return `${minutes}:${remainingSeconds.toFixed(1).padStart(4, '0')}`;
  }

  function alignmentHealthMessage(engineHealth: EngineHealth): string {
    if (!engineHealth.python.available) {
      return engineHealth.python.guidance || engineHealth.python.error || 'Python setup is incomplete.';
    }
    if (!engineHealth.whisperx.available) {
      return engineHealth.whisperx.guidance || engineHealth.whisperx.error || 'WhisperX setup is incomplete.';
    }
    return 'Python/WhisperX setup is incomplete.';
  }

  function makeOutputName(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
    return `${base}-captioned.mp4`;
  }

  function getErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function sampleTimestampsText(): string {
    return JSON.stringify(
      {
        totalDuration: 5,
        wordCount: 7,
        language: 'de',
        words: [
          { word: 'Hallo', start: 0.3, end: 0.7 },
          { word: 'und', start: 0.75, end: 0.95 },
          { word: 'sch\u00f6n,', start: 1.0, end: 1.35 },
          { word: 'dass', start: 1.5, end: 1.75 },
          { word: 'du', start: 1.8, end: 2.0 },
          { word: 'da', start: 2.05, end: 2.3 },
          { word: 'bist!', start: 2.35, end: 2.8 },
        ],
      },
      null,
      2
    );
  }
</script>

<div class="flex-1 overflow-auto bg-surface">
  <div class="min-h-full w-full max-w-6xl mx-auto px-6 py-6 md:py-8 flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3">
      <Button variant="ghost" onclick={onback} disabled={isBusy}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 19-7-7 7-7"/>
          <path d="M19 12H5"/>
        </svg>
        All tools
      </Button>
      <p class="text-xs text-text-muted text-right">
        Video rendering uses your local engine.
      </p>
    </div>

    <section class="rounded-lg border border-border bg-surface-elevated p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div class="flex-1">
          <label class="block text-sm font-medium mb-2" for="engine-url">Engine URL</label>
          <input
            id="engine-url"
            class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            bind:value={engineUrl}
            disabled={isBusy || isConnecting}
            placeholder="http://127.0.0.1:4777/?token=..."
          />
        </div>
        <div class="lg:w-72">
          <label class="block text-sm font-medium mb-2" for="engine-token">Token</label>
          <input
            id="engine-token"
            class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            bind:value={engineToken}
            disabled={isBusy || isConnecting}
            placeholder="Printed by local engine"
          />
        </div>
        <div class="flex gap-2">
          <Button variant="primary" onclick={connectEngine} disabled={isBusy || isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
          <Button variant="secondary" onclick={disconnectEngine} disabled={!connection || isBusy}>
            Disconnect
          </Button>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span class="inline-flex items-center rounded-full px-2.5 py-1 border {isConnected ? 'border-success text-success' : 'border-border text-text-muted'}">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        {#if health}
          <span class="text-text-muted">Engine {health.version}</span>
          <span class="text-text-muted">FFmpeg {health.ffmpeg.available ? 'ready' : 'missing'}</span>
          <span class="text-text-muted">Python {health.python.available ? health.python.version : 'missing'}</span>
          <span class="{health.whisperx.available ? 'text-text-muted' : 'text-danger'}">WhisperX {health.whisperx.available ? health.whisperx.device || 'ready' : 'missing'}</span>
        {:else}
          <span class="text-text-muted">Start the engine with <code>npm run server</code> in <code>local-engines/video-captions</code>.</span>
        {/if}
      </div>
    </section>

    <section class="grid xl:grid-cols-[1fr_22rem] gap-5 items-start">
      <div class="flex flex-col gap-4">
        <button
          class="w-full min-h-[13rem] rounded-lg border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-4 cursor-pointer bg-surface-elevated border-border hover:border-accent hover:bg-accent-light/30 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={isBusy}
          onclick={() => videoInput.click()}
        >
          <span class="h-14 w-14 rounded-lg bg-accent-light text-accent flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="m22 8-6 4 6 4V8Z"/>
              <rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
            </svg>
          </span>
          <span class="text-center px-4">
            <span class="block text-lg font-medium">
              {file ? file.name : 'Choose a video'}
            </span>
            <span class="block text-sm text-text-muted mt-1">
              {file ? formatBytes(file.size) : 'MP4, MOV, MKV, or WebM handled by local FFmpeg'}
            </span>
          </span>
        </button>

        <div class="rounded-lg border border-border bg-surface-elevated p-4">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <label class="block text-sm font-medium" for="input-mode">Caption source</label>
            <select
              id="input-mode"
              class="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
              bind:value={inputMode}
              disabled={isBusy}
            >
              <option value="script">Whisper / optional script</option>
              <option value="manual">Timestamp JSON</option>
            </select>
          </div>

          {#if inputMode === 'script'}
            <textarea
              id="script-text"
              class="w-full min-h-56 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text resize-y"
              bind:value={scriptText}
              disabled={isBusy}
              placeholder="Optional: paste your exact script here. Leave empty to let Whisper transcribe the video."
              spellcheck="true"
            ></textarea>

            <div class="mt-3 grid sm:grid-cols-2 gap-3">
              <label class="block text-sm font-medium" for="language">
                Language
                <select id="language" class="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" bind:value={language} disabled={isBusy}>
                  <option value="de">German</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label class="block text-sm font-medium" for="whisper-model">
                Whisper model
                <select id="whisper-model" class="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" bind:value={whisperModel} disabled={isBusy}>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large-v3">Large v3</option>
                </select>
              </label>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onclick={generateTimings}
                disabled={!isConnected || !alignmentReady || !file || isBusy}
              >
                {hasGeneratedTimings ? 'Regenerate timings' : 'Generate timings'}
              </Button>
              {#if health && !alignmentReady}
                <span class="text-sm text-danger self-center">{alignmentHealthMessage(health)}</span>
              {/if}
            </div>
          {:else}
            <div class="flex items-center justify-between gap-3 mb-3">
              <label class="block text-sm font-medium" for="timestamps-json">Timestamp JSON</label>
              <Button variant="secondary" size="sm" onclick={() => timestampsInput.click()} disabled={isBusy}>
                Import JSON
              </Button>
            </div>
            <textarea
              id="timestamps-json"
              class="w-full min-h-72 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text font-mono resize-y"
              bind:value={timestampsText}
              disabled={isBusy}
              spellcheck="false"
            ></textarea>
          {/if}
        </div>

        {#if job?.scriptReview}
          <div class="rounded-lg border border-border bg-surface-elevated p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="font-medium">Script review</p>
                <p class="text-sm text-text-muted mt-1">
                  {Math.round(job.scriptReview.confidence * 100)}% confidence - {job.scriptReview.matched} matched, {job.scriptReview.changed} changed, {job.scriptReview.missing} missing, {job.scriptReview.extra} extra
                </p>
              </div>
              <span class="rounded-full border px-2.5 py-1 text-sm {reviewIssues.length && !reviewConfirmed ? 'border-danger text-danger' : 'border-success text-success'}">
                {reviewIssues.length ? (reviewConfirmed ? 'Confirmed' : `${resolvedReviewIssueCount}/${reviewIssues.length} resolved`) : 'Ready'}
              </span>
            </div>

            {#if scriptTimingsAreStale}
              <div class="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                Script changed after timings were generated. Regenerate timings before rendering.
              </div>
            {/if}

            {#if job.scriptReview.warnings.length}
              <ul class="mt-3 flex flex-col gap-1 text-sm text-danger">
                {#each job.scriptReview.warnings as warning}
                  <li>{warning}</li>
                {/each}
              </ul>
            {/if}

            {#if reviewIssues.length}
              <div class="mt-4 grid gap-4 lg:grid-cols-[18rem_1fr]">
                {#if videoPreviewUrl}
                  <div>
                    <!-- svelte-ignore a11y_media_has_caption - the source video is being reviewed before captions are rendered -->
                    <video
                      bind:this={reviewVideo}
                      class="w-full rounded-lg border border-border bg-black"
                      src={videoPreviewUrl}
                      controls
                      preload="metadata"
                      ontimeupdate={handleReviewVideoTimeUpdate}
                    ></video>
                    <p class="mt-2 text-xs text-text-muted">
                      Play section starts 1 second before the selected caption and pauses after it.
                    </p>
                  </div>
                {/if}

                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" size="sm" onclick={acceptAllScriptReview} disabled={isBusy}>
                      Accept all script
                    </Button>
                    <Button variant="secondary" size="sm" onclick={acceptAllWhisperReview} disabled={isBusy}>
                      Accept all Whisper
                    </Button>
                    <Button variant="ghost" size="sm" onclick={resetReviewEdits} disabled={isBusy}>
                      Reset edits
                    </Button>
                    <Button
                      variant={reviewConfirmed ? 'secondary' : 'primary'}
                      size="sm"
                      onclick={confirmReview}
                      disabled={isBusy || unresolvedReviewIssueCount > 0 || reviewConfirmed}
                    >
                      {reviewConfirmed ? 'Review confirmed' : 'Confirm review'}
                    </Button>
                  </div>

                  {#if !reviewConfirmed}
                    <div class="mt-3 rounded-md border px-3 py-2 text-sm {unresolvedReviewIssueCount > 0 ? 'border-danger/40 bg-danger/10 text-danger' : 'border-accent/40 bg-accent-light/20 text-text'}">
                      {reviewConfirmationWarningText()}
                    </div>
                  {:else}
                    <div class="mt-3 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
                      Review confirmed. Render captions when the settings look right.
                    </div>
                  {/if}

                  <div bind:this={reviewScrollContainer} class="mt-3 max-h-[34rem] overflow-auto pr-1">
                    <div class="flex flex-col gap-3">
                      {#each reviewSections as section (section.id)}
                        <div class="rounded-lg border p-3 transition-colors {reviewSectionTone(section)}">
                          <div class="flex flex-wrap items-start justify-between gap-3">
                            <button type="button" class="min-w-0 flex-1 text-left" onclick={() => selectReviewSection(section)}>
                              <div class="flex flex-wrap items-center gap-2">
                                <span class="text-xs text-text-muted">{formatTimeRange(section)}</span>
                                {#if section.issueIds.length}
                                  <span class="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-xs font-medium">
                                    {sectionResolvedCount(section)}/{section.issueIds.length} resolved
                                  </span>
                                {:else}
                                  <span class="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-xs text-text-muted">
                                    No issues
                                  </span>
                                {/if}
                              </div>
                            </button>
                            <Button variant="ghost" size="sm" onclick={() => playReviewSection(section)} disabled={!videoPreviewUrl}>
                              Play section
                            </Button>
                          </div>

                          <div class="mt-3 rounded-md border border-border bg-surface-elevated px-3 py-3 text-lg leading-8">
                            {#each section.words as word, wordIndex}
                              {#if word.issueIds.length}
                                <button
                                  type="button"
                                  class="inline font-semibold transition-colors {previewWordTone(word)}"
                                  title={previewWordTitle(word)}
                                  onclick={() => selectReviewIssueById(word.issueIds[0], section)}
                                >
                                  {word.word}
                                </button>
                              {:else}
                                <span class={previewWordTone(word)}>{word.word}</span>
                              {/if}{wordIndex < section.words.length - 1 ? ' ' : ''}
                            {/each}
                          </div>

                          {#if section.extraMarkers.length}
                            <div class="mt-3 flex flex-col gap-2">
                              {#each section.extraMarkers as marker (marker.issueId)}
                                <button
                                  type="button"
                                  class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-left text-sm text-danger"
                                  onclick={() => selectReviewIssueById(marker.issueId, section)}
                                >
                                  Extra heard near {formatTimeRange(marker)}: {marker.word}
                                </button>
                              {/each}
                            </div>
                          {/if}

                          {#if section.issueIds.length}
                            <div class="mt-3 divide-y divide-border border-y border-border">
                              {#each sectionIssues(section) as issue (issue.id)}
                                <div class="py-3">
                                  <button type="button" class="w-full text-left" onclick={() => selectReviewIssue(issue, section)}>
                                    <div class="flex flex-wrap items-center gap-2">
                                      <span class="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-xs font-medium">
                                        {reviewIssueKindLabel(issue)}
                                      </span>
                                      <span class="text-xs text-text-muted">{formatTimeRange(issue)}</span>
                                      <span class="text-xs {issue.decision ? 'text-success' : 'text-danger'}">
                                        {reviewIssueDecisionLabel(issue)}
                                      </span>
                                    </div>
                                    <p class="mt-2 text-sm font-medium break-words">{reviewIssueDescription(issue)}</p>
                                  </button>

                                  <div class="mt-3 flex flex-wrap gap-2">
                                    {#if issue.kind === 'changed'}
                                      <Button variant={issue.decision === 'script' ? 'primary' : 'secondary'} size="sm" onclick={() => resolveIssue(issue, 'script')} disabled={isBusy}>
                                        Use Script
                                      </Button>
                                      <Button variant={issue.decision === 'whisper' ? 'primary' : 'secondary'} size="sm" onclick={() => resolveIssue(issue, 'whisper')} disabled={isBusy || !issue.whisperWord.trim()}>
                                        Use Whisper
                                      </Button>
                                    {:else if issue.kind === 'missing'}
                                      <Button variant={issue.decision === 'script' ? 'primary' : 'secondary'} size="sm" onclick={() => resolveIssue(issue, 'script')} disabled={isBusy}>
                                        Keep Script
                                      </Button>
                                      <Button variant={issue.decision === 'remove' ? 'primary' : 'secondary'} size="sm" onclick={() => resolveIssue(issue, 'remove')} disabled={isBusy}>
                                        Remove
                                      </Button>
                                    {:else}
                                      <Button variant={issue.decision === 'ignore' ? 'primary' : 'secondary'} size="sm" onclick={() => resolveIssue(issue, 'ignore')} disabled={isBusy}>
                                        Ignore
                                      </Button>
                                      <Button variant={issue.decision === 'insert' ? 'primary' : 'secondary'} size="sm" onclick={() => resolveIssue(issue, 'insert')} disabled={isBusy || !issue.whisperWord.trim()}>
                                        Insert
                                      </Button>
                                    {/if}
                                  </div>

                                  <div class="mt-3 flex gap-2 max-sm:flex-col">
                                    <input
                                      class="min-w-0 flex-1 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text"
                                      value={issue.customText}
                                      disabled={isBusy}
                                      placeholder={customPlaceholder(issue)}
                                      oninput={(event) => updateIssueCustomText(issue, (event.currentTarget as HTMLInputElement).value)}
                                    />
                                    <Button
                                      variant={issue.decision === 'custom' ? 'primary' : 'secondary'}
                                      size="sm"
                                      onclick={() => resolveIssue(issue, 'custom')}
                                      disabled={isBusy || !issue.customText.trim()}
                                    >
                                      {customActionLabel(issue)}
                                    </Button>
                                  </div>
                                </div>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
            {:else if hasReviewIssues(job)}
              <div class="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                Review details are missing from the local engine response. Restart the local captions engine and regenerate timings.
              </div>
            {:else}
              <div class="mt-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
                Script and Whisper are aligned. No manual review needed.
              </div>
            {/if}
          </div>
        {/if}

        {#if status || isBusy || job}
          <div class="rounded-lg border border-border bg-surface-elevated p-4">
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="font-medium">{status || job?.progressLabel || 'Ready'}</span>
              <span class="text-text-muted">{Math.round(progress * 100)}%</span>
            </div>
            <div class="mt-3 h-2 rounded-full bg-surface-alt overflow-hidden border border-border">
              <div class="h-full bg-accent transition-all duration-200" style={`width: ${Math.round(progress * 100)}%`}></div>
            </div>
            {#if job}
              <p class="text-xs text-text-muted mt-2">{formatMetadata(job)}</p>
            {/if}
          </div>
        {/if}

        {#if hasGeneratedTimings && !scriptTimingsAreStale && !outputUrl && !isBusy}
          <div class="rounded-lg border border-success/40 bg-success/10 p-4 text-sm text-success">
            Timings are ready. Click Render captions in the settings panel to create the MP4.
          </div>
        {/if}

        {#if error}
          <div class="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
            {error}
          </div>
        {/if}

        {#if outputUrl}
          <div class="rounded-lg border border-border bg-surface-elevated p-4 flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
            <div>
              <p class="font-medium">{outputName}</p>
              <p class="text-sm text-text-muted mt-1">Burned-in captions rendered locally.</p>
            </div>
            <a
              class="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 cursor-pointer bg-accent text-white hover:bg-accent-hover active:scale-[0.97] shadow-sm px-4 py-2 text-sm"
              href={outputUrl}
              download={outputName}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </a>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border border-border bg-surface-elevated p-4 flex flex-col gap-4">
        <div>
          <label class="block text-sm font-medium mb-2" for="preset">Preset</label>
          <select id="preset" class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" value={preset} onchange={handlePresetChange} disabled={isBusy}>
            <option value="youtube">YouTube</option>
            <option value="shorts">Shorts/Karaoke</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2" for="mode">Mode</label>
          <select id="mode" class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" bind:value={mode} disabled={isBusy}>
            <option value="normal">Normal</option>
            <option value="phrase">Phrase</option>
            <option value="karaoke">Karaoke</option>
            <option value="keyword">Keyword</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2" for="position">Position</label>
          <select id="position" class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" bind:value={position} disabled={isBusy}>
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm font-medium" for="font-size">
            Font size
            <input id="font-size" class="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" type="number" min="20" max="120" bind:value={fontSize} disabled={isBusy} />
          </label>
          <label class="block text-sm font-medium" for="max-words">
            Max words
            <input id="max-words" class="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" type="number" min="1" max="20" bind:value={maxWordsPerLine} disabled={isBusy} />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm font-medium" for="text-color">
            Text
            <input id="text-color" class="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-2 py-1" type="color" bind:value={primaryColor} disabled={isBusy} />
          </label>
          <label class="block text-sm font-medium" for="highlight-color">
            Highlight
            <input id="highlight-color" class="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-2 py-1" type="color" bind:value={highlightColor} disabled={isBusy} />
          </label>
        </div>

        {#if mode === 'keyword'}
          <div>
            <label class="block text-sm font-medium mb-2" for="keywords">Keywords</label>
            <input
              id="keywords"
              class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
              bind:value={keywords}
              disabled={isBusy}
              placeholder="Hook, Angebot, wichtig"
            />
            <p class="text-xs text-text-muted mt-2">Separate words with commas.</p>
          </div>
        {/if}

        <div class="flex flex-col gap-2 pt-2">
          <Button
            variant="primary"
            onclick={renderCaptions}
            disabled={!isConnected || !file || isBusy || (inputMode === 'script' && (!hasGeneratedTimings || scriptTimingsAreStale))}
          >
            {isBusy ? 'Working...' : 'Render captions'}
          </Button>
          <Button variant="ghost" onclick={() => videoInput.click()} disabled={isBusy}>
            Choose video
          </Button>
        </div>
      </div>
    </section>

    <input bind:this={videoInput} type="file" accept="video/*,.mp4,.mov,.mkv,.webm" class="hidden" onchange={handleVideoSelect} />
    <input bind:this={timestampsInput} type="file" accept="application/json,.json" class="hidden" onchange={handleTimestampsSelect} />
  </div>
</div>
