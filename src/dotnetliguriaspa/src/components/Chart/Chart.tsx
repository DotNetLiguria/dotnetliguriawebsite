import React, { FC } from 'react';
import styles from './Chart.module.css';
import {CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, ResponsiveContainer} from "recharts";
import {ChartDataGridData} from "../../models/ChartDataGridData";

interface ChartProps {
    title:string,
    dataGrid:boolean,
    data:ChartDataGridData[],
    dataKey:string
}

const Chart: FC<ChartProps> = (props) => (
    <div className={styles.Chart}>
        <h3 className="ChartTitle">{props.title}</h3>
        <ResponsiveContainer width="100%" aspect={4/1}>
            <LineChart data={props.data}>
                <XAxis dataKey ="name" stroke="#5550bd"/>
                <Line type="monotone" dataKey={props.dataKey} stroke="#5550bd"/>
                <Tooltip/>
                {props.dataGrid && <CartesianGrid stroke="#e0dfdf" strokeDasharray="5 5"/>}
                <Legend/>
            </LineChart>
        </ResponsiveContainer>
    </div>
);

export default Chart;
