/**
 * Spanish text for the page around the know-your-rights card. The text of the
 * card itself is in `content/rightsCard.ts`: it stays in English.
 */
import type en from '../en/rights';

const rights: Record<keyof typeof en, string> = {
  'rights.title': 'Tarjeta de derechos',
  'rights.summary': 'Una tarjeta para imprimir sobre qué hacer si agentes de inmigración llegan a tu casa, te paran o te detienen.',
  'rights.lede': 'Casi todo esto aplica sin importar tu estatus migratorio. Agrega tus números, luego imprime y recorta la tarjeta. El sitio no guarda lo que escribes.',
  'rights.notice':
    'Esta es información general de la {guide} (actualizada el 4 de agosto de 2026), no es asesoría legal. Un abogado(a) no ha revisado esta versión corta. Para todo lo que pienses repartir, usa una tarjeta oficial de la lista de abajo. Las reglas dependen de la situación y del estatus, y pueden cambiar. Por eso, pregunta a un abogado(a) de inmigración sobre tu caso.',
  'rights.notice.guide': 'guía de la ACLU',
  'rights.englishOnly': 'El texto de la tarjeta está solo en inglés. Para una tarjeta oficial en español, usa las {ilrc} o la {aclu}.',
  'rights.englishOnly.ilrc': 'tarjetas rojas del ILRC',
  'rights.englishOnly.aclu': 'guía de la ACLU en español',
  'rights.field.hotline': 'Línea de ayuda de respuesta rápida',
  'rights.hint.hotline': 'Este es el número de {name}, según la lista de {source}. Llama para confirmarlo antes de imprimirlo o compartirlo.',
  'rights.field.lawyer': 'Tu abogado(a) o grupo legal (opcional)',
  'rights.field.contact': 'Teléfono de tu contacto de emergencia (opcional)',
  'rights.hint.contact': 'No pongas un nombre si te pueden quitar la tarjeta. Trata también de memorizar estos números.',
  'rights.print': 'Imprimir la tarjeta',
  'rights.yourCard': 'Tu tarjeta',
  'rights.cardLabel': 'Tarjeta de derechos para imprimir',
  'rights.official.title': 'Tarjetas oficiales y otros idiomas',
  'rights.official.ilrc': '{link}: tarjetas gratis para imprimir en muchos idiomas. Siempre son gratis, así que ten cuidado si alguien cobra por ellas.',
  'rights.official.ilrc.link': 'Tarjetas rojas del ILRC',
  'rights.official.nj': '{link}: materiales del estado para personas, negocios y aeropuertos, en muchos idiomas.',
  'rights.official.nj.link': 'NJ Office of New Americans',
  'rights.official.aclu': '{spanish}, con más idiomas en la {main}.',
  'rights.official.aclu.spanish': 'Guía de la ACLU en español',
  'rights.official.aclu.main': 'guía principal',
  'rights.phone.title': 'Prepara tu teléfono',
  'rights.phone.memorize': 'Memoriza los números de teléfono importantes, porque es posible que te quiten el teléfono.',
  'rights.phone.passcode': 'Usa un código de bloqueo largo y oculta la vista previa de los mensajes en la pantalla de bloqueo.',
  'rights.phone.eff': 'Lee {link} para saber más sobre cómo proteger tu teléfono en protestas y en la frontera.',
  'rights.phone.eff.link': 'Surveillance Self-Defense de la EFF',
};

export default rights;
