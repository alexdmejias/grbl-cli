const { stderr, stdout } = require('process');

const chalk = require('chalk');

const { ALARM_DICTIONARY, ERROR_DICTIONARY, GRBL_SETTINGS } = require('./dictionaries');
const {
  isStatusCmd,
  isOkRes,
  isGCodeDoneRes,
  isReadyRes,
  isStatusRes,
  isErrorRes,
  isAlarmRes
} = require('./responseParsing');
const { parseStatusMessage } = require('./utils');

class Machine {
  constructor({ port, verbose, initCommands, endCommands, file }) {
    this.port = port;
    this.verbose = verbose;
    this.initCommands = initCommands;
    this.endCommands = endCommands;

    this.isOk = false;
    this.isReady = false;
    this.isDone = false;
    this.isHomed = false;
    this.isHoming = false;
    this.isSendingCommand = false;
    // this.isDoneSendingFile = false;
    // this.isReadyForFile = false;
    // this.machineIsLocked = true;
    // this.readyForNextCommand = true;
    this.machineState = {};
  }

  sendCommand(command) {
    if (this.verbose && !isStatusCmd(command))
      console.log(chalk.red('MACHINE::TX::', 'sendCommand', command));
    this.port.write(`${command}\n`);
    this.isSendingCommand = true;
  }

  resetState() {}

  removeLineFromBuffer() {
    this.fileBuffer.shift();
  }

  // TODO ugly and probably not entirely necessary
  parseMessage(line) {
    if (isOkRes(line)) {
      this.isOk = true;
      this.isSendingCommand = false;
    } else if (isGCodeDoneRes(line)) {
      this.isDone = true;
    } else if (line[0] === '$' && line[1] !== 'N') {
      // TODO write function for ^
      const a = line.indexOf('=');
      const code = line.slice(1, a);
      if (this.verbose)
        stdout.write(chalk.green(`GRBL SETTING: $${code} = ${GRBL_SETTINGS[code]}\n`));
    } else if (isReadyRes(line)) {
      this.isReady = true;
    } else if (isStatusRes(line)) {
      this.machineState = parseStatusMessage(line);
    } else if (isErrorRes(line) || isAlarmRes(line)) {
      // stderr.write(chalk.bgRed.white(`${line} while sending line `));
      let str = ALARM_DICTIONARY[line.slice(6, 7)];
      if (!isAlarmRes(line)) {
        const errorCode = line.slice(6);
        str = ERROR_DICTIONARY[errorCode];
      }

      stderr.write(chalk.bgRed.white(`${str}\nline: ${line}\n`));

      // exit(1);
    }
  }
}

exports.Machine = Machine;
