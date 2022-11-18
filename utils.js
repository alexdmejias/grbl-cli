import { stat } from 'fs/promises';
import { createInterface } from 'readline';
import { stderr, exit, stdout, stdin } from 'process';

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { RUN_HOMING_CYCLE } from './commands.js';
import { isErrorRes, isAlarmRes, isBlockingMessage } from './responseParsing.js';

function handleError(error) {
  stderr.write(`error: ${error}\n`);
  exit(1);
}

export async function validateFile(filePathArg) {
  try {
    const fileStats = await stat(filePathArg);

    try {
      if (!fileStats.isFile()) {
        throw new Error('not a file');
      }
    } catch (e) {
      handleError(`passed path "${filePathArg}" is not a file`);
    }
  } catch (e) {
    handleError(`passed path "${filePathArg}" is not valid`);
  }
}

export async function validatePort(portArg) {
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

export async function getArg(portArg) {
  let port = portArg;

  if (!port) {
    const rl = createInterface({
      input: stdin,
      output: stdout
    });

    const availablePorts = await SerialPort.list();

    availablePorts.forEach((port, index) => {
      stdout.write(`${index + 1}. ${port.path}\n`);
    });

    port = await new Promise((resolve) => {
      rl.question('Pick a port? input a number or the full path from the list above: ', (input) => {
        let a = input;
        const parsedInput = parseInt(input, 10);
        if (parsedInput) {
          a = availablePorts[parsedInput - 1]?.path;
        }

        console.log(`picked: ${a}`);

        rl.close();

        resolve(a);
      });
    });

    return port;
  }
}

export async function getSerialPort(portArg) {
  const port = new SerialPort({
    path: portArg,
    baudRate: 115200
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  return [port, parser];
}

export function parseStatusMessage(msg) {
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
}

export function isBlockingLine(line) {
  return isAlarmRes(line) || isErrorRes(line) || isBlockingMessage(line);
}

export function getJobDuration(startTime) {
  const now = new Date();
  const seconds = now - startTime;
  const result = new Date(seconds).toISOString().slice(11, 19);

  return result;
}

export function getShouldWaitForNextOk(sentLine) {
  return [RUN_HOMING_CYCLE].includes(sentLine);
}
