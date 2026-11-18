/** Spanish. Each file has the same keys as the file with the same name in `locales/en/`. */
import type { Messages } from '../../services/i18n';
import core from './core';
import platform from './platform';

const es: Messages = { ...core, ...platform };

export default es;
