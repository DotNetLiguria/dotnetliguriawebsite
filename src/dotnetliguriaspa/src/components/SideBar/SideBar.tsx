import React, {FC} from 'react';
import styles from './SideBar.module.css';
import LineStyleIcon from '@mui/icons-material/LineStyle';
import Timeline from '@mui/icons-material/Timeline';
import TrendingUp from '@mui/icons-material/TrendingUp';
import VerifiedUser from '@mui/icons-material/VerifiedUser';
import ProductionQuantityLimits from '@mui/icons-material/ProductionQuantityLimits';
import Money from '@mui/icons-material/Money';
import Report from '@mui/icons-material/Report';
import Mail from '@mui/icons-material/Mail';
import Feedback from '@mui/icons-material/Feedback';
import Message from '@mui/icons-material/Message';
import ManageAccounts from '@mui/icons-material/ManageAccounts';
import {Link} from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface SideBarProps {
}

const SideBar: FC<SideBarProps> = () => (
    <div className={styles.SideBar}>
        <div className={styles.SideBarWrapper}>
            <div className={styles.SideBarMenu}>
                <h3 className={styles.SideBarTitle}>Dashboard</h3>
                <ul className={styles.SideBarList}>
                    <Link to="/" className="link">
                        <li className={styles.SideBarListItem}>
                            <LineStyleIcon className={styles.SideBarIcon}/>
                            Home
                        </li>
                    </Link>
                    <Link to="/admin/analytics/" className="link">
                        <li className={styles.SideBarListItem}>
                            <Timeline className={styles.SideBarIcon}/>
                            Analytics
                        </li>
                    </Link>
                </ul>
            </div>

            <div className={styles.SideBarMenu}>
                <h3 className={styles.SideBarTitle}>Quick Menu</h3>
                <ul className={styles.SideBarList}>
                    <Link to="/admin/users/" className="link">
                        <li className={styles.SideBarListItem}>
                            <VerifiedUser className={styles.SideBarIcon}/>
                            Users
                        </li>
                    </Link>
                    <Link to="/admin/workshops" className="link">
                        <li className={styles.SideBarListItem}>
                            <ProductionQuantityLimits className={styles.SideBarIcon}/>
                            Workshops
                        </li>
                    </Link>
                    <Link to="/admin/events/" className="link">
                        <li className={styles.SideBarListItem}>
                            <Money className={styles.SideBarIcon}/>
                            Events
                        </li>
                    </Link>
                    <Link to="/admin/reports/" className="link">
                        <li className={styles.SideBarListItem}>
                            <Report className={styles.SideBarIcon}/>
                            Reports
                        </li>
                    </Link>
                </ul>
            </div>

            <div className={styles.SideBarMenu}>
                <h3 className={styles.SideBarTitle}>Notifications</h3>
                <ul className={styles.SideBarList}>
                    <Link to="/admin/mails/" className="link">
                        <li className={styles.SideBarListItem}>
                            <Mail className={styles.SideBarIcon}/>
                            Mail
                        </li>
                    </Link>
                    <Link to="/admin/feedbacks/" className="link">
                        <li className={styles.SideBarListItem}>
                            <Feedback className={styles.SideBarIcon}/>
                            Feedbacks
                        </li>
                    </Link>
                    <Link to="/admin/messages/" className="link">
                        <li className={styles.SideBarListItem}>
                            <Message className={styles.SideBarIcon}/>
                            Messages
                        </li>
                    </Link>
                </ul>
            </div>

            <div className={styles.SideBarMenu}>
                <h3 className={styles.SideBarTitle}>Staff</h3>
                <ul className={styles.SideBarList}>
                    <Link to="/admin/manage/" className="link">
                        <li className={styles.SideBarListItem}>
                            <ManageAccounts className={styles.SideBarIcon}/>
                            Manage
                        </li>
                    </Link>
                    <Link to="/admin/analytics/" className="link">
                        <li className={styles.SideBarListItem}>
                            <Timeline className={styles.SideBarIcon}/>
                            Analytics
                        </li>
                    </Link>
                    <Link to="/admin/reports" className="link">
                        <li className={styles.SideBarListItem}>
                            <Report className={styles.SideBarIcon}/>
                            Reports
                        </li>
                    </Link>
                    <Link to="/admin/tokens" className="link">
                        <li className={styles.SideBarListItem}>
                            <Report className={styles.SideBarIcon}/>
                            Tokens Check
                        </li>
                    </Link>
                </ul>
            </div>

        </div>
    </div>
);

export default SideBar;
