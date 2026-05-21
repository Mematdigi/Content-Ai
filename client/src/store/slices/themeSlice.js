import { createSlice } from '@reduxjs/toolkit';

// Pick the user's last choice, falling back to the OS preference.
const persisted = localStorage.getItem('cf_theme');
const prefersDark =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const initial = persisted || (prefersDark ? 'dark' : 'light');

const themeSlice = createSlice({
  name: 'theme',
  initialState: { mode: initial, sidebarCollapsed: false, mobileSidebarOpen: false },
  reducers: {
    toggleTheme(state) {
      state.mode = state.mode === 'dark' ? 'light' : 'dark';
      localStorage.setItem('cf_theme', state.mode);
    },
    setTheme(state, action) {
      state.mode = action.payload;
      localStorage.setItem('cf_theme', state.mode);
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    toggleMobileSidebar(state) {
      state.mobileSidebarOpen = !state.mobileSidebarOpen;
    },
    closeMobileSidebar(state) {
      state.mobileSidebarOpen = false;
    },
  },
});

export const { toggleTheme, setTheme, toggleSidebar, toggleMobileSidebar, closeMobileSidebar } =
  themeSlice.actions;
export default themeSlice.reducer;
