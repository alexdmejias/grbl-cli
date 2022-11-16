const chalk = require('chalk');
const { exit } = require('process');

const { Machine } = require('../machine');
const { LinesBuffer } = require('../linesbuffer');
const { RUN_HOMING_CYCLE } = require('../commands');
const { isOkRes, isStatusRes } = require('../responseParsing');
const {
  isBlockingLine,
  getJobDuration,
  getShouldWaitForNextOk,
  validateFile,
  validatePort,
  getPort
} = require('../utils');

exports.send = async ({ filePath, port, verbose }) => {
  await validateFile(filePath);
  await validatePort(port);

  const [serialPort, parser] = await getPort(port);
  const m = new Machine({
    port: serialPort,
    verbose
  });

  const lb = new LinesBuffer({
    initCommands: ['?', RUN_HOMING_CYCLE],
    endCommands: [
      /* 'G91 X10' */
    ],
    files: filePath
  });
  await lb.fillBuffer();

  let jobStartTime;
  let lineCounter = 0;

  // let prevCodeBlock;
  let shouldWaitForNextOk = false;
  let reportSenderInterval;

  parser.on('data', async (line) => {
    if (verbose) {
      if (isStatusRes(line)) {
        console.log(chalk.gray(line));
      } else {
        console.log(chalk.green('RX::', line));
      }
    }

    if (!jobStartTime) {
      jobStartTime = new Date();
    }

    if (isOkRes(line) && shouldWaitForNextOk) {
      console.log('!!!!!!!!', 'shouldWaitForNextOk now set to FALSE');
      shouldWaitForNextOk = false;
    }

    m.parseMessage(line, lineCounter);

    if (shouldWaitForNextOk) {
      if (!isStatusRes(line)) {
        console.log('!!!!!!!!', 'shouldWaitForNextOk is TRUE so ignoring the received line', line);
      }
      return;
    }

    const nextGcodeLine = lb.advance();

    // initiate a timer to keep sending status requests
    // if (!reportSenderInterval) {
    //   reportSenderInterval = setInterval(() => {
    //     m.sendCommand(STATUS);
    //   }, 250);
    // }

    if (isBlockingLine(line) || lb.done()) {
      clearInterval(reportSenderInterval);

      if (lb.done()) {
        console.log('!!!!!!!!', 'ran out of gcode');
      } else {
        console.log('!!!!!!!!', 'found blocking line');
      }
      lb.clearBuffer();

      console.log(`job ran for: ${getJobDuration(jobStartTime)}`);
      exit(0);
    }

    // shouldWaitForNextOk()?

    // setTimeout(() => {
    if (!shouldWaitForNextOk) {
      m.sendCommand(nextGcodeLine);
      shouldWaitForNextOk = true;
      console.log('!!!!!!!!1', 'shouldWaitForNextOk now set to TRUE because line:', nextGcodeLine);
    }
    // }, 100);

    if (getShouldWaitForNextOk(nextGcodeLine)) {
      console.log('!!!!!!!!', 'shouldWaitForNextOk now set to TRUE');
      shouldWaitForNextOk = true;
      // } else {
      //   shouldWaitForNextOk = false;
    }

    // if (prevCodeBlock !== m.currentGCodeBlock) {
    //   lineCounter = 0;
    // } else {
    //   lineCounter++;
    // }

    // prevCodeBlock = m.currentGCodeBlock;
    // }
  });
};
