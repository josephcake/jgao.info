import data from '../../assets/data/tuning.json';

/** All gameplay numbers. Source of truth is `assets/data/tuning.json`. */
export type Tuning = typeof data;
export const T: Tuning = data;
