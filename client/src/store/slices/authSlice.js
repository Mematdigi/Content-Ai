import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ---- Hydrate from localStorage (so refreshes don't sign out) -----------
const persistedUser = (() => {
  try {
    return JSON.parse(localStorage.getItem('cf_user') || 'null');
  } catch {
    return null;
  }
})();

const initialState = {
  user: persistedUser,
  token: localStorage.getItem('cf_token') || null,
  status: 'idle',
  error: null,
};

// ---- Thunks ------------------------------------------------------------
export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/login', credentials);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  }
);

export const registerThunk = createAsyncThunk(
  'auth/register',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/register', payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Registration failed');
    }
  }
);

export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/me');
    return data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Session expired');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      localStorage.removeItem('cf_token');
      localStorage.removeItem('cf_user');
    },
    updateUserLocal(state, action) {
      state.user = { ...state.user, ...action.payload };
      localStorage.setItem('cf_user', JSON.stringify(state.user));
    },
  },
  extraReducers: (builder) => {
    const fulfill = (state, action) => {
      state.status = 'succeeded';
      state.user = action.payload.user;
      state.token = action.payload.token;
      localStorage.setItem('cf_token', action.payload.token);
      localStorage.setItem('cf_user', JSON.stringify(action.payload.user));
    };
    const fail = (state, action) => {
      state.status = 'failed';
      state.error = action.payload || 'Auth error';
    };
    const start = (state) => {
      state.status = 'loading';
      state.error = null;
    };

    builder
      .addCase(loginThunk.pending, start)
      .addCase(loginThunk.fulfilled, fulfill)
      .addCase(loginThunk.rejected, fail)
      .addCase(registerThunk.pending, start)
      .addCase(registerThunk.fulfilled, fulfill)
      .addCase(registerThunk.rejected, fail)
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        localStorage.setItem('cf_user', JSON.stringify(action.payload));
      });
  },
});

export const { logout, updateUserLocal } = authSlice.actions;
export default authSlice.reducer;
