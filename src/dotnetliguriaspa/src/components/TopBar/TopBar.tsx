import React, {FC, useState} from 'react';
import styles from './TopBar.module.css';
import {Notifications, Language} from "@mui/icons-material/";
import SettingsIcon from '@mui/icons-material/Settings';
import LoginControl from "../loginControl";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface TopBarProps {
}

const TopBar: FC<TopBarProps> = () => {

    const [result, setResult] = useState("");
    const [isError, setIsError] = useState(true);
    
    const loggedOut = () => {
        setResult("");
        setIsError(true);
    }
    
    return (
        <div className={styles.TopBar}>
            <div className={styles.TopBarWrapper}>
                <div className="topLeft">
                    <div className={styles.logo}>DotNet Liguria</div>
                </div>
                <div className={styles.TopRight}>
                    {/*<div className={styles.TopIconContainer}>*/}
                    {/*    <Notifications/>*/}
                    {/*    <div className={styles.TopIconBadge}>*/}
                    {/*        5*/}
                    {/*    </div>*/}
                    {/*</div>*/}
                    {/*<div className={styles.TopIconContainer}>*/}
                    {/*    <Language/>*/}
                    {/*    <div className={styles.TopIconBadge}>*/}
                    {/*        5*/}
                    {/*    </div>*/}
                    {/*</div>*/}
                    {/*<div className={styles.TopIconContainer}>*/}
                    {/*    <SettingsIcon/>*/}
                    {/*</div>*/}
                    <div>
                        <LoginControl onLogout={loggedOut}/>
                    </div>
                    <img src="https://amerlin.keantex.com/wp-content/uploads/2019/01/profilo.jpg?57d607&57d607"
                         alt="Profile" className={styles.TopAvatar}/>
                </div>
            </div>
        </div>
    );
}
export default TopBar;
