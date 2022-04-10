import dynamic from 'next/dynamic';
import Head from 'next/head';

const Cesium = dynamic(() => import('../app.components/Cesium'), {
  ssr: false,
});

const Home = () => {
  return (
    <>
      <Head>
        <link rel="stylesheet" href="cesium/Widgets/widgets.css" />
      </Head>
      <Cesium />
    </>
  );
};

export default Home;
