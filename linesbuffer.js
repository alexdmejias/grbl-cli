import { readFile } from 'fs/promises';

import { exit } from 'process';
import { isComment } from './responseParsing.js';

class LinesBuffer {
  constructor({ initCommands = [], endCommands = [], files }) {
    this.initCommands = initCommands;
    this.endCommands = endCommands;
    this.files = files;
    this.buffer = [];
  }

  async fillBuffer() {
    const linesFromFiles = await this.linesFromFiles();

    this.buffer = [];

    if (this.initCommands.length) {
      this.buffer = ['; starting init commands', ...this.initCommands, '; finished init commands'];
    }

    this.buffer.push('; starting file commands', ...linesFromFiles, '; finished file commands');

    if (this.endCommands.length) {
      this.buffer.push('; starting end commands', ...this.endCommands, '; finished end commands');
    }
  }

  async linesFromFiles() {
    if (Array.isArray(this.files)) {
      console.log('!!!!!!!!', 'TODO');
      exit(1);
    } else {
      return this.readFileAsArr(this.files);
    }
  }

  async readFileAsArr(path) {
    return (await readFile(path, 'utf-8')).split('\n');
  }

  peek(n = 0) {
    return this.buffer[n];
  }

  getNextRealLine() {
    let line;
    let acc = 0;

    while (!line) {
      if (!isComment(this.buffer[acc])) {
        line = this.buffer[acc];
        break;
      }
      acc++;
    }

    return line;
  }

  advance() {
    return this.buffer.shift();
  }

  done() {
    return !this.buffer.length;
  }

  clearBuffer() {
    this.buffer = undefined;
  }
}

const _LinesBuffer = LinesBuffer;
export { _LinesBuffer as LinesBuffer };
