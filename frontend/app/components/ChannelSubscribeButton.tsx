'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '../lib/api';

export default function ChannelSubscribeButton({ channelId, channelName }: { channelId: string; channelName: string }) {
    const [subscribed, setSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch(apiUrl(`/subscribe?channel_id=${encodeURIComponent(channelId)}`))
            .then(r => r.json())
            .then(data => setSubscribed(data.subscribed))
            .catch(() => setSubscribed(false));
    }, [channelId]);

    const handleSubscribe = async () => {
        if (loading || !channelId) return;
        setLoading(true);
        try {
            if (subscribed) {
                const res = await fetch(apiUrl(`/subscribe?channel_id=${encodeURIComponent(channelId)}`), { method: 'DELETE' });
                if (res.ok) setSubscribed(false);
            } else {
                const res = await fetch(apiUrl('/subscribe'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel_id: channelId,
                        channel_name: channelName || channelId,
                        channel_avatar: channelName ? channelName[0].toUpperCase() : '?',
                    }),
                });
                if (res.ok) setSubscribed(true);
            }
        } catch (error) {
            console.error('Subscribe error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            className={`channel-subscribe-btn ${subscribed ? 'subscribed' : ''}`}
            onClick={handleSubscribe}
            disabled={loading}
        >
            {loading ? '...' : subscribed ? 'Subscribed' : 'Subscribe'}
        </button>
    );
}
