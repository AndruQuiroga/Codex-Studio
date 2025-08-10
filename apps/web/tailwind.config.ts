import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      typography: ({ theme }) => ({
        invert: {
          css: {
            '--tw-prose-pre-bg': theme('colors.zinc.900'),
          },
        },
      }),
    },
  },
  plugins: [typography],
}
export default config
