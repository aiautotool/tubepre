'use client';

import { CSSProperties, createContext, PointerEvent, ReactNode, TouchEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import YouTubePlayer from '../watch/YouTubePlayer';

type PlayerConfig = {
    videoId: string;
    title?: string;
    autoplay?: boolean;
    loop?: boolean;
    onVideoEnd?: () => void;
};

type PlayerContextType = {
    currentVideoId: string | null;
    isMini: boolean;
    play: (config: PlayerConfig) => void;
    setInlineHost: (host: HTMLElement | null) => void;
    minimize: () => void;
    expand: () => void;
    close: () => void;
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [player, setPlayer] = useState<PlayerConfig | null>(null);
    const [inlineHost, setInlineHost] = useState<HTMLElement | null>(null);
    const [isMini, setIsMini] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [inlineFrameStyle, setInlineFrameStyle] = useState<CSSProperties>({});
    const [dragOffset, setDragOffset] = useState(0);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const dragStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (pathname === '/watch' && inlineHost) {
            setIsMini(false);
        }
    }, [inlineHost, pathname]);

    useEffect(() => {
        if (player && pathname !== '/watch' && !isMini) {
            setIsMini(true);
        }
    }, [isMini, pathname, player]);

    const renderedMini = isMini || (pathname !== '/watch' && !inlineHost);

    const play = useCallback((config: PlayerConfig) => {
        setPlayer(prev => {
            const shouldReplace =
                !prev ||
                prev.videoId !== config.videoId ||
                prev.title !== config.title ||
                prev.loop !== config.loop ||
                prev.onVideoEnd !== config.onVideoEnd;

            return shouldReplace ? config : prev;
        });
    }, []);

    const minimize = useCallback(() => {
        if (!player) return;
        setIsMini(true);
        if (pathname === '/watch') {
            router.push('/');
        }
    }, [pathname, player, router]);

    const expand = useCallback(() => {
        if (!player) return;
        setIsMini(false);
        router.push(`/watch?v=${player.videoId}`);
    }, [player, router]);

    const close = useCallback(() => {
        setPlayer(null);
        setInlineHost(null);
        setIsMini(false);
        setDragOffset(0);
    }, []);

    const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
        const touch = event.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }, []);

    const handleTouchEnd = useCallback((event: TouchEvent<HTMLDivElement>) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        if (!start) return;

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;

        if (!isMini && deltaY > 70 && Math.abs(deltaY) > Math.abs(deltaX) * 1.4) {
            minimize();
        }
    }, [isMini, minimize]);

    const handleDragPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
        if (renderedMini) return;
        dragStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    }, [renderedMini]);

    const handleDragPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
        const start = dragStartRef.current;
        if (!start || start.pointerId !== event.pointerId || renderedMini) return;

        const deltaY = event.clientY - start.y;
        const deltaX = event.clientX - start.x;
        if (deltaY <= 0 || Math.abs(deltaY) < Math.abs(deltaX) * 0.6) {
            setDragOffset(0);
            return;
        }

        setDragOffset(Math.min(deltaY, 180));
    }, [renderedMini]);

    const handleDragPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
        const start = dragStartRef.current;
        dragStartRef.current = null;
        setDragOffset(0);
        if (!start || start.pointerId !== event.pointerId || renderedMini) return;

        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        if (deltaY > 58 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
            minimize();
        }
    }, [minimize, renderedMini]);

    const value = useMemo(() => ({
        currentVideoId: player?.videoId ?? null,
        isMini,
        play,
        setInlineHost,
        minimize,
        expand,
        close,
    }), [close, expand, isMini, minimize, play, player?.videoId]);

    const target = mounted && player ? document.body : null;
    const playerFrameStyle = renderedMini ? undefined : {
        ...inlineFrameStyle,
        transform: dragOffset > 0 ? `translateY(${dragOffset}px) scale(${Math.max(0.92, 1 - dragOffset / 1400)})` : undefined,
        transition: dragOffset > 0 ? 'none' : 'transform 0.16s ease',
    };

    useEffect(() => {
        if (!inlineHost || renderedMini) {
            setInlineFrameStyle({});
            return;
        }

        let animationFrame = 0;
        const updateInlineFrame = () => {
            cancelAnimationFrame(animationFrame);
            animationFrame = requestAnimationFrame(() => {
                const rect = inlineHost.getBoundingClientRect();
                setInlineFrameStyle({
                    position: 'fixed',
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                });
            });
        };

        updateInlineFrame();
        window.addEventListener('resize', updateInlineFrame);
        window.addEventListener('scroll', updateInlineFrame, true);

        const resizeObserver = new ResizeObserver(updateInlineFrame);
        resizeObserver.observe(inlineHost);

        return () => {
            cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateInlineFrame);
            window.removeEventListener('scroll', updateInlineFrame, true);
        };
    }, [inlineHost, renderedMini]);

    return (
        <PlayerContext.Provider value={value}>
            {children}
            {target && player && createPortal(
                <div
                    className={`global-player-frame ${renderedMini ? 'mini' : 'inline'}`}
                    style={playerFrameStyle}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div
                        className="global-player-drag-handle"
                        onClick={renderedMini ? expand : undefined}
                        onPointerDown={handleDragPointerDown}
                        onPointerMove={handleDragPointerMove}
                        onPointerUp={handleDragPointerUp}
                        onPointerCancel={handleDragPointerUp}
                    >
                        <span />
                    </div>
                    {renderedMini && (
                        <div className="global-player-mini-controls">
                            <button type="button" onClick={expand} title="Expand video">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                                </svg>
                            </button>
                            <button type="button" onClick={close} title="Close video">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                                    <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.29 19.71 2.88 18.3 9.17 12 2.88 5.7 4.29 4.29l6.3 6.3 6.3-6.3z" />
                                </svg>
                            </button>
                        </div>
                    )}
                    <YouTubePlayer
                        videoId={player.videoId}
                        title={player.title}
                        autoplay={player.autoplay ?? true}
                        onVideoEnd={player.onVideoEnd}
                        loop={player.loop}
                    />
                </div>,
                target
            )}
        </PlayerContext.Provider>
    );
}

export function usePlayer() {
    const context = useContext(PlayerContext);
    if (!context) {
        throw new Error('usePlayer must be used within a PlayerProvider');
    }
    return context;
}
