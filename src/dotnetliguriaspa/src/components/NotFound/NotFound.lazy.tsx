import React, { lazy, Suspense } from 'react';

const LazyNotFound = lazy(() => import('./NotFound'));

const NotFound = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
    <Suspense fallback={null}>
        <LazyNotFound {...props}  pagename={""}/>
    </Suspense>
);

export default NotFound;
