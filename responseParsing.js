const { STATUS } = require('./commands');

exports.isStatusCmd = (cmd) => {
  return cmd === STATUS;
};

exports.isOkRes = (line) => {
  return line === 'ok';
};

exports.isGCodeDoneRes = (line) => {
  return line === '[MSG:Pgm End]';
};

exports.isReadyRes = (line) => {
  return line === `Grbl 1.1h ['$' for help]`;
};

exports.isStatusRes = (line) => {
  return line[0] === '<' && line.slice(-1) === '>';
};

exports.isErrorRes = (line) => {
  return line.slice(0, 5) === 'error';
};

exports.isAlarmRes = (line) => {
  return line.slice(0, 5) === 'ALARM';
};

exports.isBlockingMessage = (line) => {
  return [/* `'$H'|'$X' to unlock`, */ `Reset to continue`, `Pgm End`, `Check Limits`].includes(
    line.slice(1, -1).split(':')[1]
  );
};
