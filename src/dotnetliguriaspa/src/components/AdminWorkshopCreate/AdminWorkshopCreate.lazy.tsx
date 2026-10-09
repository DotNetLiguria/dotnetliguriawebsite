import React, { lazy, Suspense } from 'react';

const LazyAdminWorkshopCreate = lazy(() => import('./AdminWorkshopCreate'));

const AdminWorkshopCreate = (props: React.JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
	<Suspense fallback={null}>
		<LazyAdminWorkshopCreate {...props} />
	</Suspense>
);

export default AdminWorkshopCreate;
