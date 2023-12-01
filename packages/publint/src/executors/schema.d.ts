import type { Options } from 'publint';

export interface PublintExecutorSchema {
  buildTarget?: string;
  buildOutputPath?: string;
  level: Options['level'];
  strict: boolean;
}
