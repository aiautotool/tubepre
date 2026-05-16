'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getVideoDetailsClient, getRelatedVideosClient, getCommentsClient, searchVideosClient } from '../clientActions';
import { VideoData } from '../constants';
import { isVideoSaved, toggleSaveVideo } from '../storage';
import LoadingSpinner from '../components/LoadingSpinner';
import PlayerSlot from '../components/PlayerSlot';
import Link from 'next/link';
import { apiUrl } from '../lib/api';

// Simple cache for API responses to reduce quota usage
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCachedData(key: string) {
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

function setCachedData(key: string, data: any) {
    apiCache.set(key, { data, timestamp: Date.now() });
    // Clean up old cache entries
    if (apiCache.size > 100) {
        const oldestKey = apiCache.keys().next().value;
        if (oldestKey) {
            apiCache.delete(oldestKey);
        }
    }
}

// Video Info Section
function VideoInfo({ video }: { video: any }) {
    const [expanded, setExpanded] = useState(false);
    const [subscribed, setSubscribed] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [subscribing, setSubscribing] = useState(false);

    // Check subscription status via API and save status on mount
    useEffect(() => {
        if (video?.channelId) {
            fetch(apiUrl(`/subscribe?channel_id=${encodeURIComponent(video.channelId)}`))
                .then(r => r.json())
                .then(data => setSubscribed(data.subscribed))
                .catch(() => setSubscribed(false));
        }
        if (video?.id) {
            setIsSaved(isVideoSaved(video.id));
        }
    }, [video?.channelId, video?.id]);

    const handleSubscribe = useCallback(async () => {
        if (!video?.channelId || subscribing) return;
        setSubscribing(true);
        try {
            if (subscribed) {
                const res = await fetch(apiUrl(`/subscribe?channel_id=${encodeURIComponent(video.channelId)}`), { method: 'DELETE' });
                if (res.ok) setSubscribed(false);
            } else {
                const res = await fetch(apiUrl('/subscribe'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel_id: video.channelId,
                        channel_name: video.channelTitle || video.channelId,
                        channel_avatar: '',
                    }),
                });
                if (res.ok) setSubscribed(true);
            }
        } catch (error) {
            console.error('Subscribe error:', error);
        } finally {
            setSubscribing(false);
        }
    }, [video?.channelId, video?.channelTitle, subscribed, subscribing]);

    const handleSave = useCallback(() => {
        if (!video?.id) return;
        
        try {
            const nowSaved = toggleSaveVideo({
                videoId: video.id,
                title: video.title,
                thumbnail: video.thumbnail,
                channelTitle: video.channelTitle,
            });
            setIsSaved(nowSaved);
        } catch (error) {
            console.error('Save error:', error);
        }
    }, [video?.id, video?.title, video?.thumbnail, video?.channelTitle]);
    
    if (!video) return null;
    
    const description = video.description || '';
    const hasDescription = description.length > 0;
    const shouldTruncate = description.length > 300;
    const displayDescription = expanded ? description : description.slice(0, 300) + (shouldTruncate ? '...' : '');
    
    // Format date
    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr === 'Invalid Date') return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        } catch {
            return '';
        }
    };
    
    // Format view count
    const formatViews = (views: string) => {
        if (!views || views === '0') return 'No views';
        const num = parseInt(views.replace(/[^0-9]/g, '') || '0');
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M views';
        if (num >= 1000) return (num / 1000).toFixed(0) + 'K views';
        return num.toLocaleString() + ' views';
    };
    
    return (
        <div style={{ padding: '12px 0' }}>
            {/* Title */}
            <h1 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                marginBottom: '8px', 
                color: 'var(--yt-text-primary)',
                lineHeight: '1.3',
            }}>
                {video.title || 'Untitled Video'}
            </h1>
            
            {/* Channel Info & Actions Row */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--yt-border)',
            }}>
                {/* Channel - only show name, no avatar */}
                <div style={{ 
                    color: 'var(--yt-text-primary)', 
                    fontWeight: '500', 
                    fontSize: '14px',
                }}>
                    {video.channelTitle || 'Unknown Channel'}
                </div>
                
                {/* Action Buttons - Subscribe, Share, Save */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Subscribe Button with Toggle State */}
                    <button 
                        onClick={handleSubscribe}
                        disabled={subscribing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            backgroundColor: subscribed ? 'var(--yt-hover)' : '#cc0000',
                            color: subscribed ? 'var(--yt-text-primary)' : '#fff',
                            border: subscribed ? '1px solid var(--yt-border)' : 'none',
                            borderRadius: '18px',
                            cursor: subscribing ? 'wait' : 'pointer',
                            fontWeight: '500',
                            fontSize: '13px',
                            transition: 'all 0.2s',
                            opacity: subscribing ? 0.7 : 1,
                        }}
                    >
                        {subscribing ? (
                            '...'
                        ) : subscribed ? (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                                </svg>
                                Subscribed
                            </>
                        ) : (
                            'Subscribe'
                        )}
                    </button>
                    
                    {/* Share Button */}
                    <button 
                        onClick={async () => {
                            try {
                                if (typeof navigator !== 'undefined' && navigator.share) {
                                    try {
                                        await navigator.share({
                                            title: video.title || 'Check out this video',
                                            url: window.location.href,
                                        });
                                        return;
                                    } catch (shareErr: any) {
                                        if (shareErr.name === 'AbortError') {
                                            return;
                                        }
                                    }
                                }
                                await navigator.clipboard.writeText(window.location.href);
                                alert('Link copied to clipboard!');
                            } catch (err) {
                                alert('Could not share or copy link');
                            }
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            backgroundColor: 'var(--yt-hover)',
                            color: 'var(--yt-text-primary)',
                            border: 'none',
                            borderRadius: '18px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            transition: 'background-color 0.2s',
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9.41 15.95L12 13.36l2.59 2.59L16 14.54l-2.59-2.59L16 9.36l-1.41-1.41L12 10.54 9.41 7.95 8 9.36l2.59 2.59L8 14.54z"/>
                        </svg>
                        Share
                    </button>
                    
                    {/* Save Button with Toggle State */}
                    <button 
                        onClick={handleSave}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            backgroundColor: isSaved ? 'var(--yt-blue)' : 'var(--yt-hover)',
                            color: isSaved ? '#fff' : 'var(--yt-text-primary)',
                            border: 'none',
                            borderRadius: '18px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            transition: 'all 0.2s',
                        }}
                    >
                        {isSaved ? (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                                </svg>
                                Saved
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/>
                                </svg>
                                Save
                            </>
                        )}
                    </button>
                </div>
            </div>
            
            {/* Description Box */}
            <div style={{
                backgroundColor: 'var(--yt-hover)',
                borderRadius: '12px',
                padding: '12px',
                marginTop: '12px',
            }}>
                {/* Views and Date */}
                <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    marginBottom: '8px', 
                    fontSize: '13px', 
                    fontWeight: '600', 
                    color: 'var(--yt-text-primary)' 
                }}>
                    <span>{formatViews(video.viewCount)}</span>
                    {video.publishedAt && formatDate(video.publishedAt) && (
                        <>
                            <span>•</span>
                            <span>{formatDate(video.publishedAt)}</span>
                        </>
                    )}
                </div>
                
                {/* Description */}
                {hasDescription ? (
                    <div style={{ 
                        fontSize: '13px', 
                        color: 'var(--yt-text-primary)',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                    }}>
                        {displayDescription}
                        {shouldTruncate && (
                            <button 
                                onClick={() => setExpanded(!expanded)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--yt-blue)',
                                    cursor: 'pointer',
                                    fontWeight: '500',
                                    padding: 0,
                                    marginLeft: '4px',
                                }}
                            >
                                {expanded ? ' Show less' : ' ...more'}
                            </button>
                        )}
                    </div>
                ) : null}
                
                {/* Tags */}
                {video.tags && video.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                        {video.tags.slice(0, 10).map((tag: string, i: number) => (
                            <span key={i} style={{
                                backgroundColor: 'var(--yt-background)',
                                padding: '4px 10px',
                                borderRadius: '14px',
                                fontSize: '12px',
                                color: 'var(--yt-blue)',
                                cursor: 'pointer',
                            }}>
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Mix Playlist Component
function MixPlaylist({ videos, currentIndex, onVideoSelect, title }: { 
    videos: VideoData[]; 
    currentIndex: number; 
    onVideoSelect: (index: number) => void;
    title?: string;
}) {
    return (
        <div style={{
            backgroundColor: 'var(--yt-hover)',
            borderRadius: '12px',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--yt-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--yt-text-primary)' }}>
                        {title || 'Mix Playlist'}
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--yt-text-secondary)', margin: '2px 0 0 0' }}>
                        {videos.length} videos • Auto-play is on
                    </p>
                </div>
            </div>
            
            {/* Video List */}
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {videos.map((video, index) => (
                    <div 
                        key={video.id}
                        onClick={() => onVideoSelect(index)}
                        style={{
                            display: 'flex',
                            gap: '10px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            backgroundColor: index === currentIndex ? 'var(--yt-active)' : 'transparent',
                            borderLeft: index === currentIndex ? '3px solid var(--yt-blue)' : '3px solid transparent',
                            transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            if (index !== currentIndex) {
                                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (index !== currentIndex) {
                                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            }
                        }}
                    >
                        {/* Thumbnail with index */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <img 
                                src={video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`}
                                alt={video.title}
                                style={{ 
                                    width: '100px', 
                                    height: '56px', 
                                    objectFit: 'cover',
                                    borderRadius: '6px',
                                }}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${video.id}/default.jpg`;
                                }}
                            />
                            <div style={{
                                position: 'absolute',
                                bottom: '3px',
                                left: '3px',
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                color: '#fff',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                fontSize: '10px',
                            }}>
                                {index + 1}/{videos.length}
                            </div>
                            {index === currentIndex && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    borderRadius: '50%',
                                    padding: '6px',
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                                    </svg>
                                </div>
                            )}
                        </div>
                        
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ 
                                fontSize: '12px', 
                                fontWeight: index === currentIndex ? '600' : '500',
                                color: 'var(--yt-text-primary)',
                                lineHeight: '1.2',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }}>
                                {video.title}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--yt-text-secondary)', marginTop: '2px' }}>
                                {video.uploader}
                            </div>
                            {video.duration && (
                                <div style={{ fontSize: '10px', color: 'var(--yt-text-secondary)', marginTop: '1px' }}>
                                    {video.duration}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Comment Section
function CommentSection({ videoId }: { videoId: string }) {
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        const loadComments = async () => {
            try {
                const data = await getCommentsClient(videoId, 50);
                setComments(data);
            } catch (error) {
                console.error('Failed to load comments:', error);
            } finally {
                setLoading(false);
            }
        };
        loadComments();
    }, [videoId]);

    if (loading) {
        return (
            <div style={{ padding: '24px 0', color: 'var(--yt-text-secondary)' }}>
                Loading comments...
            </div>
        );
    }

    const displayedComments = showAll ? comments : comments.slice(0, 5);

    return (
        <div style={{ padding: '24px 0', borderTop: '1px solid var(--yt-border)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--yt-text-primary)' }}>
                {comments.length} Comments
            </h2>
            
            {/* Sort dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--yt-text-secondary)">
                    <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>
                </svg>
                <span style={{ fontSize: '14px', color: 'var(--yt-text-secondary)' }}>Sort by</span>
            </div>

            {/* Comments List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {displayedComments.map((comment) => (
                    <div key={comment.id} style={{ display: 'flex', gap: '12px' }}>
                        {comment.author_thumbnail ? (
                            <img 
                                src={comment.author_thumbnail}
                                alt={comment.author}
                                style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--yt-hover)', flexShrink: 0 }}
                            />
                        ) : null}
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--yt-text-primary)' }}>
                                    {comment.author}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--yt-text-secondary)' }}>
                                    {comment.timestamp}
                                </span>
                            </div>
                            <div style={{ fontSize: '14px', color: 'var(--yt-text-primary)', marginTop: '4px', lineHeight: '1.5' }}>
                                {comment.text}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                                <button style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--yt-text-secondary)',
                                    fontSize: '12px',
                                }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
                                    </svg>
                                    {comment.likes}
                                </button>
                                <button style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--yt-text-secondary)',
                                    fontSize: '12px',
                                }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2z"/>
                                    </svg>
                                </button>
                                <button style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--yt-blue)',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                }}>
                                    Reply
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            {comments.length > 5 && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    style={{
                        marginTop: '16px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--yt-blue)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        padding: '8px 0',
                    }}
                >
                    {showAll ? 'Show less' : `Show all ${comments.length} comments`}
                </button>
            )}
        </div>
    );
}

export default function ClientWatchPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const videoId = searchParams.get('v');
    const [videoInfo, setVideoInfo] = useState<any>(null);
    const [relatedVideos, setRelatedVideos] = useState<VideoData[]>([]);
    const [mixPlaylist, setMixPlaylist] = useState<VideoData[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [activeTab, setActiveTab] = useState<'upnext' | 'mix'>('upnext');
    const [apiError, setApiError] = useState<string | null>(null);
    const [wideMode, setWideMode] = useState(false);
    const [loopMode, setLoopMode] = useState(false);

    // Scroll to top when video changes or page loads
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [videoId]);

    useEffect(() => {
        if (!videoId) return;

        const loadVideoData = async () => {
            try {
                setLoading(true);
                setApiError(null);
                
                // Check cache for video details
                let video = getCachedData(`video_${videoId}`);
                if (!video) {
                    video = await getVideoDetailsClient(videoId);
                    if (video) setCachedData(`video_${videoId}`, video);
                }
                setVideoInfo(video);
                
                // Add to watch history via API
                if (video) {
                    fetch(apiUrl('/history'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            video_id: videoId,
                            title: video.title,
                            thumbnail: video.thumbnail,
                        }),
                    }).catch(() => {});
                }
                
                // Get related videos - use channel name and video title for better results
                // Even if video is null, we can still try to get related videos
                const searchTerms = video?.title?.split(' ').filter((w: string) => w.length > 3).slice(0, 5).join(' ') || 'music';
                const channelName = video?.channelTitle || '';
                
                // Check cache for related videos
                const cacheKey = `related_${videoId}_${searchTerms}`;
                let relatedResults = getCachedData(cacheKey);
                let mixResults = getCachedData(`mix_${videoId}_${searchTerms}`);
                
                if (!relatedResults || !mixResults) {
                    // Optimized: Use just 2 search requests instead of 5 to save API quota
                    [relatedResults, mixResults] = await Promise.all([
                        searchVideosClient(`${channelName} ${searchTerms}`, 20),
                        searchVideosClient(`${searchTerms} mix compilation`, 20),
                    ]);
                    
                    if (relatedResults && relatedResults.length > 0) setCachedData(cacheKey, relatedResults);
                    if (mixResults && mixResults.length > 0) setCachedData(`mix_${videoId}_${searchTerms}`, mixResults);
                }
                
                // Deduplicate and filter related videos - ensure arrays
                const uniqueRelated = Array.isArray(relatedResults) ? relatedResults.filter((v, index, self) =>
                    index === self.findIndex(item => item.id === v.id) && v.id !== videoId
                ) : [];
                
                setCurrentIndex(0);
                setRelatedVideos(uniqueRelated);

                // Use remaining videos for mix playlist - ensure array
                const uniqueMix = Array.isArray(mixResults) ? mixResults.filter((v, index, self) =>
                    index === self.findIndex(item => item.id === v.id) && 
                    v.id !== videoId &&
                    !uniqueRelated.some(r => r.id === v.id)
                ) : [];
                
                setMixPlaylist(uniqueMix.slice(0, 20));
                
                // Set error message if video details failed but we have related videos
                if (!video) {
                    setApiError('Video info unavailable, but you can still browse related videos.');
                }
            } catch (error) {
                console.error('Failed to load video data:', error);
                // Fallback with fewer requests
                try {
                    const fallbackResults = await searchVideosClient('music popular', 20);
                    setRelatedVideos(Array.isArray(fallbackResults) ? fallbackResults.slice(0, 10) : []);
                    setMixPlaylist(Array.isArray(fallbackResults) ? fallbackResults.slice(10, 20) : []);
                    setApiError('Unable to load video details. Showing suggested videos instead.');
                } catch (e: any) {
                    console.error('Fallback also failed:', e);
                    // Set empty arrays to show user-friendly message
                    setRelatedVideos([]);
                    setMixPlaylist([]);
                    
                    // Set user-friendly error message
                    if (e?.message?.includes('quota exceeded')) {
                        setApiError('YouTube API quota exceeded. Please try again later.');
                    } else if (e?.message?.includes('API key')) {
                        setApiError('API key issue. Please check configuration.');
                    } else {
                        setApiError('Unable to load related videos. Please try again.');
                    }
                }
            } finally {
                setLoading(false);
            }
        };

        loadVideoData();
    }, [videoId]);

    const handleVideoSelect = (index: number) => {
        const video = activeTab === 'upnext' ? relatedVideos[index] : mixPlaylist[index];
        if (video) {
            router.push(`/watch?v=${video.id}`);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            const prevVideo = relatedVideos[currentIndex - 1];
            router.push(`/watch?v=${prevVideo.id}`);
        }
    };

    const handleNext = () => {
        const playlist = activeTab === 'mix' ? mixPlaylist : relatedVideos;
        if (currentIndex < playlist.length - 1) {
            const nextVideo = playlist[currentIndex + 1];
            router.push(`/watch?v=${nextVideo.id}`);
        }
    };

    const handleVideoEnd = () => {
        const playlist = activeTab === 'mix' ? mixPlaylist : relatedVideos;
        if (currentIndex < playlist.length - 1) {
            handleNext();
        }
    };

    if (!videoId) {
        return <div style={{ padding: '2rem', color: 'var(--yt-text-primary)' }}>No video ID provided</div>;
    }

    if (loading) {
        return <LoadingSpinner fullScreen size="large" text="Loading video..." />;
    }

    const currentPlaylist = activeTab === 'mix' ? mixPlaylist : relatedVideos;

    return (
        <div style={{ 
            backgroundColor: 'var(--yt-background)', 
            color: 'var(--yt-text-primary)', 
            minHeight: '100vh',
        }}>
            <div className="watch-page-container" style={{ 
                maxWidth: wideMode ? '100%' : '1800px', 
                width: '100%',
                margin: '0 auto',
                padding: '24px',
                display: 'grid',
                gridTemplateColumns: wideMode ? '1fr' : '1fr 400px',
                gap: '24px',
                boxSizing: 'border-box',
            }}>
                {/* Main Content */}
                <div className="watch-main">
                    {/* Video Player */}
                    <div className="watch-player-shell" style={{ position: 'relative', width: '100%' }}>
                        <PlayerSlot
                            videoId={videoId}
                            title={videoInfo?.title}
                            autoplay={true}
                            onVideoEnd={handleVideoEnd}
                            loop={loopMode}
                        />
                    </div>

                    {/* Player Controls */}
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '8px 0',
                        gap: '8px',
                    }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handlePrevious}
                                disabled={currentIndex <= 0}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 16px',
                                    backgroundColor: currentIndex > 0 ? 'var(--yt-hover)' : 'transparent',
                                    color: currentIndex > 0 ? 'var(--yt-text-primary)' : 'var(--yt-text-secondary)',
                                    border: '1px solid var(--yt-border)',
                                    borderRadius: '18px',
                                    cursor: currentIndex > 0 ? 'pointer' : 'not-allowed',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    opacity: currentIndex > 0 ? 1 : 0.5,
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                                </svg>
                                Previous
                            </button>
                            
                            <button
                                onClick={handleNext}
                                disabled={currentIndex >= currentPlaylist.length - 1}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 16px',
                                    backgroundColor: currentIndex < currentPlaylist.length - 1 ? 'var(--yt-blue)' : 'var(--yt-hover)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '18px',
                                    cursor: currentIndex < currentPlaylist.length - 1 ? 'pointer' : 'not-allowed',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                }}
                            >
                                Next
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                                </svg>
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {/* Loop Toggle */}
                            <button
                                onClick={() => setLoopMode(!loopMode)}
                                title={loopMode ? 'Disable loop' : 'Enable loop'}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 16px',
                                    backgroundColor: loopMode ? 'var(--yt-blue)' : 'var(--yt-hover)',
                                    color: loopMode ? '#fff' : 'var(--yt-text-primary)',
                                    border: 'none',
                                    borderRadius: '18px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill={loopMode ? '#fff' : 'currentColor'}>
                                    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                                </svg>
                                Loop
                            </button>
                            
                            {/* Wide Mode Toggle */}
                            <button
                                onClick={() => setWideMode(!wideMode)}
                                title={wideMode ? 'Exit wide mode' : 'Enter wide mode'}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 16px',
                                    backgroundColor: wideMode ? 'var(--yt-blue)' : 'var(--yt-hover)',
                                    color: wideMode ? '#fff' : 'var(--yt-text-primary)',
                                    border: 'none',
                                    borderRadius: '18px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill={wideMode ? '#fff' : 'currentColor'}>
                                    <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H5V8h14v10z"/>
                                </svg>
                                Wide
                            </button>
                        </div>
                    </div>

                    {/* Video Info */}
                    <VideoInfo video={videoInfo} />

                    {/* Comments */}
                    <CommentSection videoId={videoId} />
                </div>

                {/* Sidebar */}
                <div className="watch-sidebar" style={{
                    position: 'sticky',
                    top: '70px',
                    height: 'fit-content',
                    maxHeight: 'calc(100vh - 80px)',
                    overflowY: 'auto',
                    display: wideMode ? 'none' : 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}>
                    {/* Mix Playlist - Always on top */}
                    <MixPlaylist 
                        videos={mixPlaylist}
                        currentIndex={currentIndex}
                        onVideoSelect={handleVideoSelect}
                        title={videoInfo?.title ? `Mix - ${videoInfo.title.split(' ').slice(0, 3).join(' ')}` : 'Mix Playlist'}
                    />

                    {/* API Error Message */}
                    {apiError && (
                        <div style={{
                            padding: '10px',
                            backgroundColor: 'rgba(255, 0, 0, 0.1)',
                            border: '1px solid rgba(255, 0, 0, 0.2)',
                            borderRadius: '8px',
                            color: 'var(--yt-text-secondary)',
                            fontSize: '12px',
                            textAlign: 'center',
                        }}>
                            {apiError}
                        </div>
                    )}

                    {/* Up Next Section */}
                    <div style={{
                        backgroundColor: 'var(--yt-hover)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                    }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--yt-border)',
                        }}>
                            <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--yt-text-primary)' }}>
                                Up Next
                            </h3>
                            <span style={{ fontSize: '11px', color: 'var(--yt-text-secondary)' }}>
                                {relatedVideos.length} videos
                            </span>
                        </div>
                        <div style={{ overflowY: 'auto' }}>
                            {relatedVideos.slice(0, 30).map((video, index) => (
                                <div 
                                    key={video.id}
                                    onClick={() => handleVideoSelect(index)}
                                    style={{
                                        display: 'flex',
                                        gap: '10px',
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        backgroundColor: index === currentIndex ? 'var(--yt-active)' : 'transparent',
                                        borderLeft: index === currentIndex ? '3px solid var(--yt-blue)' : '3px solid transparent',
                                        transition: 'background-color 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (index !== currentIndex) {
                                            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (index !== currentIndex) {
                                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                        }
                                    }}
                                >
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <img 
                                            src={video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`}
                                            alt={video.title}
                                            style={{ width: '120px', height: '68px', objectFit: 'cover', borderRadius: '6px' }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
                                            }}
                                        />
                                        {video.duration && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '3px',
                                                right: '3px',
                                                backgroundColor: 'rgba(0,0,0,0.8)',
                                                color: '#fff',
                                                padding: '1px 4px',
                                                borderRadius: '3px',
                                                fontSize: '10px',
                                            }}>
                                                {video.duration}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ 
                                            fontSize: '12px', 
                                            fontWeight: '500',
                                            color: 'var(--yt-text-primary)',
                                            lineHeight: '1.2',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}>
                                            {video.title}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--yt-text-secondary)', marginTop: '2px' }}>
                                            {video.uploader}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Responsive styles */}
            <style jsx>{`
                @media (max-width: 1024px) {
                    .watch-page-container {
                        grid-template-columns: 1fr !important;
                    }
                    .watch-sidebar {
                        position: relative !important;
                        top: 0 !important;
                        max-height: none !important;
                    }
                }
                
                @media (max-width: 768px) {
                    .watch-page-container {
                        padding: 8px !important;
                    }
                }
            `}</style>
        </div>
    );
}
