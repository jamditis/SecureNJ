/** Spanish text for the photo cleaner. */
import type en from '../en/photo';

const photo: Record<keyof typeof en, string> = {
  'photo.title': 'Limpiador de fotos',
  'photo.summary': 'Quita el GPS y otros datos ocultos de una copia de una foto, y te deja cubrir caras y placas de auto.',
  'photo.lede':
    'Las fotos pueden llevar detalles ocultos, como la ubicación GPS, la hora y el modelo de tu teléfono. Esto guarda una copia sin ellos y te deja cubrir caras. La foto se queda en tu dispositivo.',
  'photo.choose': 'Elige una foto',
  'photo.problem.open': 'Este navegador no puede abrir esa imagen. Prueba con un JPEG o un PNG.',
  'photo.problem.save': 'No se pudo guardar esta imagen.',
  'photo.tapLead': 'Toca cada cara, tatuaje, placa de auto o letrero de calle que quieras cubrir.',
  'photo.tapNote': 'Los recuadros son de color negro sólido, porque el desenfoque a veces se puede revertir.',
  'photo.coverSize': 'Tamaño del recuadro',
  'photo.undo': 'Deshacer',
  'photo.canvasLabel': 'Tu foto. Selecciona un punto para cubrirlo.',
  'photo.save': 'Guardar copia limpia',
  'photo.saved': 'Se guardó como {name}. Revísala antes de compartirla.',
  'photo.limitsTitle': 'Lo que esto no puede hacer',
  'photo.limit.visible': 'No puede quitar lo que se ve, como un letrero de calle, un reflejo o la ropa de alguien. Revisa toda la foto.',
  'photo.limit.video': 'Funciona con fotos, no con video.',
  'photo.limit.original':
    'Guarda el original sin cambios para un(a) abogado(a). Los metadatos pueden servir como prueba, y una copia limpia no puede reemplazarlo.',
};

export default photo;
