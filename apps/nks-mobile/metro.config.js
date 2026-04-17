const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const monorepoRoot = path.resolve(__dirname, "../..");

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve .sql files — required by drizzle-orm/expo-sqlite/migrator.
// Without this, imports like `import m0000 from './0000_yummy_corsair.sql'` fail at bundle time.
config.resolver.sourceExts.push("sql");

// Transform .sql files into JS string exports before Babel parses them.
// Without this, Babel throws SyntaxError because SQL is not valid JavaScript.
config.transformer.babelTransformerPath = require.resolve(
  "./drizzle-sql-transformer.js",
);

// Watch all packages in the monorepo so Metro picks up changes in libs
config.watchFolders = [monorepoRoot];

// Resolve workspace packages from both local and monorepo node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Map @nks/* aliases to their source directories — mirrors tsconfig.json paths
config.resolver.extraNodeModules = {
  "@nks/api-manager": path.resolve(monorepoRoot, "libs-common/api-manager/src"),
  "@nks/state-manager": path.resolve(
    monorepoRoot,
    "libs-common/state-manager/src",
  ),
  "@nks/shared-types": path.resolve(
    monorepoRoot,
    "libs-common/shared-types/src",
  ),
  "@nks/utils": path.resolve(monorepoRoot, "libs-common/utils/src"),
  "@nks/common-i18n": path.resolve(monorepoRoot, "libs-common/i18n/src"),
  "@nks/local-db": path.resolve(monorepoRoot, "libs-mobile/local-db/src"),
  "@nks/mobile-theme": path.resolve(
    monorepoRoot,
    "libs-mobile/mobile-theme/src",
  ),
  "@nks/mobile-ui-components": path.resolve(
    monorepoRoot,
    "libs-mobile/mobile-ui-components/src",
  ),
  "@nks/mobile-utils": path.resolve(
    monorepoRoot,
    "libs-mobile/mobile-utils/src",
  ),
  "@nks/mobile-i18n": path.resolve(monorepoRoot, "libs-mobile/mobile-i18n/src"),
};

module.exports = config;
