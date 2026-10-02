import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Pet from './Pet';
import Hub from './Hub';
import './styles.css';

const params = new URLSearchParams(window.location.search);
const isPet = params.get('view') === 'pet';
const isHub = params.get('view') === 'hub';
if (isPet || isHub) document.documentElement.classList.add('transparent-surface');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isPet ? <Pet /> : isHub ? <Hub /> : <App />}</React.StrictMode>,
);
