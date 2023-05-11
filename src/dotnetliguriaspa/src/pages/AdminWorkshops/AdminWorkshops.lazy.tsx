import React, { lazy, Suspense } from 'react';

const LazyAdminWorkshops = lazy(() => import('./AdminWorkshops'));

const AdminWorkshops = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyAdminWorkshops {...props} />
  </Suspense>
);

export default AdminWorkshops;
