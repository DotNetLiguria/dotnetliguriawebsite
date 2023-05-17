import React, { lazy, Suspense } from 'react';

const LazyHomeHeader = lazy(() => import('./HomeHeader'));

const HomeHeader = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyHomeHeader {...props} />
  </Suspense>
);

export default HomeHeader;
