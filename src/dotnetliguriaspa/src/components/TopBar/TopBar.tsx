import React, { FC } from 'react';
import styles from './TopBar.module.css';
import { Notifications, Language } from "@mui/icons-material/";
import SettingsIcon from '@mui/icons-material/Settings';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface TopBarProps {}

const TopBar: FC<TopBarProps> = () => (
    <div className={styles.TopBar}>
        <div className={styles.TopBarWrapper}>
            <div className="topLeft">
                <div className={styles.logo}>DotNet Liguria</div>
            </div>
            <div className={styles.TopRight}>
                <div className={styles.TopIconContainer}>
                    <Notifications/>
                    <div className={styles.TopIconBadge}>
                        5
                    </div>
                </div>
                <div className={styles.TopIconContainer}>
                    <Language/>
                    <div className={styles.TopIconBadge}>
                        5
                    </div>
                </div>
                <div className={styles.TopIconContainer}>
                    <SettingsIcon/>
                </div>
                <div className={styles.TopIconContainer}>
                    Logout
                </div>
                <img src="https://amerlin.keantex.com/wp-content/uploads/2019/01/profilo.jpg?57d607&57d607" alt="Profile" className={styles.TopAvatar}/>
            </div>
        </div>
    </div>
);

export default TopBar;
