import React, { FC } from 'react';
import styles from './Layout.module.css';
import SideBar from "../SideBar/SideBar";
import { Outlet } from "react-router-dom"
import TopBar from "../TopBar/TopBar";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface LayoutProps {}

const Layout: FC<LayoutProps> = () => (
    <div className={styles.Layout} data-testid="Layout">
        <TopBar/>
        <div className="container">
            <SideBar/>
            <Outlet/>
        </div>
    </div>
);

export default Layout;
