/**
 * Custom Metro transformer for .sql files.
 *
 * Drizzle's expo-sqlite migrator imports .sql files directly
 * (e.g. `import m0000 from './0000_yummy_corsair.sql'`).
 * Without this transformer Metro tries to parse SQL as JavaScript,
 * which throws a SyntaxError. This transformer wraps the raw SQL
 * string in a JS module export before Babel sees it.
 */

const upstreamTransformer = require('@expo/metro-config/build/babel-transformer');

module.exports.transform = function ({ src, filename, options }) {
  if (filename.endsWith('.sql')) {
    return upstreamTransformer.transform({
      src: `export default ${JSON.stringify(src)};`,
      filename,
      options,
    });
  }
  return upstreamTransformer.transform({ src, filename, options });
};
