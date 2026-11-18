/**
 * Spanish text for the Resources page and the Share page.
 *
 * In the steps of "Host your own copy", `backticks` mark code and
 * [square brackets] mark the text of the link to the code.
 */
import type en from '../en/infoPages';

const infoPages: Record<keyof typeof en, string> = {
  'resources.navTitle': 'Recursos',
  'resources.lede': 'Herramientas y organizaciones reconocidas, e instrucciones de IA para el trabajo diario de una organización sin fines de lucro. Este sitio no está afiliado a ninguna de ellas.',
  'resources.englishNotice': 'Los nombres y las notas de los enlaces, y las instrucciones para IA, están en inglés.',
  'resources.group.communication': 'Comunicación privada',
  'resources.group.rights': 'Conoce tus derechos',
  'resources.group.newJersey': 'Ayuda en Nueva Jersey',
  'resources.group.backOffice': 'Incidencia y apoyo administrativo',
  'resources.linkLabel': '{name} (se abre en una pestaña nueva)',
  'resources.promptsTitle': 'Instrucciones de IA para el trabajo administrativo',
  'resources.promptsIntro': 'Funcionan en los planes gratuitos de ChatGPT, Gemini y Claude. Úsalas para tener un primer borrador más rápido. Después vuelve a poner tus propios datos y tu propia voz.',
  'resources.caution.people.lead': 'Primero protege a las personas.',
  'resources.caution.people.text': 'No pegues notas de casos, formularios de ingreso, datos de clientes, nombres ni números de caso en un chatbot gratuito. Las herramientas gratuitas pueden guardar lo que escribes.',
  'resources.caution.settings.lead': 'Revisa tu configuración.',
  'resources.caution.settings.text': 'Busca los controles de datos de cada herramienta y usa un chat temporal si lo hay. Un chat temporal también se puede guardar por un tiempo, así que no es privado.',
  'resources.caution.numbers.lead': 'Revisa cada número.',
  'resources.caution.numbers.text': 'Los chatbots inventan detalles que suenan correctos. Compara cada fecha, cantidad y cita con la fuente.',
  'resources.caution.work.lead': 'Pregunta primero en tu trabajo.',
  'resources.caution.work.text': 'Tu empleador puede tener reglas o deberes de confidencialidad que cubren los documentos de trabajo.',
  'resources.copyPrompt': 'Copiar la instrucción',
  'resources.copyFailed': 'El navegador no copió el texto. Selecciona el texto y cópialo a mano.',

  'sharePage.navTitle': 'Comparte esto',
  'sharePage.lede': 'Compártelo de la manera que mejor llegue a las personas que buscas.',
  'sharePage.noAddress': 'Esta copia está abierta desde un archivo de este dispositivo, así que no tiene una dirección web para compartir. Abre la copia que aloja tu grupo y después vuelve a esta página.',
  'sharePage.textTitle': 'Por mensaje de texto',
  'sharePage.message': 'Herramientas gratuitas para mantener a tu comunidad segura e informada, sin necesidad de una cuenta: {address}',
  'sharePage.copyMessage': 'Copiar el mensaje',
  'sharePage.copyFailed': 'El navegador no copió el texto. Selecciona el texto y cópialo a mano.',
  'sharePage.paperTitle': 'En papel',
  'sharePage.paperText': 'Imprime este volante para una reunión, una recepción o una mesa de recursos. Algunas personas a las que quieres llegar pueden no tener internet confiable.',
  'sharePage.print': 'Imprimir el volante',
  'sharePage.flyerLabel': 'Volante para imprimir',
  'sharePage.flyerTitle': 'Herramientas gratuitas para mantener a tu comunidad segura e informada',
  'sharePage.flyerIntro': 'Sin cuenta y sin registro. Escanea el código o escribe la dirección.',
  'sharePage.flyerItemTitle': '{title}:',
  'sharePage.flyerUse.message': 'envía algo delicado por correo electrónico, por mensaje de texto o en una memoria USB.',
  'sharePage.flyerUse.rights': 'lleva en tu cartera las palabras que necesitas.',
  'sharePage.flyerUse.family': 'decide ahora, para que nadie tenga que decidir en una crisis.',
  'sharePage.flyerUse.sheet': 'lleva la información a las personas que la necesitan.',
  'sharePage.flyerUse.resources': 'guías de derechos, ayuda en Nueva Jersey e instrucciones de IA para el trabajo administrativo.',
  'sharePage.flyerNote': 'Para cualquier cosa delicada, usa Signal primero. No incluyas nombres, direcciones ni números de caso.',
  'sharePage.qrLabel': 'Código QR de {address}',
  'sharePage.hostTitle': 'Aloja tu propia copia',
  'sharePage.hostIntro': 'Tu grupo puede tener su propia copia. Así no dependes de esta, y tú decides quién la aloja. Se necesita una persona que sepa usar la línea de comandos.',
  'sharePage.host.code': 'Haz un fork o descarga [el código en GitHub].',
  'sharePage.host.build': 'Ejecuta `npm install` y después `npm run build`. Necesitas Node.js 22.',
  'sharePage.host.serve':
    'Pon la carpeta `dist` en cualquier servidor de archivos estáticos que la sirva por HTTPS. Los navegadores necesitan HTTPS o localhost para que el cifrado funcione, así que una copia en una red local necesita un certificado en el que los dispositivos confíen.',
  'sharePage.host.origin':
    'Dale a la copia una dirección web que no sirva nada más, por ejemplo su propio subdominio. Otro sitio con el mismo esquema, host y puerto puede leer y cambiar los datos que esta aplicación guarda en el navegador. Un sitio de proyecto en GitHub Pages los comparte con los otros sitios de proyecto del mismo usuario.',
  'sharePage.host.signaling':
    'Para sincronizar las herramientas de grupo entre dispositivos, ejecuta un servidor de señalización: `npm run signaling` inicia uno en el puerto 4444. Una página servida por HTTPS solo se puede conectar a una dirección `wss://`, así que pon el servidor detrás de un proxy inverso que tenga un certificado TLS.',
  'sharePage.host.default':
    'Los miembros escriben la dirección del servidor en el formulario que abre una sala. Para que sea la dirección predeterminada, pon `VITE_SIGNALING_URLS=wss://your-server` en el archivo `.env.local` y compila de nuevo.',
  'sharePage.hostDocs': 'El archivo `README.md` del código tiene los pasos completos. El archivo `docs/signaling.md` describe el servidor de señalización, y `docs/security.md` enumera los límites. Estos archivos están en inglés.',
  'sharePage.linkLabel': '{name} (se abre en una pestaña nueva)',
};

export default infoPages;
