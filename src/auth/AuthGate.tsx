import React from 'react';
import { useAuth } from './AuthContext';
import {
  ChangePasswordScreen,
  LoadingScreen,
  LoginScreen,
  OfflineScreen,
  SetupScreen,
} from '../components/auth/AuthScreen';

/** Renders the app only for a signed-in user whose password is their own. */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, signedIn, retry } = useAuth();

  switch (state.status) {
    case 'loading':
      return <LoadingScreen />;
    case 'offline':
      return <OfflineScreen onRetry={retry} />;
    case 'setup':
      return <SetupScreen onSignedIn={signedIn} tokenRequired={state.setupTokenRequired} />;
    case 'signed-out':
      return <LoginScreen onSignedIn={signedIn} expired={state.reason === 'expired'} />;
    case 'signed-in':
      if (state.user.mustChangePassword) {
        return <ChangePasswordScreen forced onDone={signedIn} />;
      }
      // Keyed by account so switching users never carries one person's
      // in-memory visit into another's session.
      return <React.Fragment key={state.user.id}>{children}</React.Fragment>;
  }
};
