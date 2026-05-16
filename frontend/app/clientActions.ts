'use client';

import { VideoData } from './constants';
import { apiUrl } from './lib/api';

// Transform backend response to our VideoData format
function transformVideo(item: any): VideoData {
  return {
    id: item.id || '',
    title: item.title || 'Untitled',
    thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    channelTitle: item.uploader || item.channelTitle || 'Unknown',
    channelId: item.channel_id || item.channelId || '',
    viewCount: formatViews(item.view_count || 0),
    publishedAt: formatRelativeTime(item.upload_date || item.uploaded),
    duration: item.duration || '',
    description: item.description || '',
    uploader: item.uploader,
    uploader_id: item.uploader_id,
    channel_id: item.channel_id,
    view_count: item.view_count || 0,
    upload_date: item.upload_date,
  };
}

function formatViews(views: number): string {
  if (!views) return '0';
  if (views >= 1000000000) return (views / 1000000000).toFixed(1) + 'B';
  if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
  if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
  return views.toString();
}

function formatRelativeTime(input: any): string {
  if (!input) return 'recently';
  if (typeof input === 'string' && input.includes('ago')) return input;
  
  const date = new Date(input);
  if (isNaN(date.getTime())) return 'recently';
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// Search videos using backend API
export async function searchVideosClient(query: string, limit: number = 20): Promise<VideoData[]> {
  try {
    const response = await fetch(apiUrl(`/search?q=${encodeURIComponent(query)}&limit=${limit}`), {
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    
    return data.map(transformVideo).filter((v: VideoData) => v.id && v.title);
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

// Get video details using backend API
export async function getVideoDetailsClient(videoId: string): Promise<VideoData | null> {
  try {
    const response = await fetch(apiUrl(`/video/${videoId}`), {
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return transformVideo(data);
  } catch (error) {
    console.error('Get video details failed:', error);
    return null;
  }
}

// Get related videos using backend API
export async function getRelatedVideosClient(videoId: string, limit: number = 15): Promise<VideoData[]> {
  try {
    const response = await fetch(apiUrl(`/video/${videoId}/related?limit=${limit}`), {
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    
    return data.map(transformVideo).filter((v: VideoData) => v.id && v.title).slice(0, limit);
  } catch (error) {
    console.error('Get related videos failed:', error);
    return [];
  }
}

// Get trending videos using backend API with region support
export async function getTrendingVideosClient(regionCode: string = 'US', limit: number = 20): Promise<VideoData[]> {
  // Map region codes to search queries for region-specific trending
  const regionNames: Record<string, string> = {
    'VN': 'Vietnam',
    'US': 'United States',
    'JP': 'Japan',
    'KR': 'South Korea',
    'IN': 'India',
    'GB': 'United Kingdom',
    'DE': 'Germany',
    'FR': 'France',
    'BR': 'Brazil',
    'MX': 'Mexico',
    'CA': 'Canada',
    'AU': 'Australia',
    'GLOBAL': '',
  };
  
  const regionName = regionNames[regionCode] || '';
  const searchQuery = regionName 
    ? `trending ${regionName} 2026` 
    : 'trending videos 2026';
  
  try {
    const response = await fetch(apiUrl(`/search?q=${encodeURIComponent(searchQuery)}&limit=${limit}`), {
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    
    return data.map(transformVideo).filter((v: VideoData) => v.id && v.title).slice(0, limit);
  } catch (error) {
    console.error('Get trending videos failed:', error);
    return [];
  }
}

export async function getSuggestionsClient(limit: number = 30): Promise<VideoData[]> {
  try {
    const response = await fetch(apiUrl(`/suggestions?limit=${limit}`), {
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map(transformVideo).filter((v: VideoData) => v.id && v.title).slice(0, limit);
  } catch (error) {
    console.error('Get suggestions failed:', error);
    return [];
  }
}

// Get comments using backend API
export async function getCommentsClient(videoId: string, limit: number = 20): Promise<any[]> {
  try {
    const response = await fetch(apiUrl(`/video/${videoId}/comments?limit=${limit}`), {
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    
    return data.map((c: any) => ({
      id: c.id,
      text: c.text || c.content,
      author: c.author,
      authorId: c.author_id,
      authorThumbnail: c.author_thumbnail,
      likes: c.likes || 0,
      published: c.timestamp || 'recently',
      isReply: c.is_reply || false,
    }));
  } catch (error) {
    console.error('Get comments failed:', error);
    return [];
  }
}

// Get channel info using backend API
export async function getChannelInfoClient(channelId: string): Promise<any | null> {
  try {
    const response = await fetch(apiUrl(`/channel/info?id=${channelId}`), {
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return {
      id: data.id || channelId,
      title: data.title || 'Unknown Channel',
      avatar: data.avatar || '',
      banner: data.banner || '',
      subscriberCount: data.subscriber_count || 0,
      description: data.description || '',
    };
  } catch (error) {
    console.error('Get channel info failed:', error);
    return null;
  }
}

// Get channel videos using backend API
export async function getChannelVideosClient(channelId: string, limit: number = 30): Promise<VideoData[]> {
  try {
    const response = await fetch(apiUrl(`/channel/videos?id=${channelId}&limit=${limit}`), {
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    
    return data.map(transformVideo).filter((v: VideoData) => v.id && v.title);
  } catch (error) {
    console.error('Get channel videos failed:', error);
    return [];
  }
}
