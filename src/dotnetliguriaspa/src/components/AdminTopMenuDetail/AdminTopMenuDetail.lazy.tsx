import React, { lazy, Suspense } from 'react';

const LazyAdminTopMenuDetail = lazy(() => import('./AdminTopMenuDetail'));

const AdminTopMenuDetail = (props: React.JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
	<Suspense fallback={null}>
		<LazyAdminTopMenuDetail {...props} />
	</Suspense>
);

export default AdminTopMenuDetail;
