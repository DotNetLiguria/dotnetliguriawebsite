import React, { lazy, Suspense } from 'react';

const LazyAdminSpeakerDetail = lazy(() => import('./AdminSpeakerDetail'));

const AdminSpeakerDetail = (props: React.JSX.IntrinsicAttributes & { children?: React.ReactNode; }) => (
	<Suspense fallback={null}>
		<LazyAdminSpeakerDetail {...props} />
	</Suspense>
);

export default AdminSpeakerDetail;
