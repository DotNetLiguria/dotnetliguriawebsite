import React, { lazy, Suspense } from 'react';

const LazyAdminTopMenu = lazy(() => import('./AdminTopMenu'));

const AdminTopMenu = (props: React.JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
	<Suspense fallback={null}>
		<LazyAdminTopMenu {...props} />
	</Suspense>
);

export default AdminTopMenu;
