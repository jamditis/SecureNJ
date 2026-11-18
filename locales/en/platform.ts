/** English text for the language switch, the offline app, backup, invite, and erase. */
const platform = {
  'app.title': 'Local resilience toolkit',

  'language.label': 'Language',
  'language.machineNote': 'This text is a machine translation. A person has not reviewed it yet.',
  'language.report': 'Report an error',

  'device.open': 'Data on this device',
  'device.backupTitle': 'Backup',
  'device.backup': 'Save a backup',
  'device.backupPassphraseNote': 'The backup is encrypted with this passphrase. Use a different passphrase than the passphrase of the room, and keep it apart from the file.',
  'device.backupSaved': 'Saved: {name}',
  'device.restore': 'Restore a backup',
  'device.notBackup': 'The file is not a backup of a room.',
  'device.eraseTitle': 'Erase this device',
  'device.eraseNote': "This deletes all data of the app from this browser: all tools, the phone tree, the data of each room, and the offline copy of the app. Other members keep their copies. You cannot undo this.",
  'device.erase': 'Erase all data',
  'device.eraseConfirm': 'Erase now. I cannot undo this.',

  'erase.done': 'The data of the app is erased from this browser.',
  'erase.pending': 'One delete is not complete, because a different tab or window has the app open. Close all other tabs of the app to complete it.',
  'erase.otherTab': 'Close this tab.',
  'erase.restart': 'Start again',

  'invite.title': 'Invite a member',
  'invite.note': 'The link and the code hold the group name and the signaling servers. They do not hold the passphrase. Give the passphrase in a different way, for example in person.',
  'invite.link': 'Invite link',
  'invite.copy': 'Copy the link',
  'invite.qr': 'Code for the camera of a phone',
  'invite.received': 'You opened an invite to the group "{name}". Open a tool under "Work as a group": the group name and the servers are filled in. Check that the servers are from your group, then type the passphrase that your group gave you.',

} as const;

export default platform;
