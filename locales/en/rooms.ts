/** English text for the room of a shared tool. */
const rooms = {
  'room.intro':
    'Open a private room for your group. Everyone needs the same group name and passphrase. Share them in person or on Signal. The site does not save your passphrase, so you enter it each visit, and each tool has its own room. People who can guess the name and passphrase can get in, so use the dice button to make a passphrase.',
  'room.memoryOnly': 'This tool saves nothing on this device. After you close or reload the page, the reports come back only from members who are online.',
  'room.name': 'Group name',
  'room.passphrase': 'Passphrase (12 characters or more)',
  'room.open': 'Open room',
  'room.localOnly': 'Use on this device only, with no room',
  'room.openInstead': 'Open a room',
  'room.failed': 'The room did not open. Check the addresses of the signaling servers and try again.',
  'room.noServer':
    'No signaling server is set, so a room works only in this browser. To sync between devices, your group must run a signaling server. See "Host your own copy" on the share page.',
  'room.settings': 'Room settings',
  'room.dataSettings': 'Backup',
  'room.current': 'Room: {name}',
  'room.backupNote': 'A backup is one encrypted file with the data of this tool that is open now. Use it to keep a copy off the device or to move the data to a new room.',
  'room.restoreNote': 'Type the passphrase of the backup file. The data of the backup is added to this tool. A record that was deleted here after the backup was made stays deleted.',
  'room.leave': 'Leave',
  'room.clear': 'Clear from this browser',
  'room.clearConfirm': "Delete this group's data from this browser? Other people's copies stay on their devices.",
  'room.clearPending': 'Another tab is holding this room open. Close other tabs of this site to finish the delete.',
  'dashboard.rooms': 'Open rooms: {count}',
  'dashboard.roomsNote': 'Each tool in "Work as a group" has its own room. A tool with no open room works on this device only.',
  'dashboard.beforeTitle': 'Before you rely on this:',
  'dashboard.beforeText': 'No one has done an independent security review of this site. If a mistake could put someone in danger, use Signal and read what this site can and cannot protect.',
  'dashboard.limitsLink': 'What this site can and cannot protect',
} as const;

export default rooms;
