/**
 * Spanish text for the family emergency plan.
 *
 * The prompts of the plan, the first steps, and the notes with links are
 * reference content in `content/familyPlan.ts`. They stay in English.
 */
import type en from '../en/family';

const family: Record<keyof typeof en, string> = {
  'family.title': 'Plan familiar de emergencia',
  'family.summary': 'Anota quién recoge a los niños, a quién llamar y dónde están los papeles. Puedes guardarlo bloqueado o imprimirlo.',
  'family.lede': 'Decide ahora quién hace qué si detienen a alguien de tu familia, para que nadie tenga que resolverlo en una crisis. Llena solo lo que te ayude.',
  'family.notice': 'Esta página no se guarda hasta que tú la guardes, y nada sale de tu dispositivo. Un plan impreso no está protegido, así que guárdalo en un lugar seguro. Esto no es asesoría legal.',
  'family.englishNotice':
    'Los primeros pasos y las preguntas del plan están en inglés. Puedes escribir tus respuestas en cualquier idioma. Materiales oficiales sobre tus derechos en español y en otros idiomas:',
  'family.firstSteps': 'Haz esto primero',
  'family.printTitle': 'Nuestro plan familiar de emergencia',

  'family.keep': 'Guarda tu plan',
  'family.passphrase': 'Frase de contraseña para guardar',
  'family.save': 'Guardar archivo bloqueado',
  'family.saved': 'Guardado como {file}.',
  'family.saveFailed': 'No se pudo guardar el plan.',
  'family.open': 'Abrir un plan guardado',
  'family.openNote': 'Escribe la frase de contraseña de este archivo.',
  'family.openAction': 'Abrir',
  'family.openFailed': 'No se pudo abrir ese archivo. Revisa el archivo y la frase de contraseña.',
  'family.replaceConfirm': 'Los cambios de esta página no están guardados. ¿Abrir un plan guardado y reemplazarlos?',
  'family.print': 'Imprimir',
};

export default family;
