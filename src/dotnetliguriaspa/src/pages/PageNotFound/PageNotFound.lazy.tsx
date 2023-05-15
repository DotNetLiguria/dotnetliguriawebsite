import React, { lazy, Suspense } from 'react';

const LazyPageNotFound = lazy(() => import('./PageNotFound'));

const PageNotFound = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
    <Suspense fallback={null}>
        <LazyPageNotFound {...props} pagename={""}/>
    </Suspense>
);

export default PageNotFound;
