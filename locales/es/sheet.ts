/**
 * Spanish text for the resource sheet. The starter listings and the example
 * for the note field are not translated: they are exact reference content in
 * `content/resourceSheet.ts`.
 */
import type en from '../en/sheet';

const sheet: Record<keyof typeof en, string> = {
  'sheet.title': 'Hoja de recursos',
  'sheet.summary': 'Crea una lista de una página con ayuda local que puedes imprimir o copiar en un chat de grupo.',
  'sheet.lede': 'Crea una lista de una página con ayuda local para una recepción, un refrigerador comunitario o un chat de grupo. Imprímela o cópiala como texto.',
  'sheet.notice':
    'Incluye solo lugares que quieren ser públicos. No incluyas refugios confidenciales, casas particulares ni el estatus migratorio de ninguna persona. Llama a cada lugar para confirmar antes de compartir, y pon la fecha en la hoja.',
  'sheet.field.title': 'Título',
  'sheet.defaultTitle': 'Recursos comunitarios',
  'sheet.field.note': 'Nota corta',
  'sheet.listings': 'Entradas',
  'sheet.listing': 'Entrada {number}',
  'sheet.field.name': 'Nombre',
  'sheet.field.offers': 'Qué ofrece',
  'sheet.field.when': 'Cuándo y dónde',
  'sheet.field.contact': 'Teléfono o sitio web',
  'sheet.remove': 'Quitar',
  'sheet.removeListing': 'Quitar la entrada {number}',
  'sheet.add': 'Agregar una entrada',
  'sheet.addStarters': 'Agregar entradas iniciales de Nueva Jersey',
  'sheet.startersInEnglish':
    'Las entradas iniciales de Nueva Jersey están en inglés, porque los nombres y los números deben ser exactos. Puedes cambiarlas después de agregarlas. Material en español:',
  'sheet.spanishLink.ilrc': 'Tarjetas rojas del ILRC',
  'sheet.spanishLink.nnirr': 'Lista de líneas de ayuda de la National Network for Immigrant and Refugee Rights',
  'sheet.spanishLink.aclu': 'Guía de la ACLU en español',
  'sheet.keepDraft': 'Guardar un borrador en este navegador. No está cifrado, así que no uses esta opción en un dispositivo compartido. Desmarca la casilla para borrar el borrador.',
  'sheet.draftNotSaved': 'El navegador no guardó el borrador. La hoja está solo en esta página. Imprímela o cópiala antes de cerrar la página.',
  'sheet.draftNotDeleted': 'El navegador no borró el borrador. Borra los datos de este sitio en la configuración del navegador.',
  'sheet.yourSheet': 'Tu hoja',
  'sheet.print': 'Imprimir',
  'sheet.copy': 'Copiar como texto',
  'sheet.copyFailed': 'El navegador no copió el texto. Selecciona el texto de la hoja y cópialo.',
  'sheet.sheetLabel': 'Hoja de recursos para imprimir',
  'sheet.empty': 'Tus entradas aparecen aquí.',
};

export default sheet;
