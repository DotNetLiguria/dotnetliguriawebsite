import React, { FC } from 'react';
import styles from './AdminHome.module.css';
import AdminFeaturedInfo from "../../components/AdminFeaturedInfo/AdminFeaturedInfo";
import AdminWidgetLg from "../../components/AdminWidgetLg/AdminWidgetLg";
import AdminWidgetSm from "../../components/AdminWidgetSm/AdminWidgetSm";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AdminHomeProps {}

const AdminHome: FC<AdminHomeProps> = () => (
    <div className={styles.AdminHome} data-testid="AdminHome">
        <AdminFeaturedInfo/>
    </div>
);

export default AdminHome;
