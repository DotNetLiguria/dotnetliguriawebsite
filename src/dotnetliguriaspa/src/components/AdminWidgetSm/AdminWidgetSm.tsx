import React, { FC } from 'react';
import styles from './AdminWidgetSm.module.css';
import VisibilityIcon from '@mui/icons-material/Visibility';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AdminWidgetSmProps {}

const AdminAdminWidgetSm: FC<AdminWidgetSmProps> = () => (
    <div className={styles.AdminWidgetSm}>
        <span className={styles.AdminWidgetSmTitle}>New Join Members</span>
        <ul className={styles.AdminWidgetSmList}>
            <li className={styles.AdminWidgetSmListItem}>
                <img src="https://amerlin.keantex.com/wp-content/uploads/2019/01/profilo.jpg?57d607&57d607" alt="" className={styles.AdminWidgetSmImg} />
                <div className={styles.AdminWidgetSmUser}>
                    <span className={styles.AdminWidgetSmUsername}>Andrea Merlin</span>
                    <span className={styles.AdminWidgetSmUserTitle}>Senior Developer</span>
                </div>
                <button className={styles.AdminWidgetSmButton}>
                    <VisibilityIcon className={styles.AdminWidgetSmIcon}/>
                    Display
                </button>
            </li>

            <li className={styles.AdminWidgetSmListItem}>
                <img src="https://amerlin.keantex.com/wp-content/uploads/2019/01/profilo.jpg?57d607&57d607" alt="" className={styles.AdminWidgetSmImg} />
                <div className={styles.AdminWidgetSmUser}>
                    <span className={styles.AdminWidgetSmUsername}>Andrea Merlin</span>
                    <span className={styles.AdminWidgetSmUserTitle}>Senior Developer</span>
                </div>
                <button className={styles.AdminWidgetSmButton}>
                    <VisibilityIcon className={styles.AdminWidgetSmIcon}/>
                    Display
                </button>
            </li>

            <li className={styles.AdminWidgetSmListItem}>
                <img src="https://amerlin.keantex.com/wp-content/uploads/2019/01/profilo.jpg?57d607&57d607" alt="" className={styles.AdminWidgetSmImg} />
                <div className={styles.AdminWidgetSmUser}>
                    <span className={styles.AdminWidgetSmUsername}>Andrea Merlin</span>
                    <span className={styles.AdminWidgetSmUserTitle}>Senior Developer</span>
                </div>
                <button className={styles.AdminWidgetSmButton}>
                    <VisibilityIcon className={styles.AdminWidgetSmIcon}/>
                    Display
                </button>
            </li>


        </ul>
    </div>
);

export default AdminAdminWidgetSm;
