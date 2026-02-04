// Progress bar utility for CLI operations
// Provides world-class UX with visual feedback for long-running operations

function formatBytes(bytes) {
  if (bytes === 0 || bytes == null) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export class ProgressBar {
  constructor(options = {}) {
    this.total = options.total || 0;
    this.current = 0;
    this.label = options.label || 'Progress';
    this.width = options.width || 40;
    this.showBytes = options.showBytes || false;
    this.showSpeed = options.showSpeed || false;
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
    this.lastBytes = 0;
    this.speed = 0;
    this.enabled = process.stderr.isTTY && !process.env.VIDEO_EXTRACT_NO_PROGRESS;
  }

  update(current, extra = {}) {
    this.current = current;
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000;

    if (this.showBytes && extra.bytes != null) {
      // Calculate speed (bytes per second)
      const dt = (now - this.lastUpdate) / 1000;
      if (dt > 0.5) {
        const db = extra.bytes - this.lastBytes;
        this.speed = db / dt;
        this.lastBytes = extra.bytes;
        this.lastUpdate = now;
      }
    }

    if (!this.enabled) return;

    const ratio = this.total > 0 ? Math.min(1, Math.max(0, this.current / this.total)) : 0;
    const filled = Math.floor(ratio * this.width);
    const empty = this.width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const pct = Math.floor(ratio * 100);

    let line = `${this.label} [${bar}] ${pct}%`;

    if (this.showBytes && extra.bytes != null) {
      line += ` ${formatBytes(extra.bytes)}`;
      if (this.total > 0 && extra.totalBytes != null) {
        line += ` / ${formatBytes(extra.totalBytes)}`;
      }
    }

    if (this.showSpeed && this.speed > 0) {
      line += ` (${formatBytes(this.speed)}/s)`;
    }

    if (elapsed > 2 && this.total > 0) {
      const eta = elapsed / ratio - elapsed;
      if (eta > 0 && Number.isFinite(eta)) {
        line += ` ETA: ${formatDuration(eta)}`;
      }
    }

    // Clear line and write
    process.stderr.write(`\r\x1b[K${line}`);
  }

  finish(message) {
    if (this.enabled) {
      process.stderr.write(`\r\x1b[K${message || this.label + ' complete'}\n`);
    }
  }
}

// Parse ffmpeg progress output lines
export function parseFfmpegProgress(line) {
  const result = {};
  const timeMatch = line.match(/time=\s*(\d+):(\d+):(\d+\.?\d*)/);
  const sizeMatch = line.match(/size=\s*(\d+)kB/i);
  const speedMatch = line.match(/speed=\s*(\d+\.?\d*)x/);

  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    const s = parseFloat(timeMatch[3]);
    result.timeSeconds = h * 3600 + m * 60 + s;
  }

  if (sizeMatch) {
    result.sizeBytes = parseInt(sizeMatch[1], 10) * 1024;
  }

  if (speedMatch) {
    result.speed = parseFloat(speedMatch[1]);
  }

  return result;
}
