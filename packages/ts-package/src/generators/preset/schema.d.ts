export type Bundler = 'tsc' | 'swc';

export interface PresetGeneratorSchema {
  name: string;
  npmScope: string;
  defaultBase: string;
}
