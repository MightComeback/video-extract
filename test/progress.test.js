import { describe, it, expect } from 'bun:test';
import { ProgressBar, parseFfmpegProgress } from '../src/progress.js';

describe('ProgressBar', () => {
  it('initializes with default options', () => {
    const pb = new ProgressBar();
    expect(pb.total).toBe(0);
    expect(pb.current).toBe(0);
    expect(pb.label).toBe('Progress');
    expect(pb.width).toBe(40);
  });

  it('accepts custom options', () => {
    const pb = new ProgressBar({
      total: 100,
      label: 'Download',
      width: 20,
      showBytes: true,
      showSpeed: true,
    });
    expect(pb.total).toBe(100);
    expect(pb.label).toBe('Download');
    expect(pb.width).toBe(20);
    expect(pb.showBytes).toBe(true);
    expect(pb.showSpeed).toBe(true);
  });

  it('updates current progress', () => {
    const pb = new ProgressBar({ total: 100 });
    pb.update(50);
    expect(pb.current).toBe(50);
  });

  it('calculates progress ratio correctly', () => {
    const pb = new ProgressBar({ total: 200 });
    pb.update(50);
    // 50/200 = 25%
    expect(pb.current / pb.total).toBe(0.25);
  });
});

describe('parseFfmpegProgress', () => {
  it('parses time from ffmpeg output', () => {
    const line = 'frame=  100 fps=25.0 q=-1.0 size=     500kB time=00:01:30.50 bitrate=  45.2kbits/s speed=3.6x';
    const result = parseFfmpegProgress(line);
    expect(result.timeSeconds).toBe(90.5); // 1*60 + 30.5
  });

  it('parses size from ffmpeg output', () => {
    const line = 'size=   15360kB time=00:02:30.00';
    const result = parseFfmpegProgress(line);
    expect(result.sizeBytes).toBe(15360 * 1024);
  });

  it('parses speed from ffmpeg output', () => {
    const line = 'speed=2.5x';
    const result = parseFfmpegProgress(line);
    expect(result.speed).toBe(2.5);
  });

  it('handles empty lines gracefully', () => {
    const result = parseFfmpegProgress('');
    expect(result.timeSeconds).toBeUndefined();
    expect(result.sizeBytes).toBeUndefined();
    expect(result.speed).toBeUndefined();
  });

  it('handles lines without matches', () => {
    const result = parseFfmpegProgress('frame= 100 fps=25.0');
    expect(result.timeSeconds).toBeUndefined();
    expect(result.sizeBytes).toBeUndefined();
  });

  it('parses all fields when present', () => {
    const line = 'size=  10240kB time=00:05:00.00 speed=1.8x';
    const result = parseFfmpegProgress(line);
    expect(result.sizeBytes).toBe(10240 * 1024);
    expect(result.timeSeconds).toBe(300); // 5 minutes
    expect(result.speed).toBe(1.8);
  });
});
