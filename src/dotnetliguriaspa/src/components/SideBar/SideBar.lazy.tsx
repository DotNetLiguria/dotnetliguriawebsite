import React, { lazy, Suspense } from 'react';

const LazySideBar = lazy(() => import('./SideBar'));

const SideBar = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazySideBar {...props} />
  </Suspense>
);

export default SideBar;
