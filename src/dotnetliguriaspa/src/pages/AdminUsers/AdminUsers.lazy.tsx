import React, { lazy, Suspense } from 'react';

const LazyAdminUsers = lazy(() => import('./AdminUsers'));

const AdminUsers = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyAdminUsers {...props} />
  </Suspense>
);

export default AdminUsers;
