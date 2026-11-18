/** Spanish text for the room of a shared tool. */
import type en from '../en/rooms';

const rooms: Record<keyof typeof en, string> = {
  'room.intro':
    'Abre una sala privada para tu grupo. Todos necesitan el mismo nombre de grupo y la misma frase de contraseña. Compártanlos en persona o por Signal. El sitio no guarda tu frase de contraseña, así que la escribes en cada visita, y cada herramienta tiene su propia sala. Quien adivine el nombre y la frase puede entrar, así que usa el botón del dado para crear una frase de contraseña.',
  'room.memoryOnly': 'Esta herramienta no guarda nada en este dispositivo. Después de cerrar o recargar la página, los reportes vuelven solo desde los miembros que están en línea.',
  'room.name': 'Nombre del grupo',
  'room.passphrase': 'Frase de contraseña (12 caracteres o más)',
  'room.open': 'Abrir la sala',
  'room.localOnly': 'Usar solo en este dispositivo, sin sala',
  'room.openInstead': 'Abrir una sala',
  'room.failed': 'La sala no se abrió. Revisa las direcciones de los servidores de señalización e inténtalo de nuevo.',
  'room.noServer':
    'No hay ningún servidor de señalización configurado, así que una sala funciona solo en este navegador. Para sincronizar entre dispositivos, tu grupo debe tener en funcionamiento un servidor de señalización. Consulta "Aloja tu propia copia" en la página para compartir.',
  'room.settings': 'Configuración de la sala',
  'room.dataSettings': 'Copia de seguridad',
  'room.current': 'Sala: {name}',
  'room.backupNote': 'Una copia de seguridad es un archivo cifrado con los registros de esta herramienta que están abiertos ahora. Úsala para guardar una copia fuera del dispositivo o para pasar los registros a una sala nueva.',
  'room.restoreNote': 'Escribe la frase de contraseña del archivo de copia. Los registros de la copia se agregan a esta herramienta. Un registro que ya está aquí no cambia, y un registro borrado no vuelve.',
  'room.restored': 'Registros agregados: {count}',
  'room.leave': 'Salir',
  'room.clear': 'Borrar de este navegador',
  'room.clearConfirm': '¿Borrar de este navegador los datos de este grupo? Las copias de otras personas se quedan en sus dispositivos.',
  'room.clearPending': 'Otra pestaña mantiene abierta esta sala. Cierra las demás pestañas de este sitio para terminar de borrar.',
  'dashboard.rooms': 'Salas abiertas: {count}',
  'dashboard.roomsNote': 'Cada herramienta de "Trabajar en grupo" tiene su propia sala. Una herramienta sin sala abierta funciona solo en este dispositivo.',
  'dashboard.beforeTitle': 'Antes de confiar en esto:',
  'dashboard.beforeText': 'Nadie ha hecho una revisión de seguridad independiente de este sitio. Si un error puede poner a alguien en peligro, usa Signal y lee lo que este sitio puede y no puede proteger.',
  'dashboard.limitsLink': 'Lo que este sitio puede y no puede proteger',
};

export default rooms;
