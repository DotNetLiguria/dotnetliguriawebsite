import React, { lazy, Suspense } from 'react';

const LazyAdminHome = lazy(() => import('./AdminHome'));

const AdminHome = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyAdminHome {...props} />
  </Suspense>
);

export default AdminHome;
