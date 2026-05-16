'use client';

// Local storage keys
const HISTORY_KEY = 'kvtube_history';
const SEARCH_HISTORY_KEY = 'kvtube_search_history';
const SUBSCRIPTIONS_KEY = 'kvtube_subscriptions';
const SAVED_VIDEOS_KEY = 'kvtube_saved_videos';

export interface HistoryItem {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  watchedAt: number;
}

export interface Subscription {
  channelId: string;
  channelName: string;
  channelAvatar: string;
  subscribedAt: number;
}

export interface SavedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  savedAt: number;
}

export interface SearchHistoryItem {
  query: string;
  searchedAt: number;
}

// Get items from localStorage
function getFromStorage<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save items to localStorage
function saveToStorage<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

// ==================== HISTORY ====================

export function getHistory(limit: number = 50): HistoryItem[] {
  const history = getFromStorage<HistoryItem>(HISTORY_KEY);
  // Sort by most recent first
  return history.sort((a, b) => b.watchedAt - a.watchedAt).slice(0, limit);
}

export function addToHistory(video: { videoId: string; title: string; thumbnail: string; channelTitle?: string }): void {
  const history = getFromStorage<HistoryItem>(HISTORY_KEY);
  
  // Remove duplicate if exists
  const filtered = history.filter(h => h.videoId !== video.videoId);
  
  // Add new entry at the beginning
  const newItem: HistoryItem = {
    videoId: video.videoId,
    title: video.title,
    thumbnail: video.thumbnail,
    channelTitle: video.channelTitle || 'Unknown',
    watchedAt: Date.now(),
  };
  
  // Keep only last 100 items
  const updated = [newItem, ...filtered].slice(0, 100);
  saveToStorage(HISTORY_KEY, updated);
}

export function removeFromHistory(videoId: string): void {
  const history = getFromStorage<HistoryItem>(HISTORY_KEY);
  const filtered = history.filter(h => h.videoId !== videoId);
  saveToStorage(HISTORY_KEY, filtered);
}

export function clearHistory(): void {
  saveToStorage(HISTORY_KEY, []);
}

// ==================== SEARCH HISTORY ====================

function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

export function getSearchHistory(limit: number = 20): SearchHistoryItem[] {
  const history = getFromStorage<SearchHistoryItem>(SEARCH_HISTORY_KEY);
  return history
    .filter(item => item.query.trim())
    .sort((a, b) => b.searchedAt - a.searchedAt)
    .slice(0, limit);
}

export function addSearchHistory(query: string): void {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return;

  const history = getFromStorage<SearchHistoryItem>(SEARCH_HISTORY_KEY);
  const filtered = history.filter(item => item.query.toLowerCase() !== normalizedQuery.toLowerCase());
  saveToStorage(SEARCH_HISTORY_KEY, [
    { query: normalizedQuery, searchedAt: Date.now() },
    ...filtered,
  ].slice(0, 50));
}

export function removeSearchHistory(query: string): void {
  const normalizedQuery = normalizeSearchQuery(query);
  const history = getFromStorage<SearchHistoryItem>(SEARCH_HISTORY_KEY);
  saveToStorage(
    SEARCH_HISTORY_KEY,
    history.filter(item => item.query.toLowerCase() !== normalizedQuery.toLowerCase())
  );
}

export function clearSearchHistory(): void {
  saveToStorage(SEARCH_HISTORY_KEY, []);
}

// ==================== SUBSCRIPTIONS ====================

export function getSubscriptions(): Subscription[] {
  return getFromStorage<Subscription>(SUBSCRIPTIONS_KEY)
    .sort((a, b) => b.subscribedAt - a.subscribedAt);
}

export function subscribe(channel: { channelId: string; channelName: string; channelAvatar?: string }): void {
  const subs = getFromStorage<Subscription>(SUBSCRIPTIONS_KEY);
  
  // Check if already subscribed
  if (subs.some(s => s.channelId === channel.channelId)) return;
  
  const newSub: Subscription = {
    channelId: channel.channelId,
    channelName: channel.channelName,
    channelAvatar: channel.channelAvatar || '',
    subscribedAt: Date.now(),
  };
  
  saveToStorage(SUBSCRIPTIONS_KEY, [...subs, newSub]);
}

export function unsubscribe(channelId: string): void {
  const subs = getFromStorage<Subscription>(SUBSCRIPTIONS_KEY);
  const filtered = subs.filter(s => s.channelId !== channelId);
  saveToStorage(SUBSCRIPTIONS_KEY, filtered);
}

export function isSubscribed(channelId: string): boolean {
  const subs = getFromStorage<Subscription>(SUBSCRIPTIONS_KEY);
  return subs.some(s => s.channelId === channelId);
}

export function toggleSubscription(channel: { channelId: string; channelName: string; channelAvatar?: string }): boolean {
  if (isSubscribed(channel.channelId)) {
    unsubscribe(channel.channelId);
    return false;
  } else {
    subscribe(channel);
    return true;
  }
}

// ==================== SAVED VIDEOS ====================

export function getSavedVideos(limit: number = 50): SavedVideo[] {
  const saved = getFromStorage<SavedVideo>(SAVED_VIDEOS_KEY);
  return saved.sort((a, b) => b.savedAt - a.savedAt).slice(0, limit);
}

export function saveVideo(video: { videoId: string; title: string; thumbnail: string; channelTitle?: string }): void {
  const saved = getFromStorage<SavedVideo>(SAVED_VIDEOS_KEY);
  
  // Remove duplicate if exists
  const filtered = saved.filter(v => v.videoId !== video.videoId);
  
  const newVideo: SavedVideo = {
    videoId: video.videoId,
    title: video.title,
    thumbnail: video.thumbnail,
    channelTitle: video.channelTitle || 'Unknown',
    savedAt: Date.now(),
  };
  
  const updated = [newVideo, ...filtered];
  saveToStorage(SAVED_VIDEOS_KEY, updated);
}

export function unsaveVideo(videoId: string): void {
  const saved = getFromStorage<SavedVideo>(SAVED_VIDEOS_KEY);
  const filtered = saved.filter(v => v.videoId !== videoId);
  saveToStorage(SAVED_VIDEOS_KEY, filtered);
}

export function isVideoSaved(videoId: string): boolean {
  const saved = getFromStorage<SavedVideo>(SAVED_VIDEOS_KEY);
  return saved.some(v => v.videoId === videoId);
}

export function toggleSaveVideo(video: { videoId: string; title: string; thumbnail: string; channelTitle?: string }): boolean {
  if (isVideoSaved(video.videoId)) {
    unsaveVideo(video.videoId);
    return false;
  } else {
    saveVideo(video);
    return true;
  }
}
