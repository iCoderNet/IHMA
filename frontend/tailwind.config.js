/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease both',
        'slide-in': 'slide-in 0.3s ease both',
        'count-up': 'count-up 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        ihma_light: {
          primary: '#1C3461',
          'primary-content': '#FFFFFF',
          secondary: '#4F79E0',
          'secondary-content': '#FFFFFF',
          accent: '#0CBFA0',
          'accent-content': '#FFFFFF',
          neutral: '#2D3A55',
          'neutral-content': '#FFFFFF',
          'base-100': '#FFFFFF',
          'base-200': '#EEF1FA',
          'base-300': '#DDE3F2',
          'base-content': '#0F1629',
          info: '#3B9EE8',
          success: '#0CBFA0',
          warning: '#F0A020',
          error: '#E8385A',
        },
        ihma_dark: {
          primary: '#4F79E0',
          'primary-content': '#FFFFFF',
          secondary: '#7BA3F5',
          'secondary-content': '#080C18',
          accent: '#0CBFA0',
          'accent-content': '#080C18',
          neutral: '#182035',
          'neutral-content': '#B8C8E8',
          'base-100': '#0E1525',
          'base-200': '#080C18',
          'base-300': '#182035',
          'base-content': '#E2E8F8',
          info: '#3B9EE8',
          success: '#0CBFA0',
          warning: '#F0A020',
          error: '#F0486A',
        },
      },
    ],
    darkTheme: 'ihma_dark',
    base: true,
    styled: true,
    utils: true,
  },
}
