import React, { FC } from 'react';
import styles from './AdminHome.module.css';
import SideBar from "../../components/SideBar/SideBar";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AdminHomeProps {}

const AdminHome: FC<AdminHomeProps> = () => (
  <div className={styles.AdminHome} data-testid="AdminHome">
        <SideBar/>
  </div>
);

export default AdminHome;
