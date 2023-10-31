import {
  formatFiles,
  Tree,
  runTasksInSerial,
  GeneratorCallback,
  Generator,
  removeDependenciesFromPackageJson,
  updateProjectConfiguration,
  updateNxJson,
  readNxJson,
  readProjectConfiguration,
  addDependenciesToPackageJson,
  updateJson,
  detectPackageManager,
} from '@nx/devkit';
import { libraryGenerator } from '@nx/js';
import { tsLibVersion } from '@nx/js/src/utils/versions';
import { updateOverrideInLintConfig } from '@nx/eslint/src/generators/utils/eslint-file';
import semverInstallGenerator from '@jscutlery/semver/src/generators/install';
import { PackageJson } from 'nx/src/utils/package-json';
import { output } from 'nx/src/utils/output';
import installNgxDeployGenerator from 'ngx-deploy-npm/src/generators/install/generator';
import chalk from 'chalk';
import type { Linter } from 'eslint';

import { PresetGeneratorSchema } from './schema';

interface NormalizedSchema extends PresetGeneratorSchema {
  importPath: string;
}

const normalizeOptions = (schema: PresetGeneratorSchema): NormalizedSchema => {
  const importPath = schema.npmScope
    ? `@${schema.npmScope}/${schema.name}`
    : schema.name;

  return { ...schema, importPath } as NormalizedSchema;
};

/**
 * Nx does recognize that `@nx/js:swc` needs to have `@swc/helpers` as a dep,
 * but does not do so for `@nx/rollup:rollup` with the `compiler: swc`
 */
const addSwcHelpersToAllowedDeps = (tree: Tree, options: NormalizedSchema) => {
  const dependencyChecksRuleName = '@nx/dependency-checks';

  const projectConfiguration = readProjectConfiguration(tree, options.name);

  updateOverrideInLintConfig(
    tree,
    projectConfiguration.root,
    (o) => !!o.rules?.[dependencyChecksRuleName],
    (o) => {
      const value = o.rules[dependencyChecksRuleName];
      let ruleSeverity: Linter.RuleLevel;
      let ruleOptions: Record<string, unknown>;
      if (Array.isArray(value)) {
        [ruleSeverity, ruleOptions] = value;
      } else {
        ruleSeverity = value;
        ruleOptions = {};
      }

      ruleOptions.ignoredDependencies ??= [];
      (ruleOptions.ignoredDependencies as string[]).push('@swc/helpers');

      o.rules[dependencyChecksRuleName] = [ruleSeverity, ruleOptions];

      return o;
    }
  );
};

const addMjsToJsEslintOverride = (tree: Tree, options: NormalizedSchema) => {
  const projectConfiguration = readProjectConfiguration(tree, options.name);

  updateOverrideInLintConfig(
    tree,
    projectConfiguration.root,
    (o) => o.files.includes('*.js'),
    (o) => {
      if (Array.isArray(o.files)) {
        o.files.push('*.mjs');
      } else {
        o.files = [o.files, '*.mjs'];
      }

      return o;
    }
  );
};

const updateTargetInputs = (tree: Tree) => {
  // do not trigger new builds on changes in tools
  // additionally, this excludes files in tools from eslint dependency-checks, see https://github.com/nrwl/nx/issues/19307#issuecomment-1748798935
  // NOTE: the pattern must start with {projectRoot}, otherwise, the task hasher fails
  const nxJson = readNxJson(tree);
  nxJson.namedInputs!.production!.push('!{projectRoot}/tools/**/*');
  updateNxJson(tree, nxJson);
};

const generatePublishableLibrary = async (
  tree: Tree,
  options: NormalizedSchema
) => {
  const { name, importPath } = options;

  const libraryGeneratorTask = await libraryGenerator(tree, {
    name,
    directory: '.',
    projectNameAndRootFormat: 'as-provided',
    bundler: 'rollup',
    unitTestRunner: 'vitest',
    testEnvironment: 'node',
    rootProject: true,
    publishable: true,
    importPath,
  });

  const projectConfiguration = readProjectConfiguration(tree, name);

  projectConfiguration.targets!.build!.options!.generateExportsField = true;

  updateProjectConfiguration(tree, name, projectConfiguration);

  updateJson(tree, 'tsconfig.json', (tsConfig) => {
    tsConfig.compilerOptions.module = 'ES2015';
    return tsConfig;
  });

  addSwcHelpersToAllowedDeps(tree, options);

  addMjsToJsEslintOverride(tree, options);

  updateTargetInputs(tree);

  const addDepsTask = addDependenciesToPackageJson(
    tree,
    {},
    {
      // rollup-plugin-typescript wants it
      tslib: tsLibVersion,
    }
  );

  return runTasksInSerial(libraryGeneratorTask, addDepsTask);
};

const moveSelfToDevDeps = async (tree: Tree) => {
  const ownPackageJson = await import('../../../package.json');

  const removeSelfFromDepsTask = removeDependenciesFromPackageJson(
    tree,
    [ownPackageJson.name],
    []
  );

  const addSelfToDevDepsTask = addDependenciesToPackageJson(
    tree,
    {},
    {
      [ownPackageJson.name]: ownPackageJson.version,
    }
  );

  return runTasksInSerial(removeSelfFromDepsTask, addSelfToDevDepsTask);
};

const addJscutlerySemver = async (tree: Tree, options: NormalizedSchema) => {
  const ownPackageJson = await import('../../../package.json');

  const { name } = options;

  const semverInstallTask = await semverInstallGenerator(tree, {
    syncVersions: false,
    projects: [name],
    enforceConventionalCommits: true,
    commitMessageFormat: 'chore: release version {version} [skip ci]',
    preset: 'conventional',
  });

  updateJson<PackageJson>(tree, 'package.json', (pkg) => {
    pkg.scripts.prepare = `node -e "if(require('fs').existsSync('.git')){/* proceed only if .git is found */ process.exit(1)}" || is-ci || husky install`;

    return pkg;
  });

  const addDepsTask = addDependenciesToPackageJson(
    tree,
    {},
    {
      '@jscutlery/semver': ownPackageJson.dependencies['@jscutlery/semver'],
      // `prepare` script
      'is-ci': '^3.0.0',
    }
  );

  const logHuskyNote = () => {
    output.log({
      title: 'Husky is not yet enabled',
      bodyLines: [
        'Nx initializes the git repo only after running the preset',
        'To enable Husky, run:',
        chalk.bold.white(`${detectPackageManager()} run prepare`),
      ],
    });
  };

  return runTasksInSerial(semverInstallTask, addDepsTask, logHuskyNote);
};

const addNgxDeploy = async (tree: Tree, options: NormalizedSchema) => {
  const { name } = options;

  await installNgxDeployGenerator(tree, { projects: [name], access: 'public' });

  // remove default publish target from @nx/js
  tree.delete('tools/scripts/publish.mjs');

  const projectConfiguration = readProjectConfiguration(tree, name);

  delete projectConfiguration.targets!.publish;

  // adjust ngx-deploy-npm configurations to publish to local registry by default
  projectConfiguration.targets.deploy.configurations = {
    local: {
      registry: 'http://localhost:4873',
    },
    npm: {
      registry: 'https://registry.npmjs.org',
    },
  };
  projectConfiguration.targets.deploy.defaultConfiguration = 'local';

  updateProjectConfiguration(tree, name, projectConfiguration);
};

export const presetGenerator: Generator<PresetGeneratorSchema> = async (
  tree: Tree,
  schema: PresetGeneratorSchema
) => {
  const options = normalizeOptions(schema);

  const tasks: GeneratorCallback[] = [];

  const generateLibraryTask = await generatePublishableLibrary(tree, options);

  tasks.push(generateLibraryTask);

  const addSemverTask = await addJscutlerySemver(tree, options);

  tasks.push(addSemverTask);

  const moveSelfToDepsTask = await moveSelfToDevDeps(tree);

  tasks.push(moveSelfToDepsTask);

  await addNgxDeploy(tree, options);

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
};

export default presetGenerator;
