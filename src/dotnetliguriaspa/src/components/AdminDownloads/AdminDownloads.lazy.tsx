import React,{lazy,Suspense} from 'react';

const LazyAdminDownloads=lazy(() => import('./AdminDownloads'));

const AdminDownloads=(props : React.JSX.IntrinsicAttributes & { children? : React.ReactNode; }) => (
    <Suspense fallback={ null }>
        <LazyAdminDownloads pageName={ '' } { ...props } />
    </Suspense>
);

export default AdminDownloads;
