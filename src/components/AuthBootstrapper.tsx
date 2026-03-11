// components/AuthBootstrapper.tsx
import { useEffect } from 'react';
import { useLocation, useNavigate, generatePath } from 'react-router-dom';

import { useAuth } from '~/contexts/AuthContext';
import {
  ROUTE_SIGN_IN,
  ROUTE_SIGN_UP,
  ROUTE_USER_TIMERS,
} from '~/constants/routes';

export function AuthBootstrapper() {
  const { user, initializing } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (initializing) return;
    if (!user) return;

    const path = location.pathname;

    // 로그인 / 회원가입 페이지에서만 개입
    if (path !== ROUTE_SIGN_IN && path !== ROUTE_SIGN_UP) {
      return;
    }

    const uid = user.uid;
    if (uid) {
      nav(generatePath(ROUTE_USER_TIMERS, {uid}), { replace: true });
    }
  }, [user, initializing, location.pathname, nav]);

  return null;
}
