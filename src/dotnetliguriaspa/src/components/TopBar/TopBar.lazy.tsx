import React, { lazy, Suspense } from 'react';

const LazyTopBar = lazy(() => import('./TopBar'));

const TopBar = (props: React.JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyTopBar {...props} showMenu={false} pageName={""}/>
  </Suspense>
);

export default TopBar;
