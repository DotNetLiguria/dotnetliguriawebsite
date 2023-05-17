import React, { lazy, Suspense } from 'react';

const LazyAdminFeaturedInfo = lazy(() => import('./AdminFeaturedInfo'));

const AdminFeaturedInfo = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyAdminFeaturedInfo {...props} />
  </Suspense>
);

export default AdminFeaturedInfo;
