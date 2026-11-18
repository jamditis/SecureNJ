/**
 * English is the source language. Each area of the app has one file here.
 * `locales/es/` has a file with the same name and the same keys.
 */
import core from './core';
import platform from './platform';

const en = { ...core, ...platform } as const;

export default en;
