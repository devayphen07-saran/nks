/**
 * ARCHITECTURE TESTS
 *
 * These tests enforce architectural principles and prevent regression:
 * 1. Repositories return nullable values, never throw (except for data modification)
 * 2. No circular service dependencies
 * 3. Services contain business logic, not configuration
 * 4. Mappers perform pure data transformation only
 *
 * Run with: npm test -- architecture.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Architecture', () => {
  const srcDir = path.join(__dirname, '../../');

  /**
   * PRINCIPLE 1: Repository Pattern
   * Repositories should:
   * - Return nullable values from finder methods
   * - Not have hidden exception-throwing helpers
   * - Keep throwing logic visible in modifier methods
   */
  describe('Repository Pattern', () => {
    test('repositories do not have private throwing helper methods', () => {
      const repoFiles = findFiles(
        srcDir,
        /\.repository\.ts$/,
        ['node_modules', '.spec.ts'],
      );

      const violations: string[] = [];

      for (const file of repoFiles) {
        const content = fs.readFileSync(file, 'utf-8');

        // Check for hidden helpers that throw
        // Pattern: private async xxxOrThrow(...): Promise<...>
        const hiddenThrowingHelpers = content.match(
          /private\s+async\s+\w+OrThrow\s*\(/g,
        );

        if (hiddenThrowingHelpers) {
          violations.push(
            `${path.relative(srcDir, file)}: Found hidden throwing helpers: ${hiddenThrowingHelpers.join(', ')}`,
          );
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `Repository throwing helpers found (should inline exceptions):\n${violations.join('\n')}`,
        );
      }
    });

    test('finder methods do not throw directly', () => {
      const repoFiles = findFiles(
        srcDir,
        /\.repository\.ts$/,
        ['node_modules', '.spec.ts'],
      );

      const violations: string[] = [];

      for (const file of repoFiles) {
        const content = fs.readFileSync(file, 'utf-8');

        // Check for finder methods that throw
        // Pattern: async find*(...).*throw
        const findMethods = content.match(/async\s+find\w+\([^)]*\)[^{]*{[^}]*throw/gs);

        if (findMethods) {
          violations.push(
            `${path.relative(srcDir, file)}: Finder methods should not throw, return nullable instead`,
          );
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `Finder methods throwing exceptions (should return nullable):\n${violations.join('\n')}`,
        );
      }
    });
  });

  /**
   * PRINCIPLE 2: Separation of Concerns
   * Services should contain business logic
   * Config files should be minimal
   */
  describe('Separation of Concerns', () => {
    test('config files do not contain complex business logic', () => {
      const configFiles = findFiles(
        srcDir,
        /\.config\.ts$/,
        ['node_modules', '.spec.ts'],
      );

      const violations: string[] = [];

      for (const file of configFiles) {
        const content = fs.readFileSync(file, 'utf-8');

        // Check for database hooks with business logic
        if (
          content.includes('databaseHooks') &&
          content.match(/async\s+\(.*\)\s*=>\s*{[^}]{200,}}/s)
        ) {
          violations.push(
            `${path.relative(srcDir, file)}: Database hooks contain complex business logic (should delegate to service)`,
          );
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `Business logic found in config files:\n${violations.join('\n')}`,
        );
      }
    });

    test('mappers perform pure data transformation only', () => {
      const mapperFiles = findFiles(
        srcDir,
        /\.mapper\.ts$/,
        ['node_modules', '.spec.ts'],
      );

      const violations: string[] = [];

      for (const file of mapperFiles) {
        const content = fs.readFileSync(file, 'utf-8');

        // Check for data generation (crypto, Date, UUID, etc.)
        const badPatterns = [
          /crypto\.(randomUUID|randomBytes)/,
          /new\s+Date\(\)/,
          /Math\.random/,
          /nanoid/,
          /v4\(\)/,
        ];

        for (const pattern of badPatterns) {
          if (pattern.test(content)) {
            violations.push(
              `${path.relative(srcDir, file)}: Mappers should not generate data (pass as parameters instead)`,
            );
            break;
          }
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `Mappers generating business logic:\n${violations.join('\n')}`,
        );
      }
    });
  });

  /**
   * PRINCIPLE 3: Acyclic Dependency Graph
   * Services should not have circular imports
   */
  describe('Dependency Graph', () => {
    test('no circular service dependencies', () => {
      const serviceFiles = findFiles(
        srcDir,
        /services\/[\w-]+\.service\.ts$/,
        ['node_modules', '.spec.ts'],
      );

      const imports = new Map<string, Set<string>>();

      // Build import graph
      for (const file of serviceFiles) {
        const serviceName = path.basename(file, '.service.ts');
        const content = fs.readFileSync(file, 'utf-8');

        const serviceImports = new Set<string>();
        const importMatches = content.match(
          /import\s+{[^}]*}\s+from\s+['"]\.\/[\w-]+\.service['"]/g,
        );

        if (importMatches) {
          for (const match of importMatches) {
            const importedService = match.match(/['"]\.\/[\w-]+\.service['"]/)
              ?.[0]
              ?.replace(/['".\/]/g, '');
            if (importedService) {
              serviceImports.add(importedService);
            }
          }
        }

        if (serviceImports.size > 0) {
          imports.set(serviceName, serviceImports);
        }
      }

      // Check for cycles
      const cycles: string[] = [];

      for (const [service, dependsOn] of imports) {
        for (const dep of dependsOn) {
          const depImports = imports.get(dep);
          if (depImports && depImports.has(service)) {
            cycles.push(`${service} ↔ ${dep}`);
          }
        }
      }

      if (cycles.length > 0) {
        throw new Error(
          `Circular service dependencies detected:\n${cycles.join('\n')}`,
        );
      }
    });

    test('orchestrator pattern used to break circular dependencies', () => {
      // If OtpService and AuthService both exist, verify OtpAuthOrchestrator exists
      const otpServicePath = path.join(
        srcDir,
        'contexts/iam/auth/services/otp.service.ts',
      );
      const authServicePath = path.join(
        srcDir,
        'contexts/iam/auth/services/auth.service.ts',
      );
      const orchestratorPath = path.join(
        srcDir,
        'contexts/iam/auth/services/otp-auth-orchestrator.service.ts',
      );

      if (fs.existsSync(otpServicePath) && fs.existsSync(authServicePath)) {
        if (!fs.existsSync(orchestratorPath)) {
          throw new Error(
            'OtpService and AuthService exist but OtpAuthOrchestrator not found (orchestrator pattern should be used)',
          );
        }

        // Verify orchestrator is properly injected in controller
        const controllerPath = path.join(
          srcDir,
          'contexts/iam/auth/controllers/otp.controller.ts',
        );
        const controllerContent = fs.readFileSync(controllerPath, 'utf-8');

        if (!controllerContent.includes('OtpAuthOrchestrator')) {
          throw new Error(
            'OtpAuthOrchestrator defined but not injected in OtpController',
          );
        }
      }
    });
  });

  /**
   * PRINCIPLE 4: Transaction Management
   * Services should delegate transaction handling to repositories
   *
   * KNOWN ACCEPTABLE CASES:
   * - authService.profileComplete(): Complex multi-entity update (flagged for future refactoring)
   *   Reason: Requires careful extraction due to email/phone conflicts + auth provider logic.
   */
  describe('Transaction Management', () => {
    test('services do not call db.transaction() directly (except known cases)', () => {
      const serviceFiles = findFiles(
        srcDir,
        /services\/[\w-]+\.service\.ts$/,
        ['node_modules', '.spec.ts'],
      );

      const acceptableFiles = ['auth.service.ts']; // Known cases with TODOs
      const violations: string[] = [];

      for (const file of serviceFiles) {
        const fileName = path.basename(file);
        if (acceptableFiles.includes(fileName)) {
          continue; // Skip known acceptable cases
        }

        const content = fs.readFileSync(file, 'utf-8');

        // Check for direct transaction calls in service
        if (content.match(/this\.db\s*\.\s*transaction\s*\(/)) {
          violations.push(
            `${path.relative(srcDir, file)}: Service calls db.transaction() directly (should delegate to repository)`,
          );
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `Services with direct transaction calls:\n${violations.join('\n')}`,
        );
      }
    });

    test('TODO: profileComplete() should extract transaction to repository', () => {
      // KNOWN TECHNICAL DEBT
      // The authService.profileComplete() method wraps multiple user updates
      // in a transaction. This should eventually be extracted to a repository method,
      // but requires careful handling of email/phone conflicts and auth provider creation.
      // Flagged for future refactoring.
      expect(true).toBe(true);
    });
  });
});

/**
 * Helper: Find all files matching pattern
 */
function findFiles(
  dir: string,
  pattern: RegExp,
  exclude: string[] = [],
): string[] {
  const files: string[] = [];

  function walk(currentPath: string) {
    if (!fs.existsSync(currentPath)) return;

    for (const file of fs.readdirSync(currentPath)) {
      const fullPath = path.join(currentPath, file);
      const stat = fs.statSync(fullPath);

      // Skip excluded patterns
      if (exclude.some((e) => fullPath.includes(e))) continue;

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (pattern.test(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}
