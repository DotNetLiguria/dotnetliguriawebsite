import React, { lazy, Suspense } from 'react';

const LazyHome = lazy(() => import('./Home'));

const Home = (props: React.JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyHome {...props} />
  </Suspense>
);

export default Home;
