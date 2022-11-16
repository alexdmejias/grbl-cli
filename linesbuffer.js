const fs = require('fs/promises');

const { exit } = require('process');

class LinesBuffer {
  constructor({ initCommands, endCommands, files }) {
    this.initCommands = initCommands;
    this.endCommands = endCommands;
    this.files = files;
    this.buffer = [];
  }

  async fillBuffer() {
    const linesFromFiles = await this.linesFromFiles();
    this.buffer = [
      '; starting init commands',
      ...this.initCommands,
      '; finished init commands',
      '; starting file commands',
      ...linesFromFiles,
      '; finished file commands',
      '; starting end commands',
      ...this.endCommands,
      '; finished end commands'
    ];
  }

  async linesFromFiles() {
    if (Array.isArray(this.files)) {
      console.log('!!!!!!!!', 'TODO');
      exit(1);
    } else {
      return this.readFile(this.files);
    }
  }

  async readFile(path) {
    return (await fs.readFile(path, 'utf-8')).split('\n');
  }

  peek(n = 0) {
    return this.buffer[n];
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

exports.LinesBuffer = LinesBuffer;
