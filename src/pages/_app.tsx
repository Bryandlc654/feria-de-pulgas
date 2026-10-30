import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Feria de Pulgas — Juego Multijugador en Tiempo Real</title>
        <meta
          name="description"
          content="Juego de cartas multijugador en tiempo real basado en Feria de Pulgas / Pit. Intercambio de antigüedades simultáneo sin recargas."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏺</text></svg>" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
