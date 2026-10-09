import React, { FC } from 'react';
import TopBar from "../TopBar/TopBar";
import { Box } from "@mui/material";
import CustomSideBar from "../CustomSideBar/CustomSideBar";
import { Outlet } from "react-router-dom";
interface AdminLayoutProps { pageName?: string; }

const AdminLayout: FC<AdminLayoutProps> = () => (
    <>
        <TopBar pageName={""} showMenu={false} />
        <Box component={"div"}  sx={{ display: "flex", ...({ marginTop: '60px' }) }}>
            <CustomSideBar />
            <Outlet />
        </Box>
    </>
);

export default AdminLayout;
