/** Spanish text for the language switch, the offline app, backup, invite, and erase. */
import type en from '../en/platform';

const platform: Record<keyof typeof en, string> = {
  'app.title': 'Herramientas de resiliencia local',

  'language.label': 'Idioma',
  'language.machineNote': 'Este texto es una traducción automática. Todavía no lo ha revisado una persona.',
  'language.report': 'Avisar de un error',

  'device.open': 'Datos en este dispositivo',
  'device.backupTitle': 'Copia de seguridad',
  'device.backup': 'Guardar una copia de seguridad',
  'device.backupPassphraseNote': 'La copia se cifra con esta frase de contraseña. Usa una frase distinta a la del espacio y guárdala separada del archivo.',
  'device.backupSaved': 'Guardado: {name}',
  'device.restore': 'Restaurar una copia de seguridad',
  'device.restored': 'La copia se agregó.',
  'device.notBackup': 'El archivo no es una copia de seguridad de un espacio.',
  'device.eraseTitle': 'Borrar este dispositivo',
  'device.eraseNote': "Esto borra de este navegador todos los datos de la aplicación: todas las herramientas, la cadena telefónica, los datos de cada sala y la copia sin conexión de la aplicación. Los demás miembros conservan sus copias. No se puede deshacer.",
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
  'invite.received': 'Abriste una invitación al grupo "{name}". Abre una herramienta de "Trabajar en grupo": el nombre del grupo y los servidores ya están escritos. Revisa que los servidores sean de tu grupo y luego escribe la frase de contraseña que te dio tu grupo.',

};

export default platform;
