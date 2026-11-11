import noBarrelExports from './eslint-rules/no-barrel-exports.mjs';

const restrictedSyntax = [
  {
    selector: "TSAsExpression > TSAsExpression[typeAnnotation.type='TSUnknownKeyword']",
    message: 'Double assertion through unknown hides a type error. Model the type or narrow it with a type guard.',
  },
  {
    selector: "TSAsExpression > TSAsExpression[typeAnnotation.type='TSAnyKeyword']",
    message: 'Double assertion through any hides a type error. Model the type or narrow it with a type guard.',
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'Do not read the wall clock directly. Use the project clock so the code stays testable.',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Do not read the wall clock directly. Use the project clock so the code stays testable.',
  },
  {
    selector: "CallExpression[callee.property.name=/^(query|raw|\\$queryRawUnsafe|\\$executeRawUnsafe|execute)$/] > TemplateLiteral[expressions.length>0]",
    message: 'SQL built from a template string. Use parameters; escape LIKE wildcards in user input.',
  },
];

const sourceFiles = ['**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'];
const testFiles = ['**/*.{test,spec}.{ts,tsx,js,jsx,mts,mjs}', '**/__tests__/**'];
const commandLineFiles = ['scripts/**', 'bin/**'];

const aiSlopConfig = [
  {
    files: sourceFiles,
    plugins: { 'ai-kit': { rules: { 'no-barrel-exports': noBarrelExports } } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' }],
      'no-debugger': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      'ai-kit/no-barrel-exports': 'error',
    },
  },
  {
    files: sourceFiles,
    ignores: [...testFiles, ...commandLineFiles],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': ['error', ...restrictedSyntax],
    },
  },
];

export const typedRulesConfig = {
  files: ['**/*.{ts,tsx,mts,cts}'],
  languageOptions: { parserOptions: { projectService: true } },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
  },
};

export default aiSlopConfig;
