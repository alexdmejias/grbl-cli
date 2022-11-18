import { STATUS, RUN_HOMING_CYCLE } from './commands';

export function isStatusCmd(cmd: string) {
  return cmd === STATUS;
}

export function isHomingCmd(cmd: string) {
  return cmd === RUN_HOMING_CYCLE;
}

export function isComment(cmd: string) {
  return [';', '('].includes(cmd.trim()[0]);
}

export function isWelcomeRes(line: string) {
  return line === `Grbl 1.1h ['$' for help]`;
}

export function isOkRes(line: string) {
  return line === 'ok';
}

export function isGCodeDoneRes(line: string) {
  return line === '[MSG:Pgm End]';
}

export function isMessageRes(line: string) {
  return line.slice(0, 5) === '[MSG:' && line.at(-1) === ']';
}

export function isStatusRes(line: string) {
  return line[0] === '<' && line.slice(-1) === '>';
}

export function isErrorRes(line: string) {
  return line.slice(0, 5) === 'error';
}

export function isAlarmRes(line: string) {
  return line.slice(0, 5) === 'ALARM';
}

export function isBlockingMessage(line: string) {
  return [/* `'$H'|'$X' to unlock`, */ `Reset to continue`, `Pgm End`, `Check Limits`].includes(
    line.slice(1, -1).split(':')[1]
  );
}
