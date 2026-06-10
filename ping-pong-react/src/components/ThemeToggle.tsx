import { IconMoon, IconSun } from '@tabler/icons-react'
import { useTheme } from '../hooks/useTheme'

interface Props {
  className?: string
}

export default function ThemeToggle({ className }: Props) {
  const { theme, setTheme } = useTheme()

  return (
    <div className={`theme-toggle${className ? ` ${className}` : ''}`}>
      <button
        className={theme === 'light' ? 'active' : ''}
        onClick={() => setTheme('light')}
        aria-label="Thème clair"
        title="Thème clair"
      >
        <IconSun size={16} stroke={1.8} />
      </button>
      <button
        className={theme === 'dark' ? 'active' : ''}
        onClick={() => setTheme('dark')}
        aria-label="Thème sombre"
        title="Thème sombre"
      >
        <IconMoon size={16} stroke={1.8} />
      </button>
    </div>
  )
}
