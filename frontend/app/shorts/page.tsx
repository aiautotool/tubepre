'use client';

import { useState, useEffect, useRef } from 'react';
import { IoHeart, IoHeartOutline, IoChatbubbleOutline, IoShareOutline, IoEllipsisHorizontal, IoMusicalNote, IoRefresh, IoVolumeMute, IoVolumeHigh } from 'react-icons/io5';
import LoadingSpinner from '../components/LoadingSpinner';
import { apiUrl } from '../lib/api';

declare global {
    interface Window {
        Hls: any;
    }
}

interface ShortVideo {
    id: string;
    title: string;
    uploader: string;
    thumbnail: string;
    view_count: number;
    duration?: string;
}

interface StreamInfo {
    stream_url: string;
    error?: string;
}

const SHORTS_QUERIES = ['#shorts', 'youtube shorts viral', 'tiktok short', 'shorts funny', 'shorts music'];
const RANDOM_MODIFIERS = ['viral', 'popular', 'new', 'best', 'trending', 'hot', 'fresh', '2025'];

function getRandomModifier(): string {
    return RANDOM_MODIFIERS[Math.floor(Math.random() * RANDOM_MODIFIERS.length)];
}

function parseDuration(duration: string): number {
    if (!duration) return 0;
    const parts = duration.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
}

function formatViews(views: number): string {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
}

async function fetchShorts(page: number): Promise<ShortVideo[]> {
    try {
        const query = SHORTS_QUERIES[page % SHORTS_QUERIES.length] + ' ' + getRandomModifier();
        const res = await fetch(apiUrl(`/search?q=${encodeURIComponent(query)}&limit=20`), { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        return data.filter((v: ShortVideo) => parseDuration(v.duration || '') <= 90);
    } catch {
        return [];
    }
}

function ShortCard({ video, isActive }: { video: ShortVideo; isActive: boolean }) {
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 50000) + 1000);
    const [commentCount] = useState(Math.floor(Math.random() * 1000) + 50);
    const [muted, setMuted] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [useFallback, setUseFallback] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any>(null);
    const [showControls, setShowControls] = useState(false);

    useEffect(() => {
        if (!isActive) {
            if (videoRef.current) {
                videoRef.current.pause();
            }
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            return;
        }

        if (useFallback) return;

        const loadStream = async () => {
            setLoading(true);
            setError(false);

            try {
                const res = await fetch(apiUrl(`/get_stream_info?v=${video.id}`));
                if (!res.ok) {
                    throw new Error(`Stream API returned ${res.status}`);
                }
                const data: StreamInfo = await res.json();

                if (data.error || !data.stream_url) {
                    throw new Error(data.error || 'No stream URL');
                }

                const videoEl = videoRef.current;
                if (!videoEl) return;

                const streamUrl = data.stream_url;
                const isHLS = streamUrl.includes('.m3u8') || streamUrl.includes('manifest');

                if (isHLS && window.Hls && window.Hls.isSupported()) {
                    if (hlsRef.current) {
                        hlsRef.current.destroy();
                    }

                    const hls = new window.Hls({
                        xhrSetup: (xhr: XMLHttpRequest) => {
                            xhr.setRequestHeader('Referer', 'https://www.youtube.com/');
                        },
                    });
                    hlsRef.current = hls;

                    hls.loadSource(streamUrl);
                    hls.attachMedia(videoEl);

                    hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                        setLoading(false);
                        videoEl.muted = muted;
                        videoEl.play().catch(() => {});
                    });

                    hls.on(window.Hls.Events.ERROR, () => {
                        setError(true);
                        setUseFallback(true);
                    });
                } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
                    videoEl.src = streamUrl;
                    videoEl.muted = muted;
                    videoEl.addEventListener('loadedmetadata', () => {
                        setLoading(false);
                        videoEl.play().catch(() => {});
                    }, { once: true });
                } else {
                    videoEl.src = streamUrl;
                    videoEl.muted = muted;
                    videoEl.addEventListener('loadeddata', () => {
                        setLoading(false);
                        videoEl.play().catch(() => {});
                    }, { once: true });
                }
            } catch (err) {
                console.warn('Stream load error:', err);
                setError(true);
                setUseFallback(true);
            }
        };

        const timeout = setTimeout(() => {
            if (window.Hls) {
                loadStream();
            } else {
                const checkHls = setInterval(() => {
                    if (window.Hls) {
                        clearInterval(checkHls);
                        loadStream();
                    }
                }, 100);

                setTimeout(() => {
                    clearInterval(checkHls);
                    if (!window.Hls) {
                        setUseFallback(true);
                    }
                }, 3000);
            }
        }, 100);

        return () => {
            clearTimeout(timeout);
        };
    }, [isActive, video.id, useFallback, muted]);

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setMuted(videoRef.current.muted);
        }
    };

    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: video.title,
                    url: `${window.location.origin}/watch?v=${video.id}`,
                });
            } else {
                await navigator.clipboard.writeText(`${window.location.origin}/watch?v=${video.id}`);
            }
        } catch {}
    };

    const handleRetry = () => {
        setUseFallback(false);
        setError(false);
        setLoading(false);
    };

    return (
        <div
            style={cardWrapperStyle}
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
        >
            <div style={cardContainerStyle}>
                {useFallback ? (
                    <iframe
                        src={isActive ? `https://www.youtube.com/embed/${video.id}?autoplay=1&loop=1&playlist=${video.id}&mute=${muted ? 1 : 0}&rel=0&modestbranding=1&playsinline=1&controls=1` : undefined}
                        style={iframeStyle}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={video.title}
                    />
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            style={videoStyle}
                            loop
                            playsInline
                            poster={video.thumbnail}
                            onClick={() => videoRef.current?.paused ? videoRef.current?.play() : videoRef.current?.pause()}
                        />
                        {loading && (
                            <div style={loadingOverlayStyle}>
                                <LoadingSpinner color="white" />
                            </div>
                        )}
                        {error && !useFallback && (
                            <div style={errorOverlayStyle}>
                                <button onClick={handleRetry} style={retryBtnStyle}>
                                    Retry
                                </button>
                                <button onClick={() => setUseFallback(true)} style={retryBtnStyle}>
                                    YouTube Player
                                </button>
                            </div>
                        )}
                    </>
                )}

                <div style={gradientStyle} />

                <div style={infoStyle}>
                    <div style={channelStyle}>
                        <div style={avatarStyle}>{video.uploader?.[0]?.toUpperCase() || '?'}</div>
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>@{video.uploader || 'Unknown'}</span>
                    </div>
                    <p style={titleStyle}>{video.title}</p>
                    <div style={musicStyle}><IoMusicalNote size={12} /><span>Original Sound</span></div>
                </div>

                <div style={actionsStyle}>
                    <button onClick={() => { setLiked(!liked); setLikeCount(p => liked ? p - 1 : p + 1); }} style={actionBtnStyle}>
                        {liked ? <IoHeart size={26} color="#ff0050" /> : <IoHeartOutline size={26} />}
                        <span style={actionLabelStyle}>{formatViews(likeCount)}</span>
                    </button>
                    <button style={actionBtnStyle}>
                        <IoChatbubbleOutline size={24} />
                        <span style={actionLabelStyle}>{formatViews(commentCount)}</span>
                    </button>
                    <button onClick={handleShare} style={actionBtnStyle}>
                        <IoShareOutline size={24} />
                        <span style={actionLabelStyle}>Share</span>
                    </button>
                    <button onClick={toggleMute} style={actionBtnStyle}>
                        {muted ? <IoVolumeMute size={24} /> : <IoVolumeHigh size={24} />}
                        <span style={actionLabelStyle}>{muted ? 'Unmute' : 'Mute'}</span>
                    </button>
                    <a
                        href={`https://www.youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={actionBtnStyle}
                    >
                        <IoEllipsisHorizontal size={22} />
                    </a>
                </div>

                {showControls && (
                    <a
                        href={`https://www.youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={openBtnStyle}
                    >
                        Open ↗
                    </a>
                )}
            </div>
        </div>
    );
}

const cardWrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    scrollSnapAlign: 'start',
    scrollSnapStop: 'always',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const cardContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: '400px',
    height: '100%',
    maxHeight: 'calc(100vh - 120px)',
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#0f0f0f',
};

const videoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    background: '#000',
    cursor: 'pointer',
};

const iframeStyle: React.CSSProperties = { width: '100%', height: '100%', border: 'none' };

const loadingOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)',
};

const errorOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    background: 'rgba(0,0,0,0.8)',
};

const retryBtnStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: '#ff0050',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
};

const gradientStyle: React.CSSProperties = {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.85))', pointerEvents: 'none',
};

const infoStyle: React.CSSProperties = {
    position: 'absolute', bottom: '16px', left: '16px', right: '70px', color: '#fff', pointerEvents: 'none',
};

const channelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' };

const avatarStyle: React.CSSProperties = {
    width: '32px', height: '32px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #ff0050, #ff4081)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: '700', color: '#fff', flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
    fontSize: '13px', lineHeight: '18px', margin: '0 0 6px 0',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
};

const musicStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', opacity: 0.7 };

const actionsStyle: React.CSSProperties = {
    position: 'absolute', right: '10px', bottom: '80px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
};

const actionBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
};

const actionLabelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: '500' };

const openBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    padding: '6px 10px',
    background: 'rgba(0,0,0,0.8)',
    color: '#fff',
    borderRadius: '4px',
    textDecoration: 'none',
    fontSize: '11px',
    zIndex: 10,
};

export default function ShortsPage() {
    const [shorts, setShorts] = useState<ShortVideo[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef(0);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
        script.async = true;
        if (!document.querySelector('script[src*="hls.js"]')) {
            document.head.appendChild(script);
        }
    }, []);

    useEffect(() => { activeRef.current = activeIndex; }, [activeIndex]);
    useEffect(() => { fetchShorts(0).then(d => { setShorts(d); setLoading(false); }); }, []);

    useEffect(() => {
        const c = containerRef.current;
        if (!c || !shorts.length) return;
        const onScroll = () => {
            const idx = Math.round(c.scrollTop / c.clientHeight);
            if (idx !== activeRef.current && idx >= 0 && idx < shorts.length) setActiveIndex(idx);
        };
        c.addEventListener('scroll', onScroll, { passive: true });
        return () => c.removeEventListener('scroll', onScroll);
    }, [shorts.length]);

    useEffect(() => {
        if (activeIndex >= shorts.length - 2 && !loadingMore) {
            setLoadingMore(true);
            fetchShorts(page + 1).then(d => {
                if (d.length) {
                    const exist = new Set(shorts.map(v => v.id));
                    setShorts(p => [...p, ...d.filter(v => !exist.has(v.id))]);
                    setPage(p => p + 1);
                }
                setLoadingMore(false);
            });
        }
    }, [activeIndex, shorts.length, loadingMore, page]);

    const refresh = () => { setLoading(true); setPage(0); setActiveIndex(0); fetchShorts(0).then(d => { setShorts(d); setLoading(false); }); };

    if (loading) return (
        <div style={pageStyle}>
            <div style={{ ...spinnerContainerStyle, width: '300px', height: '500px' }}>
                <LoadingSpinner color="white" />
            </div>
        </div>
    );

    if (!shorts.length) return (
        <div style={{ ...pageStyle, color: '#fff' }}>
            <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: '16px' }}>No shorts found</p>
                <button onClick={refresh} style={{ padding: '10px 20px', background: '#ff0050', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}>
                    <IoRefresh size={18} /> Refresh
                </button>
            </div>
        </div>
    );

    return (
        <div ref={containerRef} style={scrollContainerStyle}>
            <style>{hideScrollbarCss}</style>
            {shorts.map((v, i) => <ShortCard key={v.id} video={v} isActive={i === activeIndex} />)}
            {loadingMore && (
                <div style={{ ...pageStyle, height: '100vh' }}>
                    <LoadingSpinner color="white" />
                </div>
            )}
        </div>
    );
}

const pageStyle: React.CSSProperties = { height: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' };
const scrollContainerStyle: React.CSSProperties = { height: 'calc(100vh - 56px)', overflowY: 'scroll', scrollSnapType: 'y mandatory', background: '#0f0f0f', scrollbarWidth: 'none' };
const spinnerContainerStyle: React.CSSProperties = { borderRadius: '12px', background: 'linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const hideScrollbarCss = 'div::-webkit-scrollbar { display: none; }';
