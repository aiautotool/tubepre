import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

type YtDlpFormat = {
  format_id?: string;
  format_note?: string;
  ext?: string;
  url?: string;
  manifest_url?: string;
  vcodec?: string;
  acodec?: string;
  height?: number;
  resolution?: string;
};

type YtDlpInfo = {
  url?: string;
  formats?: YtDlpFormat[];
};

type PlayableFormat = {
  format_id: string;
  label: string;
  stream_url: string;
  height: number;
  ext: string;
  is_hls: boolean;
};

function formatLabel(format: YtDlpFormat): string {
  const heightLabel = format.height ? `${format.height}p` : format.format_note || format.resolution || 'Auto';
  const extLabel = format.ext ? ` ${format.ext.toUpperCase()}` : '';
  return `${heightLabel}${extLabel}`;
}

function getPlayableFormats(info: YtDlpInfo): PlayableFormat[] {
  const seen = new Set<string>();
  return (info.formats || [])
    .filter(format => {
      const streamUrl = format.url || format.manifest_url;
      return Boolean(
        streamUrl &&
        format.vcodec &&
        format.vcodec !== 'none' &&
        format.acodec &&
        format.acodec !== 'none'
      );
    })
    .map(format => ({
      format_id: format.format_id || `${format.height || 0}-${format.ext || 'video'}`,
      label: formatLabel(format),
      stream_url: format.url || format.manifest_url || '',
      height: format.height || 0,
      ext: format.ext || '',
      is_hls: Boolean(format.manifest_url || format.url?.includes('.m3u8') || format.url?.includes('manifest')),
    }))
    .filter(format => {
      const key = `${format.height}-${format.ext}-${format.is_hls}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.height - a.height);
}

function findBestPlayableStream(info: YtDlpInfo) {
  const formats = getPlayableFormats(info);

  const direct = formats.find(format => !format.is_hls);
  if (direct) {
    return { streamUrl: direct.stream_url, formatId: direct.format_id };
  }

  if (formats[0]) {
    return { streamUrl: formats[0].stream_url, formatId: formats[0].format_id };
  }

  if (info.url) {
    return { streamUrl: info.url, formatId: '' };
  }

  return null;
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('v') || request.nextUrl.searchParams.get('id');
  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--dump-json',
      '--no-warnings',
      '--quiet',
      '--force-ipv4',
      '--no-playlist',
      '--user-agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      `https://www.youtube.com/watch?v=${videoId}`,
    ], { maxBuffer: 1024 * 1024 * 20 });

    const info = JSON.parse(stdout) as YtDlpInfo;
    const formats = getPlayableFormats(info);
    const selected = findBestPlayableStream(info);
    if (!selected) {
      return NextResponse.json({ error: 'No stream URL available' });
    }

    return NextResponse.json({
      stream_url: selected.streamUrl,
      format_id: selected.formatId,
      formats,
    });
  } catch (error) {
    console.warn('yt-dlp stream info failed:', error);
    return NextResponse.json({ error: 'Failed to get stream info' });
  }
}
