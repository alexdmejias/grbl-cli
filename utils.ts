import { stat } from 'fs/promises';
import { createInterface } from 'readline';
import { stderr, exit, stdout, stdin } from 'process';

import prompt from 'prompt';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { RUN_HOMING_CYCLE } from './commands';
import { isErrorRes, isAlarmRes, isBlockingMessage } from './responseParsing';

function handleError(error: string) {
  stderr.write(`error: ${error}\n`);
  exit(1);
}

export async function validateFile(filePathArg: string) {
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

export async function validatePort(portArg: string) {
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

export async function getArg(portArg?: string): Promise<string> {
  let port = portArg;

  if (typeof port === undefined) {
    // const rl = createInterface({
    //   input: stdin,
    //   output: stdout
    // });
    prompt.start();

    const availablePorts = await (await SerialPort.list()).map((sp) => sp.path);

    availablePorts.forEach((path, index) => {
      stdout.write(`${index + 1}. ${path}\n`);
    });

    const { portPathOrNumber } = await prompt.get({
      properties: {
        portPathOrNumber: {
          type: 'string',
          conform: (value) => {
            const num = parseInt(value, 10);
            if (num && num > 0 && num < availablePorts.length) {
              return true;
            } else if (availablePorts.includes(value)) {
              return true;
            }

            return false;
          }
        }
      }
    });

    console.log('!!!!!!!!', portPathOrNumber);
    // port = await new Promise<string>((resolve) => {
    //   rl.question('Pick a port? input a number or the full path from the list above: ', (input) => {
    //     let a = input;
    //     const parsedInput = parseInt(input, 10);
    //     if (parsedInput) {
    //       a = availablePorts[parsedInput - 1]?.path;
    //     }

    //     console.log(`picked: ${a}`);

    //     rl.close();

    //     resolve(a);
    //   });
    // }) as string;
  }

  return port;
}

export async function getSerialPort(portArg: string) {
  const port = new SerialPort({
    path: portArg,
    baudRate: 115200
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  return [port, parser];
}

export function parseStatusMessage(msg: string) {
  const categories = msg.slice(1, -1).split('|');

  const machineState = categories.shift();
  const a = categories.reduce((acc, c) => {
    const [key, value] = c.split(':');
    acc[key[0].toLowerCase() + key.slice(1)] = value.split(',').map((c) => parseFloat(c));

    return acc;
  }, {});

  return {
    ...a,
    machineState
  };
}

export function isBlockingLine(line: string) {
  return isAlarmRes(line) || isErrorRes(line) || isBlockingMessage(line);
}

export function getJobDuration(startTime: Date) {
  const now = new Date();
  const seconds = now.getTime() - startTime.getTime();
  const result = new Date(seconds).toISOString().slice(11, 19);

  return result;
}

export function getShouldWaitForNextOk(sentLine: string) {
  return [RUN_HOMING_CYCLE].includes(sentLine);
}
