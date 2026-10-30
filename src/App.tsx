import { HashRouter, Route, Routes } from 'react-router';
import { HelloPage } from './pages/HelloPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="*" element={<HelloPage />} />
      </Routes>
    </HashRouter>
  );
}
