import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

const initialState = {
  items: [],
  total: 0,
  current: null,
  generating: false,
  pipelineProgress: { step: null, percent: 0 },
  status: 'idle',
  error: null,
};

export const generateArticleThunk = createAsyncThunk(
  'articles/generate',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/articles/generate', payload);
      return data.article;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Generation failed');
    }
  }
);

export const listArticlesThunk = createAsyncThunk(
  'articles/list',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/articles', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load articles');
    }
  }
);

export const getArticleThunk = createAsyncThunk(
  'articles/get',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/articles/${id}`);
      return data.article;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Article not found');
    }
  }
);

export const updateArticleThunk = createAsyncThunk(
  'articles/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/articles/${id}`, body);
      return data.article;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Update failed');
    }
  }
);

export const deleteArticleThunk = createAsyncThunk(
  'articles/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/articles/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Delete failed');
    }
  }
);

const articleSlice = createSlice({
  name: 'articles',
  initialState,
  reducers: {
    setPipelineProgress(state, action) {
      state.pipelineProgress = action.payload;
    },
    clearCurrent(state) {
      state.current = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateArticleThunk.pending, (state) => {
        state.generating = true;
        state.error = null;
      })
      .addCase(generateArticleThunk.fulfilled, (state, action) => {
        state.generating = false;
        state.current = action.payload;
        state.items = [action.payload, ...state.items];
      })
      .addCase(generateArticleThunk.rejected, (state, action) => {
        state.generating = false;
        state.error = action.payload;
      })
      .addCase(listArticlesThunk.fulfilled, (state, action) => {
        state.items = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(getArticleThunk.fulfilled, (state, action) => {
        state.current = action.payload;
      })
      .addCase(updateArticleThunk.fulfilled, (state, action) => {
        state.current = action.payload;
        state.items = state.items.map((a) =>
          a._id === action.payload._id ? { ...a, ...action.payload } : a
        );
      })
      .addCase(deleteArticleThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((a) => a._id !== action.payload);
      });
  },
});

export const { setPipelineProgress, clearCurrent } = articleSlice.actions;
export default articleSlice.reducer;