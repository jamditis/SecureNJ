/** English text for the photo cleaner. */
const photo = {
  'photo.title': 'Photo cleaner',
  'photo.summary': 'Removes GPS and other hidden data from a copy of a photo, and lets you cover faces and plates.',
  'photo.lede':
    'Photos can carry hidden details such as GPS location, the time, and your phone model. This saves a copy without them, and lets you cover faces. The photo stays on your device.',
  'photo.choose': 'Choose a photo',
  'photo.problem.open': 'This browser cannot open that image. Try a JPEG or PNG.',
  'photo.problem.save': 'Could not save this image.',
  'photo.tapLead': 'Tap each face, tattoo, license plate, or street sign you want to cover.',
  'photo.tapNote': 'The covers are solid black, because blur can sometimes be reversed.',
  'photo.coverSize': 'Cover size',
  'photo.undo': 'Undo',
  'photo.canvasLabel': 'Your photo. Select a spot to cover it.',
  'photo.save': 'Save cleaned copy',
  'photo.saved': 'Saved as {name}. Look it over before you share it.',
  'photo.limitsTitle': "What this can't do",
  'photo.limit.visible': "It can't remove what's visible, such as a street sign, a reflection, or someone's clothes. Check the whole photo.",
  'photo.limit.video': 'It works on photos, not video.',
  'photo.limit.original': "Keep the untouched original for a lawyer. Metadata can be useful evidence, and a cleaned copy can't replace it.",
} as const;

export default photo;
