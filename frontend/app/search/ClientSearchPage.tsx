'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { searchVideosClient } from '../clientActions';
import { VideoData } from '../constants';
import VideoCard from '../components/VideoCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { addSearchHistory, clearSearchHistory, getSearchHistory, removeSearchHistory, SearchHistoryItem } from '../storage';

function SearchSkeleton() {
    return (
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
        }}>
            {[...Array(12)].map((_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ 
                        aspectRatio: '16/9', 
                        backgroundColor: 'var(--yt-hover)',
                        borderRadius: '12px',
                        animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                    <div style={{ display: 'flex', gap: '12px', padding: '0' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ width: '90%', height: '16px', backgroundColor: 'var(--yt-hover)', borderRadius: '4px' }} />
                            <div style={{ width: '60%', height: '12px', backgroundColor: 'var(--yt-hover)', borderRadius: '4px' }} />
                            <div style={{ width: '40%', height: '12px', backgroundColor: 'var(--yt-hover)', borderRadius: '4px' }} />
                        </div>
                    </div>
                </div>
            ))}
            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.6; }
                }
            `}</style>
        </div>
    );
}

export default function ClientSearchPage() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q') || '';
    const [videos, setVideos] = useState<VideoData[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchPage, setSearchPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
    const observerTarget = useRef<HTMLDivElement>(null);
    const loadingMoreRef = useRef(false);
    const hasMoreRef = useRef(true);
    const searchPageRef = useRef(0);

    useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);
    useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
    useEffect(() => { searchPageRef.current = searchPage; }, [searchPage]);

    useEffect(() => {
        if (query) {
            addSearchHistory(query);
            setSearchHistory(getSearchHistory());
            performSearch(query);
        }
    }, [query]);

    useEffect(() => {
        setSearchHistory(getSearchHistory());
    }, []);

    const handleRemoveHistory = (historyQuery: string) => {
        removeSearchHistory(historyQuery);
        setSearchHistory(getSearchHistory());
    };

    const handleClearHistory = () => {
        clearSearchHistory();
        setSearchHistory([]);
    };

    const performSearch = async (q: string) => {
        try {
            setLoading(true);
            setSearchPage(0);
            searchPageRef.current = 0;
            setHasMore(true);
            hasMoreRef.current = true;
            
            const results = await searchVideosClient(q, 50);
            const uniqueResults = results.filter((video, index, self) =>
                index === self.findIndex(v => v.id === video.id)
            );
            setVideos(uniqueResults);
            setHasMore(uniqueResults.length >= 40);
            hasMoreRef.current = uniqueResults.length >= 40;
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = useCallback(async () => {
        if (loadingMoreRef.current || !hasMoreRef.current || !query) return;
        
        setLoadingMore(true);
        const nextPage = searchPageRef.current + 1;
        
        try {
            // Use different search variations to get more results
            const variations = [
                `${query}`,
                `${query} official`,
                `${query} video`,
                `${query} review`,
                `${query} tutorial`,
                `${query} 2026`,
                `${query} new`,
                `${query} best`,
            ];
            const searchVariation = variations[nextPage % variations.length];
            
            const results = await searchVideosClient(searchVariation, 50);
            
            setVideos(prev => {
                const existingIds = new Set(prev.map(v => v.id));
                const uniqueNewVideos = results.filter(v => !existingIds.has(v.id));
                
                // Stop loading if we get very few new videos
                if (uniqueNewVideos.length < 3) {
                    setHasMore(false);
                    hasMoreRef.current = false;
                }
                
                return [...prev, ...uniqueNewVideos];
            });
            
            setSearchPage(nextPage);
            searchPageRef.current = nextPage;
        } catch (error) {
            console.error('Failed to load more:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [query]);

    // Infinite scroll observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !loadingMoreRef.current && hasMoreRef.current) {
                    loadMore();
                }
            },
            { rootMargin: '500px', threshold: 0.1 }
        );

        const timer = setTimeout(() => {
            if (observerTarget.current) {
                observer.observe(observerTarget.current);
            }
        }, 100);

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [loadMore]);

    return (
        <div style={{ 
            backgroundColor: 'var(--yt-background)', 
            color: 'var(--yt-text-primary)', 
            minHeight: '100vh',
            padding: '0 24px 24px',
        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {searchHistory.length > 0 && (
                    <div style={{
                        marginBottom: '20px',
                        padding: '14px 16px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--yt-surface)',
                        border: '1px solid var(--yt-border)',
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            marginBottom: '12px',
                        }}>
                            <span style={{ fontSize: '15px', fontWeight: 600 }}>Lịch sử tìm kiếm</span>
                            <button
                                type="button"
                                onClick={handleClearHistory}
                                style={{
                                    border: 0,
                                    background: 'transparent',
                                    color: 'var(--yt-text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                }}
                            >
                                Xóa tất cả
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {searchHistory.map(item => (
                                <div
                                    key={item.query}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        maxWidth: '100%',
                                        padding: '7px 8px 7px 12px',
                                        borderRadius: '999px',
                                        backgroundColor: 'var(--yt-hover)',
                                    }}
                                >
                                    <a
                                        href={`/search?q=${encodeURIComponent(item.query)}`}
                                        style={{
                                            color: 'var(--yt-text-primary)',
                                            textDecoration: 'none',
                                            fontSize: '14px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            maxWidth: '220px',
                                        }}
                                    >
                                        {item.query}
                                    </a>
                                    <button
                                        type="button"
                                        aria-label={`Xóa ${item.query}`}
                                        onClick={() => handleRemoveHistory(item.query)}
                                        style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '50%',
                                            border: 0,
                                            background: 'transparent',
                                            color: 'var(--yt-text-secondary)',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results Header */}
                {query && !loading && (
                    <div style={{ marginBottom: '20px' }}>
                        <span style={{ fontSize: '14px', color: 'var(--yt-text-secondary)' }}>
                            {videos.length > 0 ? `${videos.length} results for "${query}"` : `No results for "${query}"`}
                        </span>
                    </div>
                )}

                {/* Results Grid */}
                {loading ? (
                    <SearchSkeleton />
                ) : videos.length === 0 ? (
                    <div style={{ 
                        textAlign: 'center', 
                        padding: '80px 24px',
                        color: 'var(--yt-text-secondary)',
                    }}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style={{ marginBottom: '16px', opacity: 0.5 }}>
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                        <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--yt-text-primary)' }}>
                            No results found
                        </h3>
                        <p style={{ fontSize: '14px' }}>Try different keywords or check your spelling</p>
                    </div>
                ) : (
                    <>
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '16px',
                        }}>
                            {videos.map((video) => (
                                <VideoCard key={video.id} video={video} />
                            ))}
                        </div>

                        {/* Infinite scroll sentinel */}
                        <div ref={observerTarget} style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
                            {loadingMore && <LoadingSpinner />}
                        </div>

                        {/* End of results */}
                        {!hasMore && videos.length > 0 && (
                            <div style={{ 
                                textAlign: 'center', 
                                padding: '24px 0',
                                color: 'var(--yt-text-secondary)',
                                fontSize: '14px',
                            }}>
                                End of results
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
