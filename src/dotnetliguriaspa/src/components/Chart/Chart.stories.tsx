/* eslint-disable */
import Chart from './Chart';

export default {
  title: "Chart",
};

export const Default = () => <Chart title={''} dataGrid={false} data={[]} dataKey={''}/>;

Default.story = {
  name: 'default',
};
