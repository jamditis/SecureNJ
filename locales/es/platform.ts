/** Spanish text for the language switch, the offline app, backup, invite, and erase. */
import type en from '../en/platform';

const platform: Record<keyof typeof en, string> = {
  'app.title': 'Herramientas de resiliencia local',

  'language.label': 'Idioma',

  'device.open': 'Datos en este dispositivo',
  'device.title': 'Datos en este dispositivo',
  'device.backupTitle': 'Copia de seguridad',
  'device.backupNote': 'Una copia de seguridad es un archivo cifrado con los datos compartidos que están abiertos ahora: {scope}. No incluye la cadena telefónica, que tiene su propia exportación.',
  'device.scopeLocal': 'los datos de este dispositivo',
  'device.scopeSpace': 'el espacio "{name}"',
  'device.backup': 'Guardar una copia de seguridad',
  'device.backupPassphraseNote': 'La copia se cifra con esta frase de contraseña. Usa una frase distinta a la del espacio y guárdala separada del archivo.',
  'device.backupSaved': 'Guardado: {name}',
  'device.restore': 'Restaurar una copia de seguridad',
  'device.restorePassphraseNote': 'Escribe la frase de contraseña del archivo de copia. Los datos de la copia se agregan a {scope}. Un registro que se borró aquí después de hacer la copia sigue borrado.',
  'device.restored': 'La copia se agregó.',
  'device.notBackup': 'El archivo no es una copia de seguridad de un espacio.',
  'device.eraseTitle': 'Borrar este dispositivo',
  'device.eraseNote': 'Esto borra de este navegador todos los datos de la aplicación: todas las herramientas, la cadena telefónica, el espacio guardado con su frase de contraseña y la copia sin conexión de la aplicación. Los demás miembros conservan sus copias del espacio. No se puede deshacer.',
  'device.erase': 'Borrar todos los datos',
  'device.eraseConfirm': 'Borrar ahora. No puedo deshacer esto.',

  'erase.done': 'Los datos de la aplicación se borraron de este navegador.',
  'erase.pending': 'Un borrado no está completo porque otra pestaña o ventana tiene abierta la aplicación. Cierra todas las demás pestañas de la aplicación para completarlo.',
  'erase.otherTab': 'Cierra esta pestaña.',
  'erase.restart': 'Empezar de nuevo',

  'invite.title': 'Invitar a un miembro',
  'invite.note': 'El enlace y el código incluyen el nombre del espacio y los servidores de señalización. No incluyen la frase de contraseña. Entrega la frase de otra forma, por ejemplo en persona.',
  'invite.link': 'Enlace de invitación',
  'invite.copy': 'Copiar el enlace',
  'invite.qr': 'Código para la cámara de un celular',
  'invite.received': 'Abriste una invitación al espacio "{name}". Revisa que los servidores de señalización sean de tu grupo. Luego escribe la frase de contraseña que te dio tu grupo.',

  'offline.ready': 'Esta aplicación está guardada para usarla sin conexión.',
};

export default platform;
