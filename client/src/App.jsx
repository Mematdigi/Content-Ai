import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AnimatePresence } from 'framer-motion';

import MainLayout from './components/Layout/MainLayout';
import PrivateRoute from './components/PrivateRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import WizardGenerator from './pages/WizardGenerator';
import ArticleView from './pages/ArticleView';
import History from './pages/History';
import Calendar from './pages/Calendar';
import Tools from './pages/Tools';
import Settings from './pages/Settings';

export default function App() {
  const themeMode = useSelector((s) => s.theme.mode);
  const location = useLocation();

  // Apply theme to <html data-theme="...">. Using an attribute (rather than
  // a class on body) keeps things tidy and lets [data-theme='dark'] selectors
  // inside our SCSS work without specificity battles.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<MainLayout />}>
          <Route path="/articles/:id" element={<ArticleView />} />
        </Route>

        <Route element={<PrivateRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/generate" element={<Generator />} />
            <Route path="/generate/wizard" element={<WizardGenerator />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/history" element={<History />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
