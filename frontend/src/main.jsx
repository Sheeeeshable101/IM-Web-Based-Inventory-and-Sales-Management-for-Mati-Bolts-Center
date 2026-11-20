import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '../css/base.css';
import '../css/layout.css';
import '../css/components.css';
import '../css/responsive.css';

createRoot(document.getElementById('root')).render(<App />);
