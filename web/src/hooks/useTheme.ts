import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,
      toggleTheme: () => set((state) => {
        const newDark = !state.isDark;
        updateDocumentClass(newDark);
        return { isDark: newDark };
      }),
      setTheme: (dark: boolean) => set(() => {
        updateDocumentClass(dark);
        return { isDark: dark };
      }),
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          updateDocumentClass(state.isDark);
        }
      },
    }
  )
);

function updateDocumentClass(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Initialize theme on load
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('theme-storage');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      updateDocumentClass(state?.isDark ?? false);
    } catch {
      updateDocumentClass(false);
    }
  }
}
