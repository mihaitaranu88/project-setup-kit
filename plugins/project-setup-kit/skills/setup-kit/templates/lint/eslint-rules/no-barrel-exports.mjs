const INDEX_FILE = /(^|\/)index\.(ts|tsx|js|jsx|mts|mjs)$/;

const isReExport = statement =>
  statement.type === 'ExportAllDeclaration' ||
  (statement.type === 'ExportNamedDeclaration' && statement.source !== null);

const noBarrelExports = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow index files that only re-export other modules' },
    messages: {
      noBarrel: 'This index file only re-exports other modules. Import the concrete module directly instead.',
    },
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(/\\/g, '/');
    const allowed = context.options[0]?.allow ?? [];
    if (!INDEX_FILE.test(filename) || allowed.some(path => filename.includes(path))) return {};
    return {
      'Program:exit'(node) {
        if (node.body.length > 0 && node.body.every(isReExport)) {
          context.report({ node: node.body[0], messageId: 'noBarrel' });
        }
      },
    };
  },
};

export default noBarrelExports;
