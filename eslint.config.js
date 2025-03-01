import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  react: {
    overrides: {
      'react-refresh/only-export-components': 'off',
    },
  },
})
