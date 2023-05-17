import React, {FC} from 'react';
import styles from './AdminFeaturedInfo.module.css';
import {ArrowDownward, ArrowUpward} from "@mui/icons-material";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AdminFeaturedInfoProps {}

const AdminFeaturedInfo: FC<AdminFeaturedInfoProps> = () => (
    <div className={styles.AdminFeaturedInfo} data-testid="AdminFeaturedInfo">
        <div className={styles.AdminFeaturedItem}>
      <span className={styles.AdminFeaturedTitle}>
        Revanue
      </span>
            <div className={styles.AdminFeaturedMoneyContainer}>
                <span className={styles.AdminFeaturedMoney}>$2,415</span>
                <span className={styles.AdminFeaturedMoneyRate}>-11.4<ArrowDownward className={styles.AdminFeaturedIcon}/></span>
            </div>
            <span className={styles.AdminFeaturedSub}>Compared to last mouth</span>
        </div>

        <div className={styles.AdminFeaturedItem}>
      <span className={styles.AdminFeaturedTitle}>
        Revanue
      </span>
            <div className={styles.AdminFeaturedMoneyContainer}>
                <span className={styles.AdminFeaturedMoney}>$2,415</span>
                <span className={styles.AdminFeaturedMoneyRate}>-11.4<ArrowUpward className={styles.AdminFeaturedIcon}/></span>
            </div>
            <span className={styles.AdminFeaturedSub}>Compared to last mouth</span>
        </div>

        <div className={styles.AdminFeaturedItem}>
      <span className={styles.AdminFeaturedTitle}>
        Revanue
      </span>
            <div className={styles.AdminFeaturedMoneyContainer}>
                <span className={styles.AdminFeaturedMoney}>$2,415</span>
                <span className={styles.AdminFeaturedMoneyRate}>-11.4<ArrowDownward className={styles.AdminFeaturedIconNegative}/></span>
            </div>
            <span className={styles.AdminFeaturedSub}>Compared to last mouth</span>
        </div>
    </div>
);

export default AdminFeaturedInfo;
