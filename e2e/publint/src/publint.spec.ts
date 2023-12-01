import { exec, execSync } from 'child_process';
import { dirname } from 'path';
import {
  tmpProjPath,
  updateFile,
  runNxCommandAsync,
  cleanup,
  runCommandAsync,
} from '@nx/plugin/testing';
import {
  ProjectConfiguration,
  detectPackageManager,
  getPackageManagerCommand,
} from '@nx/devkit';
import { PackageJson } from 'nx/src/utils/package-json';

const updateJson =
  <T>(path: string) =>
  (updater: (prev: T) => T) => {
    updateFile(path, (contents: string) => {
      const prev = JSON.parse(contents) as T;

      return JSON.stringify(updater(prev), null, 2);
    });
  };

const updateLibProjectConfiguration =
  updateJson<ProjectConfiguration>('lib/project.json');

const updateLibPackageJson = updateJson<PackageJson>('lib/package.json');

const setPublintOptions = (options: Record<string, unknown>) => {
  updateLibProjectConfiguration((prev) => {
    prev.targets.publint.options = options;

    return prev;
  });
};

function runFailingNxCommandAsync(
  command: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const pmc = getPackageManagerCommand(detectPackageManager(tmpProjPath()));

    exec(
      `${pmc.exec} nx ${command}`,
      {
        cwd: tmpProjPath(),
        env: process.env,
      },
      (err, stdout, stderr) => {
        if (!err) {
          fail(`nx command ${command} should have failed, but it did not`);
        }

        resolve({ stdout, stderr });
      }
    );
  });
}

describe('publint', () => {
  beforeAll(async () => {
    await createTestProject();

    execSync(`npm install @gvrs-nx/publint@0.0.0-e2e`, {
      cwd: tmpProjPath(),
      stdio: 'inherit',
      env: process.env,
    });

    updateLibProjectConfiguration((prev) => {
      prev.targets.publint = {
        executor: '@gvrs-nx/publint:publint',
        dependsOn: ['build'],
      };

      return prev;
    });
  });

  afterAll(() => {
    cleanup();
  });

  it('should be installed', async () => {
    // npm ls will fail if the package is not installed properly
    runCommandAsync('npm ls @gvrs-nx/publint');
  });

  describe('build output path', () => {
    it('should use buildOutputPath', async () => {
      setPublintOptions({ buildOutputPath: 'dist/lib' });

      const { stdout } = await runNxCommandAsync('run lib:publint');

      expect(stdout).toEqual(expect.stringContaining('All good!'));
    });

    it('should use outputPath of buildTarget', async () => {
      setPublintOptions({ buildTarget: 'build' });

      const { stdout } = await runNxCommandAsync('run lib:publint');

      expect(stdout).toEqual(expect.stringContaining('All good!'));
    });

    it('should fail when neither buildTarget nor buildOutputPath is provided', async () => {
      setPublintOptions({});

      const { stdout } = await runFailingNxCommandAsync('run lib:publint');

      expect(stdout).toEqual(
        expect.stringContaining(
          "You must set either 'buildTarget' or 'buildOutputPath'"
        )
      );
    });
  });

  describe('options', () => {
    beforeAll(() => {
      setPublintOptions({ buildTarget: 'build' });
    });

    describe('strict', () => {
      beforeEach(() => {
        updateLibPackageJson((prev) => {
          // Will trigger EXPORTS_MISSING_ROOT_ENTRYPOINT
          prev.exports = {
            './why': './src/index.js',
          };

          return prev;
        });
      });

      afterEach(() => {
        updateLibPackageJson((prev) => {
          delete prev.exports;

          return prev;
        });
      });

      it('should be true by default', async () => {
        const { stdout } = await runFailingNxCommandAsync('run lib:publint');

        expect(stdout).toEqual(expect.stringContaining('Errors:'));
      });

      it('should forward the strict option', async () => {
        setPublintOptions({ buildTarget: 'build', strict: false });

        const { stdout } = await runNxCommandAsync('run lib:publint');

        expect(stdout).not.toEqual(expect.stringContaining('Errors:'));
        expect(stdout).toEqual(expect.stringContaining('Warnings:'));
      });
    });

    describe('level', () => {
      beforeEach(() => {
        updateLibPackageJson((prev) => {
          // Will trigger USE_EXPORTS_BROWSER suggestion
          prev.exports = {
            '.': './src/index.js',
          };
          (prev as any).browser = './src/index.js';

          return prev;
        });
      });

      afterEach(() => {
        updateLibPackageJson((prev) => {
          delete prev.exports;
          delete (prev as any).browser;

          return prev;
        });
      });

      it('should be "suggestion" by default', async () => {
        const { stdout } = await runNxCommandAsync('run lib:publint');

        expect(stdout).toEqual(expect.stringContaining('Suggestions:'));
      });

      it('should forward the level option', async () => {
        setPublintOptions({ buildTarget: 'build', level: 'warning' });

        const { stdout } = await runNxCommandAsync('run lib:publint');

        expect(stdout).not.toEqual(expect.stringContaining('Suggestions:'));
      });
    });
  });
});

const createTestProject = async () => {
  cleanup();

  await runCommandAsync(
    `npx --yes create-nx-workspace@latest proj --preset ts --no-nxCloud --no-interactive`,
    {
      cwd: dirname(tmpProjPath()),
    }
  );

  await runNxCommandAsync(
    'g @nx/js:library lib --unitTestRunner none --bundler tsc'
  );

  console.log(
    `Created test project in "${tmpProjPath()}" and library in "${tmpProjPath(
      'lib'
    )}"`
  );
};
