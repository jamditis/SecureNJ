/**
 * English is the source language. Each area of the app has one file here.
 * `locales/es/` has a file with the same name and the same keys.
 */
import core from './core';
import platform from './platform';
import roster from './roster';

const en = { ...core, ...platform, ...roster } as const;

export default en;
