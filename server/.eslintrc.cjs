module.exports = {
  root: true,
  ignorePatterns: ['dist/**', 'photos/**', 'public/**'],
  env: {
    node: true,
    es2022: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script'
  },
  rules: {
    'no-empty': ['warn'],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-useless-catch': ['warn'],
    'no-useless-escape': ['warn']
  }
};
