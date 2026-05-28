// src/context/AuthContext.jsx
// Simplified offline Auth Context for 100% self-contained client-side application

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import { get, post, setAuthToken, clearAuthToken, getStoredToken, setLogoutCallback } from '../services/api';
import { disconnectSocket } from '../services/socket';

// ─── State shape ─────────────────────────────────────────────────────────────
const initialState = {
  user: null,       // User profile stored in AsyncStorage
  token: null,      // Local session token
  isLoading: true,  // Screen splash loader control
  isAuthenticated: false,
};

// ─── Action types ─────────────────────────────────────────────────────────────
const ActionTypes = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  UPDATE_USER: 'UPDATE_USER',
  SET_LOADING: 'SET_LOADING',
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
function authReducer(state, action) {
  switch (action.type) {
    case ActionTypes.LOGIN:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };

    case ActionTypes.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
      };

    case ActionTypes.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };

    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ── On mount: restore session from local storage ───────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = await getStoredToken();

        if (!storedToken) {
          dispatch({ type: ActionTypes.SET_LOADING, payload: false });
          return;
        }

        // Validate token with mock API
        await setAuthToken(storedToken);
        const response = await get('/api/auth/me');
        const user = response.data?.user;

        if (user) {
          dispatch({
            type: ActionTypes.LOGIN,
            payload: { user, token: storedToken },
          });
        } else {
          await clearAuthToken();
          dispatch({ type: ActionTypes.SET_LOADING, payload: false });
        }
      } catch (error) {
        console.warn('[Auth] Local session restore failed:', error.message);
        await clearAuthToken();
        dispatch({ type: ActionTypes.SET_LOADING, payload: false });
      }
    };

    restoreSession();
  }, []);

  // ── Register logout callback with API service ─────────────────────────────
  useEffect(() => {
    setLogoutCallback(() => {
      logout();
    });
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (firebaseIdToken) => {
    dispatch({ type: ActionTypes.SET_LOADING, payload: true });
    try {
      const response = await post('/api/auth/verify-token', {
        idToken: firebaseIdToken,
      });

      const { user, token, isNewUser } = response.data;

      await setAuthToken(token);

      dispatch({
        type: ActionTypes.LOGIN,
        payload: { user, token },
      });

      return { user, token, isNewUser: !!isNewUser };
    } catch (error) {
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
      throw error;
    }
  }, []);

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      // Disconnect socket
      disconnectSocket();

      // Clear stored credentials
      await clearAuthToken();
    } catch (error) {
      console.warn('[Auth] Logout error:', error);
    } finally {
      dispatch({ type: ActionTypes.LOGOUT });
    }
  }, []);

  // ── updateProfile ─────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (data) => {
    try {
      const response = await post('/api/auth/profile', data);
      const updatedUser = response.data?.user;

      dispatch({
        type: ActionTypes.UPDATE_USER,
        payload: updatedUser || data,
      });

      return updatedUser;
    } catch (error) {
      console.error('[Auth] updateProfile error:', error);
      throw error;
    }
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────
  const value = {
    user: state.user,
    token: state.token,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    login,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

export default AuthContext;
