'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '../lib/api';

interface SubscribeButtonProps {
    channelId?: string;
    channelName?: string;
    initialSubscribed?: boolean;
}

export default function SubscribeButton({ channelId, channelName, initialSubscribed }: SubscribeButtonProps) {
    const [isSubscribed, setIsSubscribed] = useState(initialSubscribed || false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialSubscribed !== undefined) return;
        if (!channelId) return;
        const checkSubscription = async () => {
            try {
                const res = await fetch(apiUrl(`/subscribe?channel_id=${encodeURIComponent(channelId)}`));
                if (res.ok) {
                    const data = await res.json();
                    setIsSubscribed(data.subscribed);
                }
            } catch (error) {
                console.error('Failed to check subscription:', error);
            }
        };
        checkSubscription();
    }, [channelId, initialSubscribed]);

    const handleSubscribe = async () => {
        if (loading || !channelId) return;
        setLoading(true);

        if (!isSubscribed) {
            try {
                const res = await fetch(apiUrl('/subscribe'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel_id: channelId,
                        channel_name: channelName || channelId,
                        channel_avatar: channelName ? channelName[0].toUpperCase() : '?',
                    }),
                });
                if (res.ok) {
                    setIsSubscribed(true);
                }
            } catch (error) {
                console.error('Failed to subscribe:', error);
            } finally {
                setLoading(false);
            }
        } else {
            try {
                const res = await fetch(apiUrl(`/subscribe?channel_id=${encodeURIComponent(channelId)}`), {
                    method: 'DELETE',
                });
                if (res.ok) {
                    setIsSubscribed(false);
                }
            } catch (error) {
                console.error('Failed to unsubscribe:', error);
            } finally {
                setLoading(false);
            }
        }
    };

    if (!channelId) return null;

    return (
        <button
            onClick={handleSubscribe}
            disabled={loading}
            style={{
                backgroundColor: isSubscribed ? 'var(--yt-hover)' : 'var(--foreground)',
                color: isSubscribed ? 'var(--yt-text-primary)' : 'var(--background)',
                border: 'none',
                borderRadius: '20px',
                padding: '0 16px',
                height: '36px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '120px',
            }}
        >
            {loading ? '...' : isSubscribed ? 'Subscribed' : 'Subscribe'}
        </button>
    );
}
