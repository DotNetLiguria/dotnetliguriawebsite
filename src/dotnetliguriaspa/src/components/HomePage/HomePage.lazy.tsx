import React, { lazy, Suspense } from 'react';

const LazyHomePage = lazy(() => import('./HomePage'));

const HomePage = (props: React.JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyHomePage {...props} />
  </Suspense>
);

export default HomePage;
