// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { AppProvider } from '~/contexts/AppContext';
import { AuthProvider } from '~/contexts/AuthContext';
import { AuthBootstrapper } from '~/components/AuthBootstrapper';
import { SignInPage } from '~/pages/SignInPage';
import { SignUpPage } from '~/pages/SignUpPage';
import { UserTimerPage } from '~/pages/UserTimerPage';
import { TimersPage } from '~/pages/TimersPage';
import { UserChecklistPage } from '~/pages/UserChecklistPage';
import {
  ROUTE_SIGN_IN,
  ROUTE_SIGN_UP,
  ROUTE_USER_TIMERS,
  ROUTE_USER_TIMER,
  ROUTE_USER_CHECKLIST,
} from '~/constants/routes';

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <BrowserRouter>
          {/* 전역 로그인 감시자 */}
          <AuthBootstrapper />

          <div className="app-root bg-black text-light min-vh-100">
            <Routes>
              <Route path={ROUTE_SIGN_IN} element={<SignInPage />} />
              <Route path={ROUTE_SIGN_UP} element={<SignUpPage />} />
              <Route path={ROUTE_USER_TIMERS} element={<TimersPage />} />
              <Route path={ROUTE_USER_TIMER} element={<UserTimerPage />} />
              <Route path={ROUTE_USER_CHECKLIST} element={<UserChecklistPage />} />

              {/* Default Page */}
              <Route path="*" element={<Navigate to={ROUTE_SIGN_IN} replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </AppProvider>
  );
}
