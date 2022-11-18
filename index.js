#! /usr/bin/env node

import { Command } from 'commander';

import { list, send } from './scripts/index.js';

async function main() {
  const program = new Command();

  program
    .name('grbl sender')
    .description('CLI to some JavaScript string utilities')
    .version('0.1.0');

  program.command('list').description('').action(list);

  program
    .command('send')
    .description('stream a file')
    .requiredOption('-f, --file <file path>', 'The path of the file to send')
    .option('-p, --port <machine port>', 'The port of the machine')
    .option('-v, --verbose', 'Verbose mode')
    // TODO pass baud rate
    .action(send);

  program.parse();
}

main();
