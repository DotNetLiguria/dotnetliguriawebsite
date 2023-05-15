import React, { lazy, Suspense } from 'react';

const LazyAdminWidgetSm = lazy(() => import('./AdminWidgetSm'));

const AdminWidgetSm = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyAdminWidgetSm {...props} />
  </Suspense>
);

export default AdminWidgetSm;
