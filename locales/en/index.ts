/**
 * English is the source language. Each area of the app has one file here.
 * The translations are in `locales/<code>.json`.
 */
import core from './core';
import platform from './platform';
import rooms from './rooms';
import roster from './roster';
import structure from './structure';
import witness from './witness';
import rights from './rights';
import family from './family';
import photo from './photo';
import sheet from './sheet';
import infoPages from './infoPages';
import lock from './lock';

const en = { ...core, ...platform, ...rooms, ...roster, ...structure, ...witness, ...rights, ...family, ...photo, ...sheet, ...infoPages, ...lock } as const;

export default en;
