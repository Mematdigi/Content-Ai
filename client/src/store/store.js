import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import articlesReducer from './slices/articleSlice';
import themeReducer from './slices/themeSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    articles: articlesReducer,
    theme: themeReducer,
  },
  devTools: {
    actionSanitizer: (action) => {
      if (action.type?.startsWith('auth/') && action.payload?.password) {
        return {
          ...action,
          payload: {
            ...action.payload,
            password: '<<MASKED>>',
          },
        };
      }
      return action;
    },
  },
});

export default store;
