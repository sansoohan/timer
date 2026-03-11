export const TimerEnv = {
  LocalDev: 'localdev',
  Dev: 'dev',
  Stage: 'stage',
  Prod: 'prod',
  Hotfix: 'hotfix',
} as const;
export type TimerEnv = typeof TimerEnv[keyof typeof TimerEnv];
