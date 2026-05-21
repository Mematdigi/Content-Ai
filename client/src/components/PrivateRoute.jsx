import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

/**
 * Auth guard. If there's no token in Redux, send the user to /login and
 * remember where they were trying to go so we can return them after login.
 */
export default function PrivateRoute() {
  const token = useSelector((s) => s.auth.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
