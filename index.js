const { Command } = require('commander');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fs = require('fs/promises');
const chalk = require('chalk');
// import chalk from 'chalk';

const { stderr, stdout, exit } = require('process');

const STATUS = '?';
const VIEW_SETTINGS = '$$';
const RUN_HOMING_CYCLE = '$H';
const KILL_ALARM_LOCK = '$X';

const ALARM_DICTIONARY = {
  1: 'Hard limit triggered. Machine position is likely lost due to sudden and immediate halt. Re-homing is highly recommended.',
  2: 'G-code motion target exceeds machine travel. Machine position safely retained. Alarm may be unlocked.',
  3: 'Reset while in motion. Grbl cannot guarantee position. Lost steps are likely. Re-homing is highly recommended.',
  4: 'Probe fail. The probe is not in the expected initial state before starting probe cycle, where G38.2 and G38.3 is not triggered and G38.4 and G38.5 is triggered.',
  5: 'Probe fail. Probe did not contact the workpiece within the programmed travel for G38.2 and G38.4.',
  6: 'Homing fail. Reset during active homing cycle.',
  7: 'Homing fail. Safety door was opened during active homing cycle.',
  8: 'Homing fail. Cycle failed to clear limit switch when pulling off. Try increasing pull-off setting or check wiring.',
  9: 'Homing fail. Could not find limit switch within search distance. Defined as 1.5 * max_travel on search and 5 * pulloff on locate phases.'
};

const ERROR_DICTIONARY = {
  1: 'G-code words consist of a letter and a value. Letter was not found.',
  2: 'Numeric value format is not valid or missing an expected value.',
  3: "Grbl '$' system command was not recognized or supported.",
  4: 'Negative value received for an expected positive value.',
  5: 'Homing cycle is not enabled via settings.',
  6: 'Minimum step pulse time must be greater than 3usec',
  7: 'EEPROM read failed. Reset and restored to default values.',
  8: "Grbl '$' command cannot be used unless Grbl is IDLE. Ensures smooth operation during a job.",
  9: 'G-code locked out during alarm or jog state',
  10: 'Soft limits cannot be enabled without homing also enabled.',
  11: 'Max characters per line exceeded. Line was not processed and executed.',
  12: "(Compile Option) Grbl '$' setting value exceeds the maximum step rate supported.",
  13: 'Safety door detected as opened and door state initiated.',
  14: '(Grbl-Mega Only) Build info or startup line exceeded EEPROM line length limit.',
  15: 'Jog target exceeds machine travel. Command ignored.',
  16: "Jog command with no '=' or contains prohibited g-code.",
  17: 'Laser mode disabled. Requires PWM output.',
  20: 'Unsupported or invalid g-code command found in block.',
  21: 'More than one g-code command from same modal group found in block.',
  22: 'Feed rate has not yet been set or is undefined.',
  23: 'G-code command in block requires an integer value.',
  24: 'Two G-code commands that both require the use of the XYZ axis words were detected in the block.',
  25: 'A G-code word was repeated in the block.',
  26: 'A G-code command implicitly or explicitly requires XYZ axis words in the block, but none were detected.',
  27: 'N line number value is not within the valid range of 1 - 9,999,999.',
  28: 'A G-code command was sent, but is missing some required P or L value words in the line.',
  29: 'Grbl supports six work coordinate systems G54-G59. G59.1, G59.2, and G59.3 are not supported.',
  30: 'The G53 G-code command requires either a G0 seek or G1 feed motion mode to be active. A different motion was active.',
  31: 'There are unused axis words in the block and G80 motion mode cancel is active.',
  32: 'A G2 or G3 arc was commanded but there are no XYZ axis words in the selected plane to trace the arc.',
  33: 'The motion command has an invalid target. G2, G3, and G38.2 generates this error, if the arc is impossible to generate or if the probe target is the current position.',
  34: 'A G2 or G3 arc, traced with the radius definition, had a mathematical error when computing the arc geometry. Try either breaking up the arc into semi-circles or quadrants, or redefine them with the arc offset definition.',
  35: 'A G2 or G3 arc, traced with the offset definition, is missing the IJK offset word in the selected plane to trace the arc.',
  36: "There are unused, leftover G-code words that aren't used by any command in the block.",
  37: 'The G43.1 dynamic tool length offset command cannot apply an offset to an axis other than its configured axis. The Grbl default axis is the Z-axis.',
  38: 'Tool number greater than max supported value.|'
};

const GRBL_SETTINGS = {
  0: 'Step pulse time, microseconds',
  1: 'Step idle delay, milliseconds',
  2: 'Step pulse invert, mask',
  3: 'Step direction invert, mask',
  4: 'Invert step enable pin, boolean',
  5: 'Invert limit pins, boolean',
  6: 'Invert probe pin, boolean',
  10: 'Status report options, mask',
  11: 'Junction deviation, millimeters',
  12: 'Arc tolerance, millimeters',
  13: 'Report in inches, boolean',
  20: 'Soft limits enable, boolean',
  21: 'Hard limits enable, boolean',
  22: 'Homing cycle enable, boolean',
  23: 'Homing direction invert, mask',
  24: 'Homing locate feed rate, mm/min',
  25: 'Homing search seek rate, mm/min',
  26: 'Homing switch debounce delay, milliseconds',
  27: 'Homing switch pull-off distance, millimeters',
  30: 'Maximum spindle speed, RPM',
  31: 'Minimum spindle speed, RPM',
  32: 'Laser-mode enable, boolean',
  100: 'X-axis steps per millimeter',
  101: 'Y-axis steps per millimeter',
  102: 'Z-axis steps per millimeter',
  110: 'X-axis maximum rate, mm/min',
  111: 'Y-axis maximum rate, mm/min',
  112: 'Z-axis maximum rate, mm/min',
  120: 'X-axis acceleration, mm/sec^2',
  121: 'Y-axis acceleration, mm/sec^2',
  122: 'Z-axis acceleration, mm/sec^2',
  130: 'X-axis maximum travel, millimeters',
  131: 'Y-axis maximum travel, millimeters',
  132: 'Z-axis maximum travel, millimeters'
};
function handleError(error) {
  stderr.write(`error: ${error}\n`);
  exit(1);
}

async function validateFile(filePathArg) {
  try {
    const stat = await fs.stat(filePathArg);

    try {
      if (!stat.isFile()) {
        throw new Error('not a file');
      }
    } catch (e) {
      handleError(`passed path "${filePathArg}" is not a file`);
    }
  } catch (e) {
    handleError(`passed path "${filePathArg}" is not valid`);
  }
}

async function validatePort(portArg) {
  try {
    const ports = await SerialPort.list();
    const port = ports.find((p) => p.path === portArg);
    if (!port) {
      throw '';
    }
  } catch (e) {
    handleError(`desired port "${portArg}" does not exist`);
  }
}

function parseStatusMessage(msg) {
  const categories = msg.slice(1, -1).split('|');

  const machineState = categories.shift();
  const a = categories.reduce((acc, c) => {
    const [key, value] = c.split(':');
    // return [kv[0], kv[1].split(',')];
    acc[key[0].toLowerCase() + key.slice(1)] = value.split(',').map((c) => parseFloat(c, 10));

    return acc;
  }, {});

  return {
    ...a,
    machineState
  };
}

async function getPort(portArg) {
  const port = new SerialPort({
    path: portArg,
    baudRate: 115200
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  return [port, parser];
}

const initialCommands = [
  /* '$$' */
];

class FileLinesQueue {
  constructor(filePath, verbose) {
    this.filePath = filePath;
    this.chunkSize = 5;
    this.lastLineRequested = 0;
    this.initAmountOfLines = 10;
    this.minAmountOfLinesInBuffer = 5;
    this.buffer = [];
    this.isDoneRequesting = false;
  }

  async fillBuffer() {
    if (this.isDoneRequesting) {
      return;
    }

    const lines = (await fs.readFile(this.filePath, 'utf-8')).split('\n');
    const newLines = lines.slice(this.lastLineRequested, this.lastLineRequested + this.chunkSize);

    if (
      newLines.length < this.minAmountOfLinesInBuffer &&
      this.lastLineRequested !== 0 &&
      !this.isDoneRequesting
    ) {
      this.isDoneRequesting = true;
    }
    this.lastLineRequested += this.chunkSize;
    this.buffer.push(...newLines);

    return newLines;
  }

  async getNewLinesIfNeeded() {
    if (this.buffer.length < this.minAmountOfLinesInBuffer) {
      await this.fillBuffer();
    } else {
      return;
    }
  }

  async getNextLine() {
    await this.getNewLinesIfNeeded();

    return this.buffer.shift();
  }

  hasMoreLines() {
    return !!this.buffer.length;
  }
}

class Machine {
  constructor(port, verbose) {
    this.port = port;
    this.verbose = verbose;

    this.isOk = false;
    this.isReady = false;
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
    if (this.verbose) console.log(chalk.red('MACHINE::', 'sendCommand', command));
    this.port.write(`${command}\n`);
    this.isSendingCommand = true;
  }

  parseMessage(line, lineNumber) {
    const prefix = line.slice(0, 5);

    if (line === 'ok') {
      this.isOk = true;
      this.isSendingCommand = false;
      // this.readyForNextCommand = true;
      // } else if (line === `[MSG:'$H'|'$X' to unlock]`) {
      // this.machineIsLocked = true;
      // } else if (line === '[MSG:Caution: Unlocked]') {
      // this.machineIsLocked = false;
      // } else if (line.includes('Error'))
    } else if (line[0] === '$' && line[1] !== 'N') {
      const a = line.indexOf('=');
      const code = line.slice(1, a);
      // console.log('!!!!!!!!', code);
      if (this.verbose)
        stdout.write(chalk.green(`GRBL SETTING: $${code} = ${GRBL_SETTINGS[code]}\n`));
    } else if (line[0] === '<') {
      const state = parseStatusMessage(line);
      this.machineState = state;
      console.log('@@@@@@@@', state);
    } else if (prefix === 'error') {
      const errorCode = line.slice(6);
      stderr.write(chalk.bgRed.white(`${line} while sending line number ${lineNumber}\n`));
      stderr.write(chalk.bgRed.white(`${ERROR_DICTIONARY[errorCode]}\n`));

      exit(1);
    } else if (prefix === 'ALARM') {
      stderr.write(chalk.bgRed.white(`${line} while sending line number ${lineNumber - 1}\n`));
      stderr.write(chalk.bgRed.white(`${ALARM_DICTIONARY[line.slice(6, 7)]}\n`));

      exit(1);
    }
  }
}

function getJobDuration(startTime) {
  const now = new Date();
  const seconds = now - startTime;
  const result = new Date(seconds).toISOString().slice(11, 19);

  return result;
}

async function wasd({ filePath, port, verbose }) {
  await validateFile(filePath);
  await validatePort(port);

  const [sp, parser] = await getPort(port);

  const q = new FileLinesQueue(filePath, verbose);
  const m = new Machine(sp, verbose);

  await q.fillBuffer();
  let jobStartTime;

  let lineCounter = 0;

  parser.on('data', async (line) => {
    if (verbose) console.log(chalk.green('INCOMING LINE::', line));

    m.parseMessage(line, lineCounter);

    if (!m.isReady && line === `Grbl 1.1h ['$' for help]`) {
      m.isReady = true;

      return;
    }

    if (initialCommands.length) {
      const cmd = initialCommands.shift();
      m.sendCommand(cmd);
    } else {
      if (!initialCommands.length /* && isOk */ && !m.isHomed && !m.isHoming) {
        if (!jobStartTime) {
          jobStartTime = new Date();
        }
        m.sendCommand(RUN_HOMING_CYCLE);
        m.isHoming = true;
      }

      if (m.isHoming && !m.isHomed && m.isOk) {
        m.isHoming = false;
        m.isHomed = true;
        // m.isReadyForFile = true;

        // m.sendCommand(VIEW_SETTINGS);
      }

      if (m.isHomed && m.isOk && q.hasMoreLines() && !m.isSendingCommand) {
        const line = await q.getNextLine();
        lineCounter++;
        m.sendCommand(line, lineCounter);
        console.log('!!!!!!!!', q.buffer);
      }

      // if (!q.hasMoreLines()) {
      //   const jobDuration = getJobDuration(jobStartTime);
      //   if (verbose) console.log(`successfully finished job in ${jobDuration}`);
      //   exit(0);
      // }
    }
  });
}

async function main() {
  const program = new Command();

  program
    .name('grbl sender')
    .description('CLI to some JavaScript string utilities')
    .version('0.0.0');

  program
    .command('list')
    .description('')
    .action(async () => {
      (await SerialPort.list()).forEach((port, index) => {
        stdout.write(`${index + 1}. ${port.path}\n`);
      });
    });

  program
    .command('send')
    .description('stream a file')
    .requiredOption('-f, --file-path <file path>', 'The path of the file to send')
    .requiredOption('-p, --port <machine port>', 'The port of the machine')
    .option('-v, --verbose', 'Verbose mode')
    // TODO pass baud rate
    .action(wasd);

  program.parse();
}

main();

// '<Run|MPos:-279.000,-387.000,0.000|FS:1200,0|WCO:-279.000,-387.000,-0.400>'
