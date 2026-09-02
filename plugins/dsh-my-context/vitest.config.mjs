import { defineConfig } from 'vitest/config'
import root from '../../vitest.config.mjs'

export default defineConfig({
  ...root,
  test: {
    ...root.test,
    include: ['test/*.mjs'],
    coverage: {
      ...root.test.coverage,
      include: [
        'lib/index.js',
        'lib/constants.js',
        'lib/fence.js',
        'lib/meter.js',
        'lib/state.js',
        'lib/store.js',
        'lib/persist.js',
        'lib/budget.js',
        'lib/overflow.js',
        'lib/events.js',
        'lib/routes.js',
      ],
    },
  },
})
