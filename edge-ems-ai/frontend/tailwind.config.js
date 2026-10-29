/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neo: {
          bg: "#faf8f2",       // Natural warm off-white canvas
          card: "#ffffff",     // Stark white card
          black: "#121826",    // Deep rich brutalist black
          yellow: "#ffe600",   // EMS High-vis Safety Yellow
          red: "#ff4d4d",      // Triage Emergency Red
          orange: "#ff914d",   // Caution / Fire Orange
          green: "#00e599",    // Safe / Verified Mint Green
          cyan: "#00d2ff",     // Medical Cyan / Airway
          purple: "#cc88ff",   // Neuro / GCS Lilac
          blue: "#3b82f6",     // Diagnostic Blue
          muted: "#64748b",    // Slate secondary
          line: "#1e293b",     // Border stroke
          darkbg: "#0c1017",   // Night mode canvas
          darkcard: "#161c28", // Night mode card
          darkborder: "#2d3748"// Night mode border
        }
      },
      boxShadow: {
        'neo-sm': '2px 2px 0px 0px #121826',
        'neo': '4px 4px 0px 0px #121826',
        'neo-lg': '6px 6px 0px 0px #121826',
        'neo-xl': '8px 8px 0px 0px #121826',
        'neo-dark-sm': '2px 2px 0px 0px #000000',
        'neo-dark': '4px 4px 0px 0px #000000',
        'neo-dark-lg': '6px 6px 0px 0px #000000',
      },
      fontFamily: {
        sans: ['Inter', 'Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
