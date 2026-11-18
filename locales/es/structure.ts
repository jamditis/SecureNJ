/** Spanish text for the sections, the start page, and the page about limits. */
import type en from '../en/structure';

const structure: Record<keyof typeof en, string> = {
  'section.send.title': 'Enviar algo en privado',
  'section.send.intro': 'Lo que creas aquí sale de tu dispositivo solo cuando tú lo envías.',
  'section.ready.title': 'Prepárate antes de necesitarlo',
  'section.ready.intro': 'Prepárate mientras todo está en calma. Imprime estas hojas y tenlas a la mano.',
  'section.document.title': 'Documentar y compartir',
  'section.document.intro': 'Registra lo que pasó, protege a las personas involucradas y lleva ayuda a quienes la necesitan.',
  'section.group.title': 'Trabajar en grupo',
  'section.group.intro': 'Cada grupo abre su propia sala con una frase de contraseña compartida. Las actualizaciones pasan directamente entre los navegadores de los miembros.',
  'limits.navTitle': 'Lo que esto no puede proteger',
};

export default structure;
