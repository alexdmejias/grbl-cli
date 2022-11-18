import { stderr, stdout } from 'process';

import chalk from 'chalk';

import { ALARM_DICTIONARY, ERROR_DICTIONARY, GRBL_SETTINGS } from './dictionaries.js';
import {
  isStatusCmd,
  isOkRes,
  isGCodeDoneRes,
  isWelcomeRes,
  isStatusRes,
  isErrorRes,
  isAlarmRes
} from './responseParsing.js';
import { RUN_HOMING_CYCLE, KILL_ALARM_LOCK } from './commands.js';
import { parseStatusMessage } from './utils.js';

const commandPairings = {
  [RUN_HOMING_CYCLE]: {
    before: { isHoming: true },
    after: { isHomed: true, isHoming: false, isLocked: false }
  }
};

class Machine {
  constructor({ port, verbose, initCommands, endCommands }) {
    this.port = port;
    this.verbose = verbose;
    this.initCommands = initCommands;
    this.endCommands = endCommands;

    this.machineState = {};
    this.pendingSideEffects;
  }

  sendCommand(command) {
    if (this.verbose && !isStatusCmd(command)) console.log(chalk.red('MACHINE::TX::', command));

    this.port.write(`${command}\n`);

    const flagsToToggle = commandPairings[command];

    if (flagsToToggle) {
      this.setMachineState(flagsToToggle.before);
      this.pendingSideEffects = flagsToToggle.after;
    }
  }

  applyPendingSideEffects() {
    this.setMachineState(this.pendingSideEffects);
    this.pendingSideEffects = undefined;
  }

  hasPendingSideEffects() {
    return !!this.pendingSideEffects;
  }

  resetState() {}

  removeLineFromBuffer() {
    this.fileBuffer.shift();
  }

  setMachineState(newState = {}) {
    this.machineState = Object.assign({}, this, this.machineState, newState);

    return this.machineState;
  }

  // TODO ugly and probably not entirely necessary
  // parseMessage(line) {
  //   if (isOkRes(line)) {
  //     this.isOk = true;
  //     this.isSendingCommand = false;
  //   } else if (isGCodeDoneRes(line)) {
  //     this.isDone = true;
  //   } else if (line[0] === '$' && line[1] !== 'N') {
  //     // TODO write function for ^
  //     const a = line.indexOf('=');
  //     const code = line.slice(1, a);
  //     if (this.verbose)
  //       stdout.write(chalk.green(`GRBL SETTING: $${code} = ${GRBL_SETTINGS[code]}\n`));
  //   } else if (isWelcomeRes(line)) {
  //     this.isReady = true;
  //   } else if (isStatusRes(line)) {
  //     this.machineState = parseStatusMessage(line);
  //   } else if (isErrorRes(line) || isAlarmRes(line)) {
  //     // stderr.write(chalk.bgRed.white(`${line} while sending line `));
  //     let str = ALARM_DICTIONARY[line.slice(6, 7)];
  //     if (!isAlarmRes(line)) {
  //       const errorCode = line.slice(6);
  //       str = ERROR_DICTIONARY[errorCode];
  //     }

  //     stderr.write(chalk.bgRed.white(`${str}\nline: ${line}\n`));

  //     // exit(1);
  //   }
}

const _Machine = Machine;
export { _Machine as Machine };
