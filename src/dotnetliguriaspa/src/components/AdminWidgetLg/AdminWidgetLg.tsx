import React, { FC } from 'react';
import styles from './AdminWidgetLg.module.css';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AdminWidgetLgProps {}

const AdminWidgetLg: FC<AdminWidgetLgProps> = () => (
    <div className={styles.AdminWidgetLg}>
        <span className={styles.AdminWidgetLgTitle}>Latest transactions</span>
        <table className={styles.AdminWidgetLgTable}>
            <thead>
            <tr className={styles.AdminWidgetLgTr}>
                <th className={styles.AdminWidgetLgTh}>Customer</th>
                <th className={styles.AdminWidgetLgTh}>Date</th>
                <th className={styles.AdminWidgetLgTh}>Amount</th>
                <th className={styles.AdminWidgetLgTh}>Status</th>
            </tr>
            </thead>
            <tbody>
            <tr className={styles.AdminWidgetLgTr}>
                <td className={styles.AdminWidgetLgUser}>
                    <img src="https://amerlin.keantex.com/wp-content/uploads/2019/01/profilo.jpg?57d607&57d607" alt="profile" className={styles.AdminWidgetLgImg}></img>
                    <span className={styles.AdminWidgetLgName}>Andrea Merlin</span>
                </td>
                <td className={styles.AdminWidgetLgDate}>2 Jub 2023</td>
                <td className={styles.AdminWidgetLgAmount}>$122.00</td>
                <td className={styles.AdminWidgetLgStatus}><button className={styles.AdminWidgetLgButton}>Approved</button></td>
            </tr>
            <tr className={styles.AdminWidgetLgTr}>
                <td className={styles.AdminWidgetLgUser}>
                    <img src="https://amerlin.keantex.com/wp-content/uploads/2019/01/profilo.jpg?57d607&57d607" alt="profile" className={styles.WidgetLgImg}></img>
                    <span className={styles.AdminWidgetLgName}>Andrea Merlin</span>
                </td>
                <td className={styles.AdminWidgetLgDate}>2 Jub 2023</td>
                <td className={styles.AdminWidgetLgAmount}>$122.00</td>
                <td className={styles.AdminWidgetLgStatus}><button className={styles.WidgegLgButton}>Approved</button></td>
            </tr>
            <tr className={styles.AdminWidgetLgTr}>
                <td className={styles.AdminWidgetLgUser}>
                    <img src="https://amerlin.keantex.com/wp-content/uploads/2019/01/profilo.jpg?57d607&57d607" alt="profile" className={styles.WidgetLgImg}></img>
                    <span className={styles.AdminWidgetLgName}>Andrea Merlin</span>
                </td>
                <td className={styles.AdminWidgetLgDate}>2 Jub 2023</td>
                <td className={styles.AdminWidgetLgAmount}>$122.00</td>
                <td className={styles.AdminWidgetLgStatus}><button className={styles.WidgegLgButton}>Approved</button></td>
            </tr>
            </tbody>
        </table>
    </div>
);

export default AdminWidgetLg;
