import {
  ExecutorContext,
  getPackageManagerCommand,
  parseTargetString,
  readTargetOptions,
  workspaceRoot,
} from '@nx/devkit';
import { resolve } from 'path';

import { PublintExecutorSchema } from './schema';

// HACK: For importing ESM — Nx executors are CJS, see https://github.com/TypeStrong/ts-node/discussions/1290#discussion-3301697 and https://github.com/nrwl/nx/issues/15682
const dynamicImport = new Function('specifier', 'return import(specifier)');

// inspired by @nx/web:file-server `getBuildTargetOutputPath`, see https://github.com/nrwl/nx/blob/51c039b2520673b9b1b0a3ab9d8427cef7782412/packages/web/src/executors/file-server/file-server.impl.ts#L75
function getBuildTargetOutputPath(
  options: PublintExecutorSchema,
  context: ExecutorContext
) {
  if (options.buildOutputPath) {
    return options.buildOutputPath;
  }

  let outputPath: string;
  try {
    const target = parseTargetString(options.buildTarget, context);
    const buildOptions = readTargetOptions(target, context);
    if (buildOptions?.outputPath) {
      outputPath = buildOptions.outputPath;
    } else {
      const project = context.projectGraph.nodes[context.projectName];
      const buildTarget = project.data.targets[target.target];
      outputPath = buildTarget.outputs?.[0];
    }
  } catch (e) {
    throw new Error(`Invalid buildTarget: ${options.buildTarget}`);
  }

  if (!outputPath) {
    throw new Error(
      `Unable to get the outputPath from buildTarget ${options.buildTarget}. Make sure ${options.buildTarget} has an outputPath property or manually provide a buildOutputPath property`
    );
  }

  return outputPath;
}

export default async function runExecutor(
  options: PublintExecutorSchema,
  context: ExecutorContext
) {
  if (!options.buildTarget && !options.buildOutputPath) {
    throw new Error("You must set either 'buildTarget' or 'buildOutputPath'.");
  }

  const { execa } = (await dynamicImport('execa')) as typeof import('execa');

  const pmc = getPackageManagerCommand();

  const outputPath = getBuildTargetOutputPath(options, context);

  const pkgDir = resolve(workspaceRoot, outputPath);
  const { level, strict } = options;

  // NOTE(try/catch) as to not display ugly "Command failed with exit code 1: npx publint..." as error cause
  try {
    await execa(
      `${pmc.exec} publint ${pkgDir} --level ${level} --strict ${strict}`,
      {
        stdio: 'inherit',
        cwd: workspaceRoot,
        shell: true,
      }
    );
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(e);
    }

    return {
      success: false,
    };
  }

  return {
    success: true,
  };
}
