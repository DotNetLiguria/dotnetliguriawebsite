import React, { lazy, Suspense } from 'react';

const LazyWorkshopDetail = lazy(() => import('./WorkshopDetail'));

const WorkshopDetail = (props: React.JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyWorkshopDetail {...props} pageName='' />
  </Suspense>
);

export default WorkshopDetail;
