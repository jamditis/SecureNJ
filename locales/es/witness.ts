/** Spanish text for the witness notes. */
import type en from '../en/witness';

const witness: Record<keyof typeof en, string> = {
  'witness.title': 'Notas de testigo',
  'witness.summary': 'Un formulario guiado para escribir lo que viste. Puedes bloquearlo y dárselo a un abogado o abogada.',
  'witness.subtitle':
    'La memoria se borra rápido. Escribe lo que viste mientras lo recuerdas bien. Después bloquea las notas y dáselas a un abogado o abogada, o a un grupo de respuesta rápida.',

  // `{link}` es el lugar del enlace. Su texto es 'witness.safety.link'.
  'witness.safety.lead': 'Primero, tu seguridad.',
  'witness.safety.text':
    'Cuando estás legalmente en un espacio público, tienes derecho a fotografiar lo que está a la vista, incluida la policía. Mantén tu distancia y no bloquees ni estorbes a los agentes. {link}. Esto no es asesoría legal.',
  'witness.safety.link': 'Lee la guía de la ACLU (en inglés)',
  'witness.notStored': 'Estas notas no se guardan en este dispositivo. Si sales de esta página o la recargas antes de guardarlas, se pierden.',

  'witness.field.when': 'Fecha y hora',
  'witness.field.where': 'Lugar exacto',
  'witness.hint.where': 'La calle y la calle que cruza más cercana, o el nombre del edificio.',
  'witness.field.who': 'Agencia y cómo vestían',
  'witness.hint.who': 'Solo lo que pudiste ver: las palabras en los uniformes, los números de placa si se veían y cuántos agentes había.',
  'witness.field.vehicles': 'Vehículos',
  'witness.hint.vehicles': 'Marca, color, letreros o logotipos, y la placa del vehículo si se veía.',
  'witness.field.what': 'Qué pasó, en orden',
  'witness.hint.what': 'Escribe lo que tú mismo viste y oíste. Marca todo lo que otra persona te contó.',
  'witness.field.said': 'Qué se dijo',
  'witness.hint.said': 'Usa las palabras exactas si puedes. ¿Mostraron una orden judicial?',
  'witness.field.people': 'Personas afectadas',
  'witness.hint.people': 'Describe a las personas sin nombres, a menos que estén de acuerdo. Incluye a quien necesite ayuda ahora.',
  'witness.field.evidence': 'Fotos, video y otros testigos',
  'witness.hint.evidence': 'Anota qué existe y quién lo tiene. Conserva los archivos originales.',

  'witness.save': 'Bloquear y guardar las notas',
  'witness.saved':
    'Se guardó como witness-notes.locked.txt. Ábrelo con la pestaña "Desbloquear" en la página Bloquear un mensaje. Envía la frase de contraseña por otro medio.',
  'witness.problem.empty': 'Escribe lo que viste antes de bloquear las notas.',
  'witness.failed': 'No se pudieron bloquear las notas.',

  'witness.share.title': 'Antes de compartir algo',
  'witness.share.lawyer': 'Dale las notas y los videos a un abogado o abogada, o a un grupo de respuesta rápida, antes de publicarlos.',
  'witness.share.consent': 'Pide permiso antes de compartir la cara o el nombre de alguien. Publicar puede exponer a las personas que quieres proteger.',
  'witness.share.officers':
    'No publiques la dirección de la casa, la familia ni otros datos personales de un agente. Eso te puede traer problemas legales y dañar el caso.',
  // `{link}` es el lugar del enlace. Su texto es 'witness.share.photoLink'.
  'witness.share.photo': 'Usa el {link} en una copia antes de compartir una foto. Conserva el original para el abogado o abogada.',
  'witness.share.photoLink': 'limpiador de fotos',
};

export default witness;
