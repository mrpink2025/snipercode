import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useEffect } from 'react';

export const ThemeToggle = () => {
  const { darkMode, toggleDarkMode } = useAppStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleDarkMode}
      className="h-8 w-8 p-0"
    >
      {darkMode ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
};