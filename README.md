# grbl-cli

# WORK IN PROGRESS

- use at your own risk
- not tested with any other machine other than my own
- has bugs
- does not have tests
- wrote in a single day, so the code is not pretty
- not a proper npm module yet

# What is this?

A WIP CLI way to send files to your GRBL machine. Clone, `npm install`, and run `node index.js help`

# Next

- clean up
  - remove all the state variables from Machine and FileLinesQueue
  - better status parsing
- initial and final gcode steps
- tests
  - unit
  - test with large files
  - test with esp32
- split up main file
- more efficiently read gcode file
- pass more CLI params (baudrate, whether to home, etc)
- config file
- global npm module and/or executables
- migrate to TS/Deno
