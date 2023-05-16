import React, { lazy, Suspense } from 'react';

const LazyChart = lazy(() => import('./Chart'));

const Chart = (props: JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
  <Suspense fallback={null}>
    <LazyChart title={''} dataGrid={false} data={[]} dataKey={''} {...props} />
  </Suspense>
);

export default Chart;
