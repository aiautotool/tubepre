'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';

type PlayerSlotProps = {
    videoId: string;
    title?: string;
    autoplay?: boolean;
    loop?: boolean;
    onVideoEnd?: () => void;
};

export default function PlayerSlot({ videoId, title, autoplay = true, loop = false, onVideoEnd }: PlayerSlotProps) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const { play, setInlineHost, minimize } = usePlayer();

    useEffect(() => {
        if (!hostRef.current) return;
        setInlineHost(hostRef.current);

        return () => {
            setInlineHost(null);
        };
    }, [setInlineHost]);

    useEffect(() => {
        play({ videoId, title, autoplay, loop, onVideoEnd });
    }, [autoplay, loop, onVideoEnd, play, title, videoId]);

    return (
        <div ref={hostRef} className="watch-player-shell global-player-slot">
            <button type="button" className="watch-player-minimize-btn" onClick={minimize} title="Minimize video">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                </svg>
            </button>
        </div>
    );
}

