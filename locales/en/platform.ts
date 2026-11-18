/** English text for the language switch, the offline app, backup, invite, and erase. */
const platform = {
  'app.title': 'Local resilience toolkit',

  'language.label': 'Language',

  'device.open': 'Data on this device',
  'device.title': 'Data on this device',
  'device.backupTitle': 'Backup',
  'device.backupNote': 'A backup is one encrypted file with the shared data that is open now: {scope}. It does not hold the phone tree, which has its own export.',
  'device.scopeLocal': 'the data of this device',
  'device.scopeSpace': 'the space "{name}"',
  'device.backup': 'Save a backup',
  'device.backupPassphraseNote': 'The backup is encrypted with this passphrase. Use a different passphrase than the passphrase of the space, and keep it apart from the file.',
  'device.backupSaved': 'Saved: {name}',
  'device.restore': 'Restore a backup',
  'device.restorePassphraseNote': 'Type the passphrase of the backup file. The data of the backup is added to {scope}. A record that was deleted here after the backup was made stays deleted.',
  'device.restored': 'The backup is added.',
  'device.notBackup': 'The file is not a backup of a space.',
  'device.eraseTitle': 'Erase this device',
  'device.eraseNote': 'This deletes all data of the app from this browser: all tools, the phone tree, the saved space and its passphrase, and the offline copy of the app. Other members keep their copies of a space. You cannot undo this.',
  'device.erase': 'Erase all data',
  'device.eraseConfirm': 'Erase now. I cannot undo this.',

  'erase.done': 'The data of the app is erased from this browser.',
  'erase.pending': 'One delete is not complete, because a different tab or window has the app open. Close all other tabs of the app to complete it.',
  'erase.otherTab': 'Close this tab.',
  'erase.restart': 'Start again',

  'invite.title': 'Invite a member',
  'invite.note': 'The link and the code hold the space name and the signaling servers. They do not hold the passphrase. Give the passphrase in a different way, for example in person.',
  'invite.link': 'Invite link',
  'invite.copy': 'Copy the link',
  'invite.qr': 'Code for the camera of a phone',
  'invite.received': 'You opened an invite to the space "{name}". Check that the signaling servers are from your group. Then type the passphrase that your group gave you.',

  'offline.ready': 'This app is saved for use with no connection.',
} as const;

export default platform;
