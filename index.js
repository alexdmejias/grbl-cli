#! /usr/bin/env node

const { Command } = require('commander');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fs = require('fs/promises');
const chalk = require('chalk');
const { ALARM_DICTIONARY, ERROR_DICTIONARY, GRBL_SETTINGS } = require('./dictionaries');

const { stderr, stdout, exit } = require('process');

const STATUS = '?';
const VIEW_SETTINGS = '$$';
const RUN_HOMING_CYCLE = '$H';
const KILL_ALARM_LOCK = '$X';

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

const initialCommands = [];
const finalCommands = [];

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
    if (this.verbose) console.log(chalk.red('MACHINE::TX::', 'sendCommand', command));
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
    } else if (line === '[MSG:Pgm End]') {
      this.isDone = true;
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

async function sendFileCallback({ filePath, port, verbose }) {
  await validateFile(filePath);
  await validatePort(port);

  const [sp, parser] = await getPort(port);

  const q = new FileLinesQueue(filePath, verbose);
  const m = new Machine(sp, verbose);

  await q.fillBuffer();
  let jobStartTime;

  let lineCounter = 0;

  parser.on('data', async (line) => {
    if (verbose) console.log(chalk.green('RX::', line));

    m.parseMessage(line, lineCounter);

    if (!m.isReady && line === `Grbl 1.1h ['$' for help]`) {
      m.isReady = true;

      return;
    }

    if (initialCommands.length) {
      const cmd = initialCommands.shift();
      m.sendCommand(cmd);
    } else if (!m.isDone) {
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
      }

      if (!q.hasMoreLines()) {
        m.isDone = true;
      }

      // TODO need something like this
      // if ((!q.hasMoreLines() && m.isOk) || m.isDone) {
      //   const jobDuration = getJobDuration(jobStartTime);
      //   if (verbose) console.log(`successfully finished job in ${jobDuration}`);
      //   exit(0);
      // }
    } else if (finalCommands.length) {
      console.log('!!!!!!!!', 'final block', finalCommands);
      const cmd = finalCommands.shift();
      m.sendCommand(cmd);
    }
  });
}

async function main() {
  const program = new Command();

  program
    .name('grbl sender')
    .description('CLI to some JavaScript string utilities')
    .version('0.1.0');

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
    .action(sendFileCallback);

  program.parse();
}

main();
