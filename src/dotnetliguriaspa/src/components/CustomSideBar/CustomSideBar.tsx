import React, { FC } from 'react';
import { Box, Divider, Link, List, ListItem, Typography } from "@mui/material";
import HomeIcon from '@mui/icons-material/Home';
import GroupsIcon from '@mui/icons-material/Groups';
import FeedIcon from '@mui/icons-material/Feed';
import PersonIcon from '@mui/icons-material/Person';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import EventNoteIcon from '@mui/icons-material/EventNote';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ImportExportIcon from '@mui/icons-material/ImportExport';
// import DownloadIcon from '@mui/icons-material/Download';
import MenuIcon from '@mui/icons-material/Menu';
import { Link as RouterLink } from "react-router-dom";
const CustomSideBar: FC = () => {
    return (
        <>
            <Box component={"div"}   sx={{ pl: 2, mr: 5 }}>
                <Typography sx={{ color: 'primary.main', fontSize: '1.5rem', fontWeight: 600 }}>Dashboard</Typography>
                <Divider sx={{ "padding-bottom": "10px" }}></Divider>
                <List>
                    <ListItem><Box   sx={{ display: "flex", alignItems: "center" }}><HomeIcon sx={{ color: 'primary.main' }} /><Link  href="/" target="_blank" rel="noopener noreferrer" underline="none" sx={{ pl: 1 }}><Typography  sx={{ fontSize: 16, ...({ color: 'primary.main' }) }}>HOME</Typography></Link></Box></ListItem>
                    <ListItem><Box   sx={{ display: "flex", alignItems: "center" }}><FeedIcon sx={{ color: 'primary.main' }} /><Link  component={RouterLink} to="/admin/profile/" underline="none" sx={{ pl: 1 }}><Typography  sx={{ fontSize: 16, ...({ color: 'primary.main' }) }}>PROFILE</Typography></Link></Box></ListItem>
                    <ListItem><Box   sx={{ display: "flex", alignItems: "center" }}><GroupsIcon sx={{ color: 'primary.main' }} /><Link  component={RouterLink} to="/admin/board/" underline="none" sx={{ pl: 1 }}><Typography  sx={{ fontSize: 16, ...({ color: 'primary.main' }) }}>BOARD</Typography></Link></Box></ListItem>
                    <ListItem><Box   sx={{ display: "flex", alignItems: "center" }}><PersonIcon sx={{ color: 'primary.main' }} /><Link  component={RouterLink} to="/admin/speakers/" underline="none" sx={{ pl: 1 }}><Typography  sx={{ fontSize: 16, ...({ color: 'primary.main' }) }}>SPEAKERS</Typography></Link></Box></ListItem>
                    <ListItem><Box   sx={{ display: "flex", alignItems: "center" }}><EventNoteIcon sx={{ color: 'primary.main' }} /><Link  component={RouterLink} to="/admin/workshops/" underline="none" sx={{ pl: 1 }}><Typography  sx={{ fontSize: 16, ...({ color: 'primary.main' }) }}>WORKSHOPS</Typography></Link></Box></ListItem>
                    <ListItem><Box sx={{ display: "flex", alignItems: "center" }}><LocationOnIcon sx={{ color: 'primary.main' }} /><Link component={RouterLink} to="/admin/venues/" underline="none" sx={{ pl: 1 }}><Typography sx={{ fontSize: 16, color: 'primary.main' }}>VENUES / SALE EVENTI</Typography></Link></Box></ListItem>
                    <ListItem><Box   sx={{ display: "flex", alignItems: "center" }}><QuestionAnswerIcon sx={{ color: 'primary.main' }} /><Link  component={RouterLink} to="/admin/questionnaires" underline="none" sx={{ pl: 1 }}><Typography  sx={{ fontSize: 16, ...({ color: 'primary.main' }) }}>QUESTIONARI</Typography></Link></Box></ListItem>
                    <ListItem><Box   sx={{ display: "flex", alignItems: "center" }}><MenuIcon sx={{ color: 'primary.main' }} /><Link  component={RouterLink} to="/admin/topmenu/" underline="none" sx={{ pl: 1 }}><Typography  sx={{ fontSize: 16, ...({ color: 'primary.main' }) }}>TOP MENU</Typography></Link></Box></ListItem>
                    <ListItem><Box sx={{ display: "flex", alignItems: "center" }}><ImportExportIcon sx={{ color: 'primary.main' }} /><Link component={RouterLink} to="/admin/import-export/" underline="none" sx={{ pl: 1 }}><Typography sx={{ fontSize: 16, color: 'primary.main' }}>IMPORT / EXPORT</Typography></Link></Box></ListItem>
                    {/* <ListItem><Box display={"flex"} alignItems={"center"}><DownloadIcon sx={{ color: 'primary.main' }} /><Link pl={1} component={RouterLink} to="/admin/downloads/" underline="none"><Typography fontSize={16} sx={{ color: 'primary.main' }}>DOWNLOADS</Typography></Link></Box></ListItem> */}
                    <Divider></Divider>
                </List>
            </Box>
        </>
    )
};

export default CustomSideBar;
