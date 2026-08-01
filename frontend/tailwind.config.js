/** «Стальной коридор» — палитра из предпроектного анализа.
 *  Графит-сталь + морской акцент (каспийское плечо), светлая база.
 *  Семантика зон дальтоник-безопасна (не только цветом — + иконки/подписи).
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        graphite: { DEFAULT: '#1E2A32', 2: '#26343d', 3: '#33454f' },
        steel: { DEFAULT: '#5b6b76', light: '#8a99a3', faint: '#aeb9bf' },
        base: { DEFAULT: '#F5F6F4', card: '#ffffff', 2: '#eef0ee' },
        line: { DEFAULT: '#dfe3e2', strong: '#c7cece' },
        sea: { DEFAULT: '#2E7D8A', deep: '#24626c', soft: '#e6f0f1' },
        // семантика зон
        amber: { DEFAULT: '#D98A2B', soft: '#fbf1e2' },   // застряло
        grass: { DEFAULT: '#3E8E5A', soft: '#e9f2ec' },   // доставлено/маржа+
        brick: { DEFAULT: '#b5473d', soft: '#f7e9e7' },   // просрочка
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { card: '12px', chip: '8px' },
      boxShadow: {
        card: '0 1px 3px rgba(30,42,50,0.06), 0 1px 2px rgba(30,42,50,0.04)',
        pop: '0 8px 28px rgba(30,42,50,0.14)',
      },
    },
  },
  plugins: [],
}
