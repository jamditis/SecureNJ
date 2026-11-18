/** Spanish. Each file has the same keys as the file with the same name in `locales/en/`. */
import type { Messages } from '../../services/i18n';
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

const es: Messages = { ...core, ...platform, ...rooms, ...roster, ...structure, ...witness, ...rights, ...family, ...photo, ...sheet, ...infoPages, ...lock };

export default es;
