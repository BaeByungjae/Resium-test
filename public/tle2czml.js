importScripts(
  'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/satellite.js/4.0.0/satellite.min.js'
);

self.addEventListener('message', async function (e) {
  console.log(e.data);
  const tle = await drawTLEs(e.data);
  postMessage(tle);
});

// self.onconnect = function (e) {
//   var port = e.ports[0];
//   console.log(port)
//   port.addEventListener('message', function (e) {
//     console.log(e.data);
//     const tle = await drawTLEs(e.data[0]);
//     port.postMessage(workerResult);
//   });

//   port.start(); // Required when using addEventListener. Otherwise called implicitly by onmessage setter.
// };

const duration = 600;
const intervalUnitTime = 600;

async function drawTLEs(initialTimeWindow) {
  let response;
  try {
    response = await fetch('latest_all_LEO.tle');
  } catch (e) {
    console.log(e);
  }

  if (response.status != 200) {
    throw new Error('Server Error');
  }
  // read response stream as text
  let textData = await response.text();
  let RSOParameterResponseData = await readRSOParameters();
  let tleCZML = await tle2czml(
    textData,
    initialTimeWindow,
    RSOParameterResponseData,
    duration
  );

  return tleCZML;
}

async function readRSOParameters() {
  let RSOParameterResponse = await fetch('/RSO_parameters.json');
  if (RSOParameterResponse.status != 200) {
    throw new Error('Server Error');
  }
  // read response stream as text
  return await RSOParameterResponse.json();
}

async function tle2czml(tles, currentTime, RSOParameterResponseData, duration) {
  let tlesArray = tles.split('\r\n');
  let totalCZML = [];
  totalCZML.push(await document2czml(currentTime, duration));
  let eachTLE = [];
  // tlesArray.forEach(async function (tle, i) {
  let i = 0;
  for (let tle of tlesArray) {
    if (i % 3 == 0) {
      //first line
      eachTLE.push(tle);
    } else if (i % 3 == 1) {
      //second line
      eachTLE.push(tle);
    } else {
      //third line
      eachTLE.push(tle);
      let satrec = satellite.twoline2satrec(eachTLE[1], eachTLE[2]);
      let satName = eachTLE[0];
      let satID = satrec.satnum.split(' ').join('');
      satID = satID.replace(/(^0+)/, '');
      let RSOParameter = RSOParameterResponseData[satID];
      try {
        let RSOType = RSOParameter[0].OBJECT_TYPE;
        let countryCode = RSOParameter[0].COUNTRY_CODE;

        let currCZML = await satrec2czml(
          satrec,
          satName,
          currentTime,
          duration,
          RSOType,
          countryCode
        );
        if (currCZML != null) {
          totalCZML.push(currCZML);
        }
      } catch (error) {
        console.log(error);
      }

      eachTLE = [];
    }
    i += 1;
  }
  return totalCZML;
}

async function document2czml(startTime, duration) {
  startTime = moment(startTime, 'YYYY-MM-DDTHH:mm:ss.SSSSZ')
    .clone()
    .add(duration, 's')
    .toISOString();
  let endTime = moment(startTime, 'YYYY-MM-DDTHH:mm:ss.SSSSZ')
    .clone()
    .add(duration, 's')
    .toISOString();
  let documentCZML = {
    id: 'document',
    // name: 'CZML Point - Time Dynamic',
    version: '1.0',
    clock: {
      currentTime: `${startTime}`,
      interval: `${startTime}/${endTime}`,
      multiplier: 1,
      range: 'UNBOUNDED',
      step: 'SYSTEM_CLOCK_MULTIPLIER',
    },
  };
  return documentCZML;
}

async function satrec2czml(
  satrec,
  satName,
  startTime,
  duration,
  RSOType,
  countryCode
) {
  startTime = moment(startTime, 'YYYY-MM-DDTHH:mm:ss.SSSSZ')
    .clone()
    .add(duration, 's')
    .toISOString();
  let endTime = moment(startTime, 'YYYY-MM-DDTHH:mm:ss.SSSSZ')
    .clone()
    .add(duration, 's')
    .toISOString();

  let res = []; //result for position
  let vel = [];
  let initTime = new Date(startTime);
  let twoPi = Math.PI * 2;
  let periodSeconds = (twoPi / satrec.no) * 60;
  let pieces = 30;
  let totalCircles = 10;

  for (
    let i = 0;
    i <= periodSeconds * totalCircles;
    i += periodSeconds / pieces
  ) {
    //iterates every second (86400sec in 1day)
    let positionAndVelocity = satellite.propagate(satrec, initTime); // 0.0166667min = 1sec
    initTime.setSeconds(initTime.getSeconds() + intervalUnitTime);
    let positionEci = positionAndVelocity.position;
    try {
      positionEci.x = positionEci.x * 1000;
      positionEci.y = positionEci.y * 1000;
      positionEci.z = positionEci.z * 1000;
    } catch (err) {
      return null;
    }
    if (satrec.satnum === '39227') {
      let velocityEci = positionAndVelocity.velocity;
      try {
        velocityEci.x = velocityEci.x * 1000;
        velocityEci.y = velocityEci.y * 1000;
        velocityEci.z = velocityEci.z * 1000;
        vel.push([i, velocityEci.x, velocityEci.y, velocityEci.z]);
      } catch (err) {
        return null;
      }
    }

    res.push(i, positionEci.x, positionEci.y, positionEci.z);
  }
  if (satrec.satnum === '39227') {
    console.log(vel);
    console.log(satrec.no);
    console.log(periodSeconds);
  }
  let satID = satrec.satnum.split(' ').join('');

  let rgba = [];
  if (RSOType == 'PAYLOAD') {
    rgba = [0, 255, 0, 255];
  } else if (RSOType == 'ROCKET BODY') {
    rgba = [226, 66, 5, 255];
  } else if (RSOType == 'DEBRIS') {
    rgba = [200, 16, 46, 255];
  } else if (RSOType == 'TBA') {
    rgba = [120, 120, 120, 255];
  } else {
    rgba = [120, 120, 120, 255];
  }

  satName = satName.replace(/(^0+)/, '');
  let initialCZMLProps = {
    id: `${satID}`,
    name: `${satName} / ${satID}`,
    availability: `${startTime}/${endTime}`,
    description: `Orbit of Satellite: ${satName} / ${satID} / ${RSOType} / ${countryCode}`,
    point: {
      show: true,
      color: {
        rgba: [255, 255, 255, 255],
      },
      outlineColor: {
        rgba: [rgba[0], rgba[1], rgba[2], rgba[3]],
      },
      outlineWidth: 0.3,
      // pixelSize: pixelSize,
      scaleByDistance: { nearFarScalar: [8400000.0, 1.5, 27720000.0, 0.5] },
      // translucencyByDistance: {
      //   nearFarScalar: [27720000.0, 1.0, 3600000000.0, 0.3],
      // },
    },
    // model: {
    //   show: true,
    //   minimumPixelSize: 350,
    // },
    position: {
      interpolationAlgorithm: 'LAGRANGE',
      forwardExtrapolationType: 'EXTRAPOLATE',
      forwardExtrapolationDuration: 0,
      backwardExtrapolationType: 'EXTRAPOLATE',
      backwardExtrapolationDuration: 0,
      interpolationDegree: 5,
      referenceFrame: 'INERTIAL',
      epoch: `${startTime}`,
      cartesian: res,
    },
  };

  return initialCZMLProps;
}
