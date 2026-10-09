import React, { lazy, Suspense } from 'react';

const LazyWorkshops = lazy(() => import('./Workshops'));

const Workshops = (props: React.JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyWorkshops {...props} pageName={"Downloads"} />
  </Suspense>
);

export default Workshops;
