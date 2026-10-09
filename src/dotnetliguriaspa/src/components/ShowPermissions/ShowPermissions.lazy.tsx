import React, { lazy, Suspense } from 'react';

const LazyShowPermissions = lazy(() => import('./ShowPermissions'));

const ShowPermissions = (props: React.JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyShowPermissions {...props} />
  </Suspense>
);

export default ShowPermissions;
