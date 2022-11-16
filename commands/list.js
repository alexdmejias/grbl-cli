const { SerialPort } = require('serialport');
const { stdout } = require('process');

exports.list = async () => {
  (await SerialPort.list()).forEach((port, index) => {
    stdout.write(`${index + 1}. ${port.path}\n`);
  });
};
