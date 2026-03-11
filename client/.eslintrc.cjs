module.exports = {
  root: true,
  ignorePatterns: ['dist/**'],
  env: {
    browser: true,
    es2022: true
  },
  extends: ['eslint:recommended', 'plugin:vue/vue3-essential'],
  parser: 'vue-eslint-parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['vue'],
  rules: {
    'vue/multi-word-component-names': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-empty': 'warn',
    'no-case-declarations': 'warn',
    'no-undef': 'warn',
    'no-dupe-keys': 'warn',
    'no-useless-catch': 'warn'
  }
};
