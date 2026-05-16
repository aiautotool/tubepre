'use client';

import { useEffect, useRef, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { apiUrl } from '../lib/api';

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
        Hls: any;
    }
}

type StreamFormat = {
    format_id: string;
    label: string;
    stream_url: string;
    height: number;
    ext: string;
    is_hls: boolean;
};

type StreamInfoResponse = {
    stream_url?: string;
    format_id?: string;
    formats?: StreamFormat[];
    error?: string;
};

interface YouTubePlayerProps {
    videoId: string;
    title?: string;
    autoplay?: boolean;
    onVideoEnd?: () => void;
    onVideoReady?: () => void;
    loop?: boolean;
}

function PlayerSkeleton() {
    return (
        <div style={{
            width: '100%',
            aspectRatio: '16/9',
            backgroundColor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px',
        }}>
            <LoadingSpinner color="white" size="large" />
        </div>
    );
}

function getPlayerErrorMessage(code: number | string): string {
    if (code === 101 || code === 150 || code === '101' || code === '150') {
        return 'YouTube không phát được video này bằng IFrame API trong app.';
    }
    if (code === 100 || code === '100') {
        return 'Video này không còn tồn tại hoặc đang ở chế độ riêng tư.';
    }
    if (code === 2 || code === '2') {
        return 'Video ID không hợp lệ.';
    }
    if (code === 5 || code === '5') {
        return 'Trình duyệt không phát được video này.';
    }
    return `Không phát được video này (Error ${code}).`;
}

function isEmbedFallbackError(code: number | string): boolean {
    return code === 101 || code === 150 || code === '101' || code === '150';
}

async function getYtDlpStreamInfo(videoId: string): Promise<StreamInfoResponse | null> {
    try {
        const response = await fetch(apiUrl(`/get_stream_info?v=${encodeURIComponent(videoId)}`), { cache: 'no-store' });
        const data = await response.json() as StreamInfoResponse;
        if (!response.ok || data?.error || !data?.stream_url) {
            return null;
        }
        return data;
    } catch (error) {
        console.warn('yt-dlp stream info fallback failed:', error);
        return null;
    }
}

function getRawEmbedSrc(videoId: string, autoplay: boolean, loop: boolean): string {
    const params = new URLSearchParams({
        autoplay: autoplay ? '1' : '0',
        controls: '1',
        rel: '0',
        modestbranding: '1',
        playsinline: '1',
    });

    if (loop) {
        params.set('loop', '1');
        params.set('playlist', videoId);
    }

    const savedStart = getSavedPlaybackTime(videoId);
    if (savedStart > 2) {
        params.set('start', String(Math.max(0, Math.floor(savedStart) - 1)));
    }

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

const PLAYBACK_STORAGE_PREFIX = 'kvtube_playback_time:';
const playbackPositions = new Map<string, number>();

function isHlsUrl(url: string): boolean {
    return url.includes('.m3u8') || url.includes('manifest');
}

function loadHlsScript(): Promise<void> {
    if (window.Hls) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>('script[src*="hls.js"]');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('Failed to load hls.js')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load hls.js'));
        document.head.appendChild(script);
    });
}

function getSavedPlaybackTime(videoId: string): number {
    if (playbackPositions.has(videoId)) {
        return playbackPositions.get(videoId) || 0;
    }

    try {
        const saved = window.sessionStorage.getItem(`${PLAYBACK_STORAGE_PREFIX}${videoId}`);
        return saved ? Number(saved) || 0 : 0;
    } catch {
        return 0;
    }
}

function setSavedPlaybackTime(videoId: string, seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;

    playbackPositions.set(videoId, seconds);
    try {
        window.sessionStorage.setItem(`${PLAYBACK_STORAGE_PREFIX}${videoId}`, String(seconds));
    } catch {}
}

function clearSavedPlaybackTime(videoId: string) {
    playbackPositions.delete(videoId);
    try {
        window.sessionStorage.removeItem(`${PLAYBACK_STORAGE_PREFIX}${videoId}`);
    } catch {}
}

function savePlayerPlaybackTime(videoId: string, player: any) {
    try {
        const currentTime = player?.getCurrentTime?.();
        const duration = player?.getDuration?.();

        if (!Number.isFinite(currentTime) || currentTime <= 0) return;
        if (Number.isFinite(duration) && duration > 0 && duration - currentTime < 2) {
            clearSavedPlaybackTime(videoId);
            return;
        }

        setSavedPlaybackTime(videoId, currentTime);
    } catch {}
}

export default function YouTubePlayer({ 
    videoId, 
    autoplay = true,
    onVideoEnd,
    onVideoReady,
    loop = false 
}: YouTubePlayerProps) {
    const playerHostRef = useRef<HTMLDivElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const playerInstanceRef = useRef<any>(null);
    const nativeVideoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any>(null);
    const loopRef = useRef(loop);
    const pendingSeekTimeRef = useRef<number | null>(null);
    const pendingAutoplayRef = useRef(autoplay);
    const [isApiReady, setIsApiReady] = useState(false);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [streamFormats, setStreamFormats] = useState<StreamFormat[]>([]);
    const [selectedStreamFormatId, setSelectedStreamFormatId] = useState('');
    const [useEmbedFallback, setUseEmbedFallback] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Fullscreen change listener
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        loopRef.current = loop;
    }, [loop]);

    // Load YouTube IFrame API
    useEffect(() => {
        if (window.YT && window.YT.Player) {
            setIsApiReady(true);
            return;
        }

        // Check if script already exists
        const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
        if (existingScript) {
            // Script exists, wait for it to load
            const checkYT = setInterval(() => {
                if (window.YT && window.YT.Player) {
                    setIsApiReady(true);
                    clearInterval(checkYT);
                }
            }, 100);
            return () => clearInterval(checkYT);
        }

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);

        window.onYouTubeIframeAPIReady = () => {
            console.log('YouTube IFrame API ready');
            setIsApiReady(true);
        };

        return () => {
            // Clean up
            window.onYouTubeIframeAPIReady = () => {};
        };
    }, []);

    // Initialize player when API is ready
    useEffect(() => {
        if (!isApiReady || !playerHostRef.current || !videoId) return;
        setIsPlayerReady(false);
        setError(null);
        setStreamUrl(null);
        setStreamFormats([]);
        setSelectedStreamFormatId('');
        setUseEmbedFallback(false);

        const savedStart = getSavedPlaybackTime(videoId);
        const playerVars: any = {
            autoplay: autoplay ? 1 : 0,
            controls: 1,
            rel: 0,
            modestbranding: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            widget_referrer: window.location.href,
            iv_load_policy: 3,
            fs: 0,
            disablekb: 0,
            color: 'white',
        };
        if (savedStart > 2) {
            playerVars.start = Math.max(0, Math.floor(savedStart) - 1);
        }

        // Destroy previous player instance if exists
        if (playerInstanceRef.current) {
            try {
                savePlayerPlaybackTime(videoId, playerInstanceRef.current);
                playerInstanceRef.current.destroy();
            } catch (e) {
                console.log('Error destroying player:', e);
            }
            playerInstanceRef.current = null;
        }

        const playerTarget = document.createElement('div');
        playerTarget.id = `youtube-player-${videoId}`;
        playerTarget.style.width = '100%';
        playerTarget.style.height = '100%';
        playerHostRef.current.replaceChildren(playerTarget);

        try {
            const player = new window.YT.Player(playerTarget, {
                videoId: videoId,
                playerVars,
                events: {
                    onReady: (event: any) => {
                        console.log('YouTube Player ready for video:', videoId);
                        setIsPlayerReady(true);
                        if (onVideoReady) onVideoReady();
                        
                        // Auto-play if enabled
                        if (autoplay) {
                            try {
                                event.target.playVideo();
                            } catch (e) {
                                console.log('Autoplay prevented:', e);
                            }
                        }
                    },
                    onStateChange: (event: any) => {
                        // Video ended
                        if (event.data === window.YT.PlayerState.ENDED) {
                            clearSavedPlaybackTime(videoId);
                            if (loopRef.current) {
                                // Loop mode: restart video
                                event.target.seekTo(0);
                                event.target.playVideo();
                            } else if (onVideoEnd) {
                                onVideoEnd();
                            }
                        }
                    },
                    onError: async (event: any) => {
                        console.warn('YouTube player could not play this video:', event.data);
                        setIsPlayerReady(true);
                        if (isEmbedFallbackError(event.data)) {
                            try {
                                event.target?.destroy?.();
                            } catch {}
                            playerInstanceRef.current = null;
                            setError(null);
                            const ytDlpStreamInfo = await getYtDlpStreamInfo(videoId);
                            if (ytDlpStreamInfo?.stream_url) {
                                setStreamUrl(ytDlpStreamInfo.stream_url);
                                setStreamFormats(ytDlpStreamInfo.formats || []);
                                setSelectedStreamFormatId(ytDlpStreamInfo.format_id || '');
                            } else {
                                setUseEmbedFallback(true);
                            }
                        } else {
                            setError(getPlayerErrorMessage(event.data));
                        }
                    },
                },
            });

            playerInstanceRef.current = player;
        } catch (error) {
            console.warn('Failed to create YouTube player:', error);
            setError('Không khởi tạo được trình phát video.');
        }

        return () => {
            if (playerInstanceRef.current) {
                try {
                    savePlayerPlaybackTime(videoId, playerInstanceRef.current);
                    playerInstanceRef.current.destroy();
                } catch (e) {
                    console.log('Error cleaning up player:', e);
                }
                playerInstanceRef.current = null;
            }
            playerHostRef.current?.replaceChildren();
        };
    }, [isApiReady, videoId, autoplay]);

    useEffect(() => {
        if (!isPlayerReady || !videoId) return;

        const interval = window.setInterval(() => {
            if (playerInstanceRef.current) {
                savePlayerPlaybackTime(videoId, playerInstanceRef.current);
            }
        }, 1500);

        return () => window.clearInterval(interval);
    }, [isPlayerReady, videoId]);

    useEffect(() => {
        const video = nativeVideoRef.current;
        if (!video || !streamUrl) return;

        let cancelled = false;
        const selectedFormat = streamFormats.find(format => format.format_id === selectedStreamFormatId);
        const shouldUseHls = Boolean(selectedFormat?.is_hls || isHlsUrl(streamUrl));

        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        const applyPendingPlaybackState = () => {
            const seekTime = pendingSeekTimeRef.current ?? getSavedPlaybackTime(videoId);
            if (seekTime > 2 && Number.isFinite(video.duration)) {
                video.currentTime = Math.min(Math.max(0, seekTime - 0.4), Math.max(0, video.duration - 0.2));
            } else if (seekTime > 2) {
                video.currentTime = Math.max(0, seekTime - 0.4);
            }
            pendingSeekTimeRef.current = null;

            if (pendingAutoplayRef.current) {
                video.play().catch(() => {});
            }
        };

        video.pause();
        video.removeAttribute('src');
        video.load();

        const attachStream = async () => {
            if (shouldUseHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
                await loadHlsScript();
                if (cancelled || !window.Hls) return;

                const hls = new window.Hls();
                hlsRef.current = hls;
                hls.loadSource(streamUrl);
                hls.attachMedia(video);
                hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                    applyPendingPlaybackState();
                });
                hls.on(window.Hls.Events.ERROR, () => {
                    setStreamUrl(null);
                    setUseEmbedFallback(true);
                });
                return;
            }

            video.src = streamUrl;
            video.onloadedmetadata = applyPendingPlaybackState;
            video.load();
        };

        attachStream().catch(() => {
            setStreamUrl(null);
            setUseEmbedFallback(true);
        });

        return () => {
            cancelled = true;
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            video.onloadedmetadata = null;
        };
    }, [selectedStreamFormatId, streamFormats, streamUrl, videoId]);

    const handleNativeQualityChange = (formatId: string) => {
        const selected = streamFormats.find(format => format.format_id === formatId);
        if (!selected || selected.stream_url === streamUrl) return;

        const video = nativeVideoRef.current;
        if (video) {
            savePlayerPlaybackTime(videoId, video);
            pendingSeekTimeRef.current = video.currentTime || getSavedPlaybackTime(videoId);
            pendingAutoplayRef.current = !video.paused;
        } else {
            pendingSeekTimeRef.current = getSavedPlaybackTime(videoId);
            pendingAutoplayRef.current = autoplay;
        }

        setSelectedStreamFormatId(selected.format_id);
        setStreamUrl(selected.stream_url);
    };

    return (
        <div 
            className="youtube-player-container"
            ref={playerContainerRef}
            style={{ 
                position: 'relative', 
                width: '100%', 
                aspectRatio: '16/9', 
                backgroundColor: '#000', 
                borderRadius: isFullscreen ? '0' : '12px', 
                overflow: 'hidden' 
            }}
        >
            {!isPlayerReady && !error && <PlayerSkeleton />}
            <div
                ref={playerHostRef}
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    display: streamUrl || useEmbedFallback ? 'none' : 'block',
                }}
            />
            {streamUrl && (
                <video
                    key={streamUrl}
                    ref={nativeVideoRef}
                    controls
                    autoPlay={autoplay}
                    loop={loop}
                    playsInline
                    onLoadedMetadata={(event) => {
                        const savedStart = getSavedPlaybackTime(videoId);
                        if (savedStart > 2 && !pendingSeekTimeRef.current) {
                            event.currentTarget.currentTime = Math.max(0, savedStart - 1);
                        }
                        onVideoReady?.();
                    }}
                    onTimeUpdate={(event) => {
                        savePlayerPlaybackTime(videoId, event.currentTarget);
                    }}
                    onEnded={() => {
                        clearSavedPlaybackTime(videoId);
                        onVideoEnd?.();
                    }}
                    onError={() => {
                        setStreamUrl(null);
                        setUseEmbedFallback(true);
                    }}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#000',
                    }}
                />
            )}
            {streamUrl && streamFormats.length > 1 && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 18,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.68)',
                    color: '#fff',
                }}>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)' }}>Chất lượng</span>
                    <select
                        value={selectedStreamFormatId}
                        onChange={(event) => handleNativeQualityChange(event.target.value)}
                        style={{
                            border: '1px solid rgba(255,255,255,0.24)',
                            borderRadius: '6px',
                            background: '#111',
                            color: '#fff',
                            height: '28px',
                            padding: '0 8px',
                        }}
                    >
                        {streamFormats.map(format => (
                            <option key={format.format_id} value={format.format_id}>
                                {format.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {useEmbedFallback && (
                <iframe
                    src={getRawEmbedSrc(videoId, autoplay, loop)}
                    title="YouTube video player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        border: 0,
                    }}
                />
            )}
            {error && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    flexDirection: 'column',
                    gap: '16px',
                    padding: '18px',
                    textAlign: 'center',
                    zIndex: 20,
                }}>
                    <div>{error}</div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                            onClick={() => window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#ff0000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Mở trên YouTube
                        </button>
                        {onVideoEnd && (
                            <button
                                onClick={onVideoEnd}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: 'rgba(255,255,255,0.16)',
                                    color: '#fff',
                                    border: '1px solid rgba(255,255,255,0.24)',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                }}
                            >
                                Video kế tiếp
                            </button>
                        )}
                    </div>
                </div>
            )}
            {/* Controls */}
            {!error && <div style={{
                position: 'absolute',
                bottom: '80px',
                right: '8px',
                display: 'flex',
                gap: '8px',
                zIndex: 10,
            }}>
                {/* Fullscreen button */}
                <button
                    onClick={() => {
                        if (document.fullscreenElement) {
                            document.exitFullscreen();
                        } else {
                            playerContainerRef.current?.requestFullscreen();
                        }
                    }}
                    style={{
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.8)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)'}
                    title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                    {isFullscreen ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                        </svg>
                    )}
                </button>
            </div>}
        </div>
    );
}

// Utility function to play a video
export function playVideo(videoId: string) {
    if (window.YT && window.YT.Player) {
        // Could create a new player instance or use existing one
        console.log('Playing video:', videoId);
    }
}

// Utility function to pause video
export function pauseVideo() {
    // Would need to reference player instance
}
