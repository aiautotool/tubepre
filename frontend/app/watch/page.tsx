import { Suspense } from 'react';
import ClientWatchPage from './ClientWatchPage';
import LoadingSpinner from '../components/LoadingSpinner';

export default function WatchPage() {
    return (
        <Suspense fallback={<LoadingSpinner fullScreen text="Loading video..." />}>
            <ClientWatchPage />
        </Suspense>
    );
}