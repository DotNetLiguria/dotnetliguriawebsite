import React, { lazy, Suspense } from 'react';

const LazyAdminWidgetLg = lazy(() => import('./AdminWidgetLg'));

const AdminWidgetLg = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyAdminWidgetLg {...props} />
  </Suspense>
);

export default AdminWidgetLg;
