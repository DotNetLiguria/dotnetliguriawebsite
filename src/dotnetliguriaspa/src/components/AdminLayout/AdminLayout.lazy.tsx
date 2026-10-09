import React, { lazy, Suspense } from 'react';

const LazyAdminLayout = lazy(() => import('./AdminLayout'));

const AdminLayout = (props: React.JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyAdminLayout {...props} />
  </Suspense>
);

export default AdminLayout;
