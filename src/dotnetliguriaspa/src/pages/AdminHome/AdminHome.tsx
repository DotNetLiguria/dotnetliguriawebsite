import React, { FC } from 'react';
import styles from './AdminHome.module.css';
import { data } from '../../mockup/chartData';
import AdminFeaturedInfo from "../../components/AdminFeaturedInfo/AdminFeaturedInfo";
import AdminWidgetLg from "../../components/AdminWidgetLg/AdminWidgetLg";
import AdminWidgetSm from "../../components/AdminWidgetSm/AdminWidgetSm";
import Chart from "../../components/Chart/Chart";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AdminHomeProps {}

const AdminHome: FC<AdminHomeProps> = () => (
    <div className={styles.AdminHome} data-testid="AdminHome">
        <AdminFeaturedInfo/>
        <Chart title="User Analytics" dataGrid={true} dataKey="Active User" data={data} />
        <div className={styles.AdminHomeWidgets}>
            <AdminWidgetSm />
            <AdminWidgetLg />
        </div>
    </div>
);

export default AdminHome;
