export const API_BASE = ''; // No backend needed - using public APIs

export interface VideoData {
    id: string;
    title: string;
    thumbnail: string;
    channelTitle?: string;
    channelId?: string;
    viewCount?: string;
    publishedAt?: string;
    duration: string;
    description?: string;
    // Legacy fields for compatibility
    uploader?: string;
    uploader_id?: string;
    channel_id?: string;
    view_count?: number;
    upload_date?: string;
    avatar_url?: string;
    list_id?: string;
    is_mix?: boolean;
}

export const CATEGORY_MAP: Record<string, string> = {
    'All': 'trending videos 2025',
    'Watched': 'watched history',
    'Suggested': 'suggested videos',
    'Tech': 'latest smart technology gadgets reviews',
    'Music': 'music hits',
    'Movies': 'movie trailers',
    'News': 'latest news',
    'Trending': 'trending videos',
    'Podcasts': 'popular podcasts',
    'Live': 'live stream',
    'Gaming': 'gaming trending',
    'Sports': 'sports highlights'
};

export const ALL_CATEGORY_SECTIONS = [
    { id: 'trending', title: 'Trending Now', query: 'trending videos 2025' },
    { id: 'music', title: 'Music Hits', query: 'music hits 2025' },
    { id: 'tech', title: 'Tech & Gadgets', query: 'latest smart technology gadgets reviews' },
    { id: 'gaming', title: 'Gaming', query: 'gaming trending' },
    { id: 'sports', title: 'Sports Highlights', query: 'sports highlights' },
    { id: 'news', title: 'Latest News', query: 'latest news' },
];
