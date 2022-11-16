const chalk = require('chalk');
const { exit } = require('process');

const { Machine } = require('../machine');
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
    file: filePath,
    port: serialPort,
    verbose,
    initCommands: ['??', RUN_HOMING_CYCLE],
    endCommands: [
      /* 'G91 X10' */
    ]
  });

  await m.fillBuffer();
  let jobStartTime;
  let lineCounter = 0;
  let commandsBuffer = m.getCommand();

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

    if (isOkRes(line)) {
      console.log('!!!!!!!!', 'shouldWaitForNextOk set to FALSE');
      shouldWaitForNextOk = false;
    }

    m.parseMessage(line, lineCounter);

    if (shouldWaitForNextOk) {
      console.log('!!!!!!!!', 'shouldWaitForNextOk is TRUE so ignoring the received line', line);
      return;
    }

    const nextGcodeLine = commandsBuffer.next();

    // initiate a timer to keep sending status requests
    // if (!reportSenderInterval) {
    //   reportSenderInterval = setInterval(() => {
    //     m.sendCommand(STATUS);
    //   }, 250);
    // }

    if (isBlockingLine(line) || nextGcodeLine.done) {
      clearInterval(reportSenderInterval);

      if (nextGcodeLine.done) {
        console.log('!!!!!!!!', 'ran out of gcode');
      } else {
        console.log('!!!!!!!!', 'found blocking line');
      }
      commandsBuffer.return();

      console.log(`job ran for: ${getJobDuration(jobStartTime)}`);
      exit(0);
    }

    // shouldWaitForNextOk()?

    setTimeout(() => {
      if (!shouldWaitForNextOk) {
        m.sendCommand(nextGcodeLine.value);
      }
    }, 100);

    if (getShouldWaitForNextOk(nextGcodeLine.value)) {
      console.log('!!!!!!!!', 'shouldWaitForNextOk set to TRUE');
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
