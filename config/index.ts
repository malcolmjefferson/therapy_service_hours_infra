import { devConfig } from './dev';
import { prodConfig } from './prod';
import { EnvConfig, EnvName } from './types';

export * from './types';
export { RELEASE } from './release';
export { devConfig, prodConfig };

/** All environments, in promotion order (dev first). */
export const ENVIRONMENTS: Readonly<Record<EnvName, EnvConfig>> = {
  dev: devConfig,
  prod: prodConfig,
};
