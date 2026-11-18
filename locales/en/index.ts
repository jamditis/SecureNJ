/**
 * English is the source language. Each area of the app has one file here.
 * `locales/es/` has a file with the same name and the same keys.
 */
import core from './core';
import platform from './platform';
import roster from './roster';
import structure from './structure';
import witness from './witness';
import rights from './rights';
import family from './family';
import photo from './photo';
import sheet from './sheet';
import infoPages from './infoPages';

const en = { ...core, ...platform, ...roster, ...structure, ...witness, ...rights, ...family, ...photo, ...sheet, ...infoPages } as const;

export default en;
