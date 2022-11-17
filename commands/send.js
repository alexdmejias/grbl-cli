const chalk = require('chalk');
const { exit } = require('process');

const { Machine } = require('../machine');
const { LinesBuffer } = require('../linesbuffer');
const { RUN_HOMING_CYCLE, SOFT_RESET } = require('../commands');
const {
  isOkRes,
  isWelcomeRes,
  isStatusRes,
  isMessageRes,
  isAlarmRes,
  isErrorRes
} = require('../responseParsing');
const { validateFile, validatePort, getPort, parseStatusMessage } = require('../utils');

const { fromEvent, scan, filter, tap, share } = require('rxjs');

function parseMsg(line) {
  if (isOkRes(line)) {
    let a = { isOk: true };
    return a;
  }

  if (isWelcomeRes(line)) {
    return { isWelcome: true };
  }

  if (isMessageRes(line)) {
    if (line === `[MSG:'$H'|'$X' to unlock]`) {
      return { isLocked: true, isOk: false };
    } else {
      return {};
    }
  }

  if (isAlarmRes(line)) {
    return { isOk: false, isAlarm: true, killReason: 'alarm' };
  }

  if (isErrorRes(line)) {
    return { isOk: false, isError: true, killReason: 'error' };
  }

  if (isStatusRes(line)) {
    return parseStatusMessage(line);
  }
}

function startKillSequence(ob$, sendCommand, reason = 'unclear') {
  console.log(chalk.bgRed.bold.white('self destruction sequence because:', reason));

  exit(0);
  console.log(chalk.bgRed.bold.white('sending soft reset command'));
  // sendCommand(SOFT_RESET);
  console.log(chalk.bgRed.bold.white('unsubscribing from oberserver'));
  ob$.unsubscribe();
  console.log(chalk.bgRed.bold.white('sending exit command'));
}

exports.send = async ({ filePath, port, verbose }) => {
  await validateFile(filePath);
  await validatePort(port);

  const [serialPort, parser] = await getPort(port);
  const m = new Machine({
    port: serialPort,
    verbose
  });

  const lb = new LinesBuffer({
    initCommands: ['?', SOFT_RESET, RUN_HOMING_CYCLE],
    endCommands: ['G91 X10'],
    files: filePath
  });
  await lb.fillBuffer();

  const source = fromEvent(parser, 'data');
  const multicasted$ = source.pipe(share());

  multicasted$.pipe(filter(isStatusRes)).subscribe((line) => {
    console.log(chalk.bold.gray(line));
  });

  const ob$ = multicasted$
    .pipe(
      filter((line) => !isStatusRes(line)),
      tap((line) => {
        console.log(chalk.green('RX::', line));
      }),
      scan((acc, curr) => Object.assign({}, acc, parseMsg(curr)), {}),
      tap((state) => {
        if (state.killReason || state.isError) {
          startKillSequence(ob$, m.sendCommand, state.killReason || 'unknown reason');
        } else if (lb.done()) {
          startKillSequence(ob$, m.sendCommand, 'DONE');
        }
      }),
      tap((parsedLine) => {
        m.setMachineState(parsedLine);
      }),
      tap((state) => {
        if (state.isOk && m.hasPendingSideEffects()) {
          m.applyPendingSideEffects();
        }
      })
    )
    .subscribe({
      next: (event) => {
        // console.log(chalk.gray(JSON.stringify(event)));

        // TODO is this needed? it's not getting used
        if (event.isWelcome && event.isError && event.isAlarm) {
          startKillSequence(ob$, m.sendCommand, '1');
        } else {
          const gcodeToSend = lb.advance();
          m.sendCommand(gcodeToSend);
        }
      },
      error: (error) => startKillSequence(ob$, m.sendCommand, `error: ${error}`),
      complete: () => {
        startKillSequence(ob$, m.sendCommand, 'COMPLETE');
      }
    });
};
