import { Suspense } from 'react';
import ClientHomePage from './ClientHomePage';
import LoadingSpinner from './components/LoadingSpinner';

export default function Home() {
    return (
        <Suspense fallback={<LoadingSpinner fullScreen text="Loading videos..." />}>
            <ClientHomePage />
        </Suspense>
    );
}