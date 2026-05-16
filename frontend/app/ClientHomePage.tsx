'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { searchVideosClient, getTrendingVideosClient, getSuggestionsClient } from './clientActions';
import { VideoData } from './constants';
import LoadingSpinner from './components/LoadingSpinner';

// Format view count
function formatViews(views: number): string {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M views';
    if (views >= 1000) return (views / 1000).toFixed(0) + 'K views';
    return views === 0 ? '' : `${views} views`;
}

// Get stable time ago based on video ID (deterministic, not random)
function getStableTimeAgo(videoId: string): string {
    const times = ['2 hours ago', '5 hours ago', '1 day ago', '2 days ago', '3 days ago', '1 week ago', '2 weeks ago', '1 month ago'];
    const hash = videoId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return times[hash % times.length];
}

// Video Card Component
function VideoCard({ video }: { video: VideoData }) {
    const [imgError, setImgError] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);
    
    // Use multiple thumbnail sources for fallback
    const thumbnailSources = [
        `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
        `https://i.ytimg.com/vi/${video.id}/sddefault.jpg`,
        `https://i.ytimg.com/vi/${video.id}/default.jpg`,
    ];
    
    const [currentSrcIndex, setCurrentSrcIndex] = useState(0);
    const currentSrc = thumbnailSources[currentSrcIndex];
    
    const handleError = () => {
        if (currentSrcIndex < thumbnailSources.length - 1) {
            setCurrentSrcIndex(prev => prev + 1);
        } else {
            setImgError(true);
        }
    };
    
    return (
        <Link href={`/watch?v=${video.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ marginBottom: '32px' }}>
                {/* Thumbnail */}
                <div style={{ 
                    position: 'relative', 
                    aspectRatio: '16/9', 
                    marginBottom: '12px', 
                    backgroundColor: '#272727', 
                    borderRadius: '12px', 
                    overflow: 'hidden',
                }}>
                    {!imgLoaded && !imgError && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: '#272727',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <LoadingSpinner size="small" color="white" />
                        </div>
                    )}
                    
                    {!imgError ? (
                        <img 
                            src={currentSrc}
                            alt={video.title}
                            onError={handleError}
                            onLoad={() => setImgLoaded(true)}
                            style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover',
                                display: imgLoaded ? 'block' : 'none',
                                transition: 'opacity 0.2s',
                            }}
                        />
                    ) : (
                        <div style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#333',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#666',
                        }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                            </svg>
                        </div>
                    )}
                    
                    {/* Duration badge */}
                    {video.duration && (
                        <div style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            color: '#fff',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                        }}>
                            {video.duration}
                        </div>
                    )}
                    
                    {/* Hover overlay */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0)',
                        transition: 'background-color 0.2s',
                        cursor: 'pointer',
                    }} />
                </div>
                
                {/* Video Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title - max 2 lines */}
                    <h3 style={{ 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        margin: '0 0 4px 0',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        color: 'var(--yt-text-primary)',
                    }}>
                        {video.title}
                    </h3>
                    
                    {/* Channel name */}
                    <div style={{ 
                        fontSize: '12px', 
                        color: 'var(--yt-text-secondary)',
                        marginBottom: '2px',
                    }}>
                        {video.uploader}
                    </div>
                    
                    {/* Views and time */}
                    <div style={{ 
                        fontSize: '12px', 
                        color: 'var(--yt-text-secondary)',
                        display: 'flex',
                        gap: '4px',
                    }}>
                        {(video.view_count ?? 0) > 0 && <span>{formatViews(video.view_count ?? 0)}</span>}
                        {(video.view_count ?? 0) > 0 && <span>•</span>}
                        <span>{video.upload_date || video.publishedAt || getStableTimeAgo(video.id)}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}

// Category Pills Component
function CategoryPills({ 
    categories, 
    currentCategory, 
    onCategoryChange 
}: { 
    categories: string[]; 
    currentCategory: string; 
    onCategoryChange: (category: string) => void;
}) {
    return (
        <div style={{ 
            display: 'flex', 
            gap: '12px', 
            overflowX: 'auto',
            padding: '16px 0',
            borderBottom: '1px solid var(--yt-border)',
            marginBottom: '24px',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
        }}>
            {categories.map((category) => (
                <button
                    key={category}
                    onClick={() => onCategoryChange(category)}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: currentCategory === category ? 'var(--yt-text-primary)' : 'var(--yt-hover)',
                        color: currentCategory === category ? 'var(--yt-background)' : 'var(--yt-text-primary)',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '14px',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (currentCategory !== category) {
                            (e.target as HTMLElement).style.backgroundColor = 'var(--yt-active)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (currentCategory !== category) {
                            (e.target as HTMLElement).style.backgroundColor = 'var(--yt-hover)';
                        }
                    }}
                >
                    {category}
                </button>
            ))}
        </div>
    );
}

// Loading Skeleton
function VideoSkeleton() {
    return (
        <div style={{ marginBottom: '32px' }}>
            <div style={{ 
                aspectRatio: '16/9', 
                backgroundColor: '#272727', 
                borderRadius: '12px',
                marginBottom: '12px',
                animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '50%', 
                    backgroundColor: '#272727',
                    animation: 'pulse 1.5s ease-in-out infinite',
                }} />
                <div style={{ flex: 1 }}>
                    <div style={{ 
                        height: '14px', 
                        backgroundColor: '#272727', 
                        borderRadius: '4px',
                        marginBottom: '8px',
                        width: '90%',
                        animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                    <div style={{ 
                        height: '12px', 
                        backgroundColor: '#272727', 
                        borderRadius: '4px',
                        width: '60%',
                        animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                </div>
            </div>
        </div>
    );
}

// Get region from cookie
function getRegionFromCookie(): string {
    if (typeof document === 'undefined') return 'VN';
    const match = document.cookie.match(/(?:^|; )region=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : 'VN';
}

// Check if thumbnail URL is valid (not a 404 placeholder)
function isValidThumbnail(thumbnail: string | undefined): boolean {
    if (!thumbnail) return false;
    // YouTube default thumbnails that are usually available
    const validPatterns = [
        'i.ytimg.com/vi/',
        'i.ytimg.com/vi_webp/',
    ];
    return validPatterns.some(pattern => thumbnail.includes(pattern));
}

export default function ClientHomePage() {
    const searchParams = useSearchParams();
    const categoryParam = searchParams.get('category') || 'Dành cho bạn';
    const [videos, setVideos] = useState<VideoData[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [currentCategory, setCurrentCategory] = useState(categoryParam);
    const [page, setPage] = useState(1);
    const [regionCode, setRegionCode] = useState('VN');
    const [hasMore, setHasMore] = useState(true);
    
    // Use refs to track state for the observer callback
    const loadingMoreRef = useRef(false);
    const loadingRef = useRef(true);
    const hasMoreRef = useRef(true);
    const pageRef = useRef(1);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    
    useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
    useEffect(() => { loadingRef.current = loading; }, [loading]);
    useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
    useEffect(() => { pageRef.current = page; }, [page]);

    const categories = ['Dành cho bạn', 'All', 'Trending', 'Music', 'Gaming', 'News', 'Sports', 'Live', 'New'];

    // Region mapping for YouTube API
    const REGION_MAP: Record<string, string> = {
        'VN': 'Vietnam',
        'US': 'United States',
        'JP': 'Japan',
        'KR': 'South Korea',
        'IN': 'India',
        'GB': 'United Kingdom',
        'GLOBAL': '',
    };

    // Initialize region from cookie
    useEffect(() => {
        const region = getRegionFromCookie();
        setRegionCode(region);
    }, []);

    // Load videos when category or region changes
    useEffect(() => {
        loadVideos(currentCategory, 1);
    }, [currentCategory, regionCode]);

    useEffect(() => {
        const categoryFromUrl = searchParams.get('category') || 'Dành cho bạn';
        setCurrentCategory(prev => prev === categoryFromUrl ? prev : categoryFromUrl);
    }, [searchParams]);

    useEffect(() => {
        const handleCategoryChangeEvent = (event: Event) => {
            const category = (event as CustomEvent<{ category?: string }>).detail?.category;
            if (category) {
                setCurrentCategory(category);
            }
        };

        window.addEventListener('categorychange', handleCategoryChangeEvent);
        return () => window.removeEventListener('categorychange', handleCategoryChangeEvent);
    }, []);

    // Listen for region changes
    useEffect(() => {
        const checkRegionChange = () => {
            const newRegion = getRegionFromCookie();
            setRegionCode(prev => {
                if (newRegion !== prev) {
                    return newRegion;
                }
                return prev;
            });
        };

        // Listen for custom event from RegionSelector
        const handleRegionChange = (e: CustomEvent) => {
            if (e.detail?.region) {
                setRegionCode(e.detail.region);
            }
        };

        // Check when tab becomes visible
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkRegionChange();
            }
        };

        // Check when window gets focus
        const handleFocus = () => {
            checkRegionChange();
        };

        window.addEventListener('regionchange', handleRegionChange as EventListener);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        
        // Also poll every 3 seconds as backup
        const interval = setInterval(checkRegionChange, 3000);

        return () => {
            window.removeEventListener('regionchange', handleRegionChange as EventListener);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            clearInterval(interval);
        };
    }, []); // Run once on mount

    const loadVideos = async (category: string, pageNum: number) => {
        try {
            setLoading(true);
            let results: VideoData[] = [];
            const regionLabel = REGION_MAP[regionCode] || '';
            const regionSuffix = regionLabel ? ` ${regionLabel}` : '';

            if (category === 'Dành cho bạn') {
                results = await getSuggestionsClient(30);
                if (results.length === 0) {
                    results = await getTrendingVideosClient(regionCode, 30);
                }
            } else if (category === 'Trending') {
                results = await getTrendingVideosClient(regionCode, 30);
            } else if (category === 'All') {
                // Use region-specific trending for "All"
                results = await getTrendingVideosClient(regionCode, 30);
            } else {
                // Category-specific search with region
                const query = `${category}${regionSuffix}`;
                results = await searchVideosClient(query, 30);
            }

            // Remove duplicates and filter out videos without thumbnails
            const uniqueResults = results.filter((video, index, self) => {
                const isUnique = index === self.findIndex(v => v.id === video.id);
                const hasThumbnail = isValidThumbnail(video.thumbnail);
                return isUnique && hasThumbnail;
            });

            setVideos(uniqueResults);
            setPage(pageNum);
            setHasMore(true);
            hasMoreRef.current = true;
        } catch (error) {
            console.error('Failed to load videos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryChange = (category: string) => {
        setCurrentCategory(category);
        const url = new URL(window.location.href);
        url.searchParams.set('category', category);
        window.history.pushState({}, '', url);
    };

    const loadMore = useCallback(async () => {
        if (loadingMoreRef.current || loadingRef.current || !hasMoreRef.current) return;
        
        setLoadingMore(true);
        const nextPage = pageRef.current + 1;
        
        try {
            const regionLabel = REGION_MAP[regionCode] || '';
            const regionSuffix = regionLabel ? ` ${regionLabel}` : '';
            
            // Generate varied search queries - ALL include region
            const searchVariations = [
                currentCategory === 'Dành cho bạn' ? `recommended videos${regionSuffix}` : `trending${regionSuffix}`,
                `trending${regionSuffix}`,
                `popular videos${regionSuffix}`,
                `viral 2026${regionSuffix}`,
                `music${regionSuffix}`,
                `entertainment${regionSuffix}`,
                `gaming${regionSuffix}`,
                `funny${regionSuffix}`,
                `news${regionSuffix}`,
                `sports${regionSuffix}`,
                `new videos${regionSuffix}`,
            ];
            
            const queryIndex = (nextPage - 1) % searchVariations.length;
            const searchQuery = searchVariations[queryIndex];
            
            // Always use search for variety - trending API returns same results
            const moreVideos = await searchVideosClient(searchQuery, 30);

            // Remove duplicates and filter out videos without thumbnails
            setVideos(prev => {
                const existingIds = new Set(prev.map(v => v.id));
                const uniqueNewVideos = moreVideos.filter(v => 
                    !existingIds.has(v.id) && isValidThumbnail(v.thumbnail)
                );
                
                // If no new videos after filtering, stop infinite scroll
                if (uniqueNewVideos.length < 3) {
                    setHasMore(false);
                    hasMoreRef.current = false;
                }
                
                return [...prev, ...uniqueNewVideos];
            });
            
            setPage(nextPage);
        } catch (error) {
            console.error('Failed to load more videos:', error);
            // Don't stop infinite scroll on error - allow retry on next scroll
        } finally {
            setLoadingMore(false);
        }
    }, [currentCategory, regionCode]);

    // Ref for the loadMore function to avoid stale closures
    const loadMoreCallbackRef = useRef(loadMore);
    useEffect(() => {
        loadMoreCallbackRef.current = loadMore;
    }, [loadMore]);

    // Infinite scroll using Intersection Observer
    useEffect(() => {
        // Don't set up observer while loading or if no videos
        if (loading || videos.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && !loadingMoreRef.current && !loadingRef.current && hasMoreRef.current) {
                    console.log('Sentinel intersecting, loading more...');
                    loadMoreCallbackRef.current();
                }
            },
            { 
                rootMargin: '600px',
                threshold: 0
            }
        );

        const sentinel = sentinelRef.current;
        if (sentinel) {
            observer.observe(sentinel);
        }

        return () => {
            observer.disconnect();
        };
    }, [loading, videos.length]); // Re-run when loading finishes or videos change

    return (
        <div style={{ 
            backgroundColor: 'var(--yt-background)', 
            color: 'var(--yt-text-primary)', 
            minHeight: '100vh',
            padding: '0 24px 24px',
        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Category Pills */}
                <CategoryPills 
                    categories={categories}
                    currentCategory={currentCategory}
                    onCategoryChange={handleCategoryChange}
                />

                {/* Video Grid */}
                {loading ? (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '0 24px',
                    }}>
                        {[...Array(12)].map((_, i) => (
                            <VideoSkeleton key={i} />
                        ))}
                    </div>
                ) : (
                    <>
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                            gap: '0 24px',
                        }}>
                            {videos.map((video) => (
                                <VideoCard key={video.id} video={video} />
                            ))}
                        </div>

                        {/* Scroll Sentinel for Infinite Scroll */}
                        <div ref={sentinelRef} id="scroll-sentinel" style={{ height: '100px', width: '100%' }} />

                        {/* Loading More Indicator */}
                        {loadingMore && (
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                padding: '48px 0',
                            }}>
                                <LoadingSpinner />
                            </div>
                        )}

                        {/* End of Results */}
                        {!hasMore && videos.length > 0 && (
                            <div style={{ 
                                textAlign: 'center', 
                                padding: '48px 0',
                                color: 'var(--yt-text-secondary)',
                                fontSize: '14px',
                            }}>
                                You&apos;ve reached the end
                            </div>
                        )}

                        {/* Empty State */}
                        {videos.length === 0 && !loading && (
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                height: '400px',
                                color: 'var(--yt-text-secondary)',
                            }}>
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style={{ marginBottom: '16px', opacity: 0.5 }}>
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                </svg>
                                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>No videos found</h3>
                                <p style={{ fontSize: '14px' }}>Try selecting a different category</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Animations */}
            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.6; }
                }
                ::-webkit-scrollbar {
                    height: 0;
                    width: 0;
                }
            `}</style>
        </div>
    );
}
