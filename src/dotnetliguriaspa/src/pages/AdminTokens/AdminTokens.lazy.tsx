import React, { lazy, Suspense } from 'react';

const LazyAdminTokens = lazy(() => import('./AdminTokens'));

const AdminTokens = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyAdminTokens {...props} />
  </Suspense>
);

export default AdminTokens;
