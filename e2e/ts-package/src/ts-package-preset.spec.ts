import { dirname } from 'path';
import { mkdirp } from 'fs-extra';
import {
  ProjectConfiguration,
  detectPackageManager,
  getPackageManagerCommand,
} from '@nx/devkit';
import {
  tmpProjPath,
  readJson,
  runNxCommandAsync,
  fileExists,
  directoryExists,
  runCommandAsync,
  cleanup,
  readFile,
} from '@nx/plugin/testing';

describe('ts-package preset', () => {
  describe('default options', () => {
    let projectConfiguration: ProjectConfiguration;
    let createNxWorkspaceOutput: Awaited<ReturnType<typeof runNxCommandAsync>>;

    beforeAll(async () => {
      createNxWorkspaceOutput = await createTestProject();

      projectConfiguration = readJson<ProjectConfiguration>('project.json');
    });

    afterAll(() => {
      cleanup();
    });

    describe('generation', () => {
      it('should log note to run prepare', () => {
        const { stdout } = createNxWorkspaceOutput;

        expect(stdout).toEqual(
          expect.stringContaining('To enable Husky, run:')
        );
        expect(stdout).toEqual(expect.stringContaining('npm run prepare'));
      });
    });

    describe('build', () => {
      it('should be built with rollup', async () => {
        expect(projectConfiguration.targets.build).toBeDefined();
        expect(projectConfiguration.targets.build.executor).toBe(
          '@nx/rollup:rollup'
        );
      });

      it('should add rollup config', async () => {
        const rollupConfig = 'rollup.config.js';

        expect(projectConfiguration.targets.build.options.rollupConfig).toBe(
          rollupConfig
        );

        fileExists(rollupConfig);
      });

      it('should build', async () => {
        const { stderr: buildStderr } = await runNxCommandAsync('build');

        expect(buildStderr).toBe('');

        const builtPackageJsonPath = tmpProjPath(
          `${projectConfiguration.targets.build.options.outputPath}/package.json`
        );

        fileExists(builtPackageJsonPath);
      });

      it('should pass publint', async () => {
        const distPath = tmpProjPath(
          projectConfiguration.targets.build.options.outputPath
        );

        directoryExists(distPath);

        const { exec } = getPackageManagerCommand(
          detectPackageManager(tmpProjPath()),
          tmpProjPath()
        );

        // TODO: re-enable suggestions when https://github.com/nrwl/nx/issues/20009 is fixed and `package.json` `type` can be added back
        const { stdout } = await runCommandAsync(
          `${exec} publint ${distPath} --level warning --strict`
        );

        expect(stdout).toContain('All good!');
      });
    });

    describe('eslint', () => {
      it('should be linted with eslint', async () => {
        expect(projectConfiguration.targets.lint).toBeDefined();
        expect(projectConfiguration.targets.lint.executor).toBe(
          '@nx/eslint:lint'
        );
      });

      it('should pass lint', async () => {
        await runNxCommandAsync('lint');
      });
    });

    describe('commitlint', () => {
      it('should have commit-msg hook with commitlint', () => {
        const hookPath = tmpProjPath('.husky/commit-msg');

        fileExists(hookPath);

        expect(readFile(hookPath)).toEqual(
          expect.stringContaining('commitlint --edit "$1"')
        );
      });

      it('should have .commitlintrc.json with config-conventional', () => {
        const configPath = tmpProjPath('.commitlintrc.json');

        fileExists(configPath);

        expect(readJson(configPath)).toEqual({
          extends: ['@commitlint/config-conventional'],
          rules: {},
        });
      });
    });

    describe('test', () => {
      it('should be tested with vitest', async () => {
        expect(projectConfiguration.targets.test).toBeDefined();
        expect(projectConfiguration.targets.test.executor).toBe(
          '@nx/vite:test'
        );
      });

      it('should have passing tests', async () => {
        await runNxCommandAsync('test');
      });
    });

    describe('deploy', () => {
      it('should be deployed with ngx-deploy-npm', async () => {
        expect(projectConfiguration.targets.deploy).toBeDefined();
        expect(projectConfiguration.targets.deploy.executor).toBe(
          'ngx-deploy-npm:deploy'
        );
      });
    });
  });
});

const createTestProject = async (args = '') => {
  cleanup();

  await mkdirp(dirname(tmpProjPath()));

  // do not attempt to install husky, which would fail
  // since the tmp proj path is a dir nested inside a git repo
  process.env.HUSKY = '0';

  const createWorkspaceOutput = await runCommandAsync(
    `npx --yes create-nx-workspace@latest proj --preset @gvrs-nx/ts-package --presetVersion 0.0.0-e2e --no-nxCloud --no-interactive ${args} --verbose`,
    {
      cwd: dirname(tmpProjPath()),
      env: process.env,
    }
  );

  console.log(`Created test project in "${tmpProjPath()}"`);

  return createWorkspaceOutput;
};
