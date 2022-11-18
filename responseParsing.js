import { STATUS, RUN_HOMING_CYCLE } from './commands.js';

export function isStatusCmd(cmd) {
  return cmd === STATUS;
}

export function isHomingCmd(cmd) {
  return cmd === RUN_HOMING_CYCLE;
}

export function isComment(cmd) {
  return [';', '('].includes(cmd.trim()[0]);
}

export function isWelcomeRes(line) {
  return line === `Grbl 1.1h ['$' for help]`;
}

export function isOkRes(line) {
  return line === 'ok';
}

export function isGCodeDoneRes(line) {
  return line === '[MSG:Pgm End]';
}

export function isMessageRes(line) {
  return line.slice(0, 5) === '[MSG:' && line.at(-1) === ']';
}

export function isStatusRes(line) {
  return line[0] === '<' && line.slice(-1) === '>';
}

export function isErrorRes(line) {
  return line.slice(0, 5) === 'error';
}

export function isAlarmRes(line) {
  return line.slice(0, 5) === 'ALARM';
}

export function isBlockingMessage(line) {
  return [/* `'$H'|'$X' to unlock`, */ `Reset to continue`, `Pgm End`, `Check Limits`].includes(
    line.slice(1, -1).split(':')[1]
  );
}
