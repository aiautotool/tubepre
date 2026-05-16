'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { getChannelVideosClient, getChannelInfoClient } from '../../clientActions';
import { VideoData } from '../../constants';
import LoadingSpinner from '../../components/LoadingSpinner';
import { apiUrl } from '../../lib/api';

interface Subscription {
    channel_id: string;
    channel_name: string;
    channel_avatar: string;
}

const DEFAULT_THUMBNAIL = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect fill="%23333" width="320" height="180"/><text x="160" y="90" text-anchor="middle" fill="%23666" font-family="Arial" font-size="14">No thumbnail</text></svg>';

interface ChannelVideos {
    subscription: Subscription;
    videos: VideoData[];
    channelInfo: any;
}

// Fetch subscriptions from backend API
async function fetchSubscriptions(): Promise<Subscription[]> {
    try {
        const res = await fetch(apiUrl('/subscriptions'), { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('Failed to fetch subscriptions:', e);
        return [];
    }
}

const INITIAL_ROWS = 2;
const VIDEOS_PER_ROW = 5;
const MAX_ROWS = 5;

function formatViews(views: number): string {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
}

function ChannelSection({ channelVideos, defaultExpanded = false }: { channelVideos: ChannelVideos; defaultExpanded?: boolean }) {
    const { subscription, videos } = channelVideos;
    const [expanded, setExpanded] = useState(defaultExpanded);

    const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.target as HTMLImageElement;
        if (img.src !== DEFAULT_THUMBNAIL) {
            img.src = DEFAULT_THUMBNAIL;
        }
    }, []);

    if (videos.length === 0) return null;

    const initialCount = INITIAL_ROWS * VIDEOS_PER_ROW;
    const maxCount = MAX_ROWS * VIDEOS_PER_ROW;
    const displayedVideos = expanded ? videos.slice(0, maxCount) : videos.slice(0, initialCount);
    const hasMore = videos.length > initialCount;

    return (
        <section style={{ marginBottom: '32px' }}>
            <Link
                href={`/channel/${subscription.channel_id}`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                    padding: '0 12px',
                }}
            >
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'var(--yt-avatar-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    color: '#fff',
                    fontWeight: '600',
                    overflow: 'hidden',
                }}>
                    {subscription.channel_avatar ? (
                        <img src={subscription.channel_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        subscription.channel_name ? subscription.channel_name[0].toUpperCase() : '?'
                    )}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--yt-text-primary)', textAlign: 'center' }}>
                        {subscription.channel_name || subscription.channel_id}
                    </span>
            </Link>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '16px',
                padding: '0 12px',
            }}>
                {displayedVideos.map((video) => {
                    const relativeTime = video.publishedAt || video.upload_date || 'recently';
                    const destination = `/watch?v=${video.id}`;
                    const thumbnailSrc = video.thumbnail || DEFAULT_THUMBNAIL;

                    return (
                        <Link
                            key={video.id}
                            href={destination}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                borderRadius: '12px',
                                overflow: 'hidden',
                            }}
                            className="card-hover-lift"
                        >
                            <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden' }}>
                                <img
                                    src={thumbnailSrc}
                                    alt={video.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={handleImageError}
                                />
                                {video.duration && (
                                    <div className="duration-badge">{video.duration}</div>
                                )}
                            </div>
                            <h3 style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                lineHeight: '20px',
                                color: 'var(--yt-text-primary)',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                margin: 0,
                            }}>
                                {video.title}
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--yt-text-secondary)', margin: 0 }}>
                                {video.viewCount || formatViews(video.view_count || 0)} views • {relativeTime}
                            </p>
                        </Link>
                    );
                })}
            </div>

            {hasMore && (
                <div style={{ padding: '16px 12px 0', textAlign: 'left' }}>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            setExpanded(!expanded);
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--yt-text-secondary)',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            padding: '8px 16px',
                            borderRadius: '18px',
                            transition: 'background-color 0.2s',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--yt-hover)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        {expanded ? 'Show less' : `Show more (${videos.length - initialCount} more)`}
                    </button>
                </div>
            )}
        </section>
    );
}

export default function SubscriptionsPage() {
    const [channelsVideos, setChannelsVideos] = useState<ChannelVideos[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const subs = await fetchSubscriptions();

                const channelVideos: ChannelVideos[] = [];
                
                // Fetch videos for each subscription in parallel
                const promises = subs.map(async (sub) => {
                    try {
                        const channelId = sub.channel_id;
                        const videos = await getChannelVideosClient(channelId, MAX_ROWS * VIDEOS_PER_ROW);
                        const channelInfo = await getChannelInfoClient(channelId);
                        
                        if (videos.length > 0) {
                            return {
                                subscription: sub,
                                videos: videos,
                                channelInfo: channelInfo || null,
                            };
                        }
                        return null;
                    } catch (err) {
                        console.error(`Failed to fetch videos for ${sub.channel_id}:`, err);
                        return null;
                    }
                });

                const results = await Promise.all(promises);
                const validResults = results.filter((r): r is ChannelVideos => r !== null);
                
                setChannelsVideos(validResults);
            } catch (err) {
                console.error('Failed to fetch subscriptions:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) {
        return (
            <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner />
            </div>
        );
    }

    if (channelsVideos.length === 0) {
        return (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--yt-text-secondary)' }}>
                <h2 style={{ marginBottom: '16px', color: 'var(--yt-text-primary)' }}>No subscriptions yet</h2>
                <p>Subscribe to channels to see their latest videos here</p>
                <Link 
                    href="/"
                    style={{
                        display: 'inline-block',
                        marginTop: '16px',
                        padding: '10px 20px',
                        backgroundColor: 'var(--yt-brand-red)',
                        color: 'white',
                        borderRadius: '20px',
                        textDecoration: 'none',
                        fontWeight: '500',
                    }}
                >
                    Discover videos
                </Link>
            </div>
        );
    }

    return (
        <div style={{ padding: '12px', maxWidth: '1400px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px', padding: '0 12px' }}>Sub</h1>

            {channelsVideos.map((channelData) => (
                <ChannelSection key={channelData.subscription.channel_id} channelVideos={channelData} />
            ))}
        </div>
    );
}
