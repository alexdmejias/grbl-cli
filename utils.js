const fs = require('fs/promises');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { stderr, exit } = require('process');
const { RUN_HOMING_CYCLE } = require('./commands');
const { isErrorRes, isAlarmRes, isBlockingMessage } = require('./responseParsing');

function handleError(error) {
  stderr.write(`error: ${error}\n`);
  exit(1);
}

exports.validateFile = async (filePathArg) => {
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
};

exports.validatePort = async (portArg) => {
  try {
    const ports = await SerialPort.list();
    const port = ports.find((p) => p.path === portArg);
    if (!port) {
      throw '';
    }
  } catch (e) {
    handleError(`desired port "${portArg}" does not exist`);
  }
};

exports.getPort = async (portArg) => {
  const port = new SerialPort({
    path: portArg,
    baudRate: 115200
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  return [port, parser];
};

exports.parseStatusMessage = (msg) => {
  const categories = msg.slice(1, -1).split('|');

  const machineState = categories.shift();
  const a = categories.reduce((acc, c) => {
    const [key, value] = c.split(':');
    acc[key[0].toLowerCase() + key.slice(1)] = value.split(',').map((c) => parseFloat(c, 10));

    return acc;
  }, {});

  return {
    ...a,
    machineState
  };
};

exports.isBlockingLine = (line) => {
  return isAlarmRes(line) || isErrorRes(line) || isBlockingMessage(line);
};

exports.getJobDuration = (startTime) => {
  const now = new Date();
  const seconds = now - startTime;
  const result = new Date(seconds).toISOString().slice(11, 19);

  return result;
};

exports.getShouldWaitForNextOk = (sentLine) => {
  return [RUN_HOMING_CYCLE].includes(sentLine);
};
