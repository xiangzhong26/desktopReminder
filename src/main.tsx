import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Pet from './Pet';
import './styles.css';

const params = new URLSearchParams(window.location.search);
const isPet = params.get('view') === 'pet';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isPet ? <Pet /> : <App />}</React.StrictMode>,
);
