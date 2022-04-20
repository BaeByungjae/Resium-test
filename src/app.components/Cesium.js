import moment from 'moment';
import { useEffect, useState } from 'react';
import { CzmlDataSource, GeoJsonDataSource, Viewer } from 'resium';
export default function Cesium() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const worker = new Worker('/tle2czml.js');
    worker.postMessage(moment(window.initialTimeWindow).toISOString());
    worker.onmessage = (e) => {
      setData(e.data);
    };
  }, []);

  console.log(data);

  return (
    <Viewer full>
      <CzmlDataSource data={data} />
    </Viewer>
  );
}
