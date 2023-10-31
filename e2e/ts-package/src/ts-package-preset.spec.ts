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

        const { stdout } = await runCommandAsync(`${exec} publint ${distPath}`);

        expect(stdout).toContain('All good!');
      });
    });

    describe('lint', () => {
      it('should be linted with eslint', async () => {
        expect(projectConfiguration.targets.lint).toBeDefined();
        expect(projectConfiguration.targets.lint.executor).toBe(
          '@nx/eslint:lint'
        );
      });

      it('should have passing lint', async () => {
        await runNxCommandAsync('lint');
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
    `npx --yes create-nx-workspace@latest proj --preset @gvrs-nx/ts-package --no-nxCloud --no-interactive ${args} --verbose`,
    {
      cwd: dirname(tmpProjPath()),
      env: process.env,
    }
  );

  console.log(`Created test project in "${tmpProjPath()}"`);

  return createWorkspaceOutput;
};
