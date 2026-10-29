/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ems: {
          dark: "#0b0f19",
          card: "#111827",
          border: "#1f293d",
          accent: "#0ea5e9",
          red: "#ef4444",
          amber: "#f59e0b",
          green: "#10b981",
          cyan: "#06b6d4",
          muted: "#94a3b8"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
