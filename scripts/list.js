import { SerialPort } from 'serialport';
import { stdout } from 'process';

export async function list() {
  (await SerialPort.list()).forEach((port, index) => {
    stdout.write(`${index + 1}. ${port.path}\n`);
  });
}
