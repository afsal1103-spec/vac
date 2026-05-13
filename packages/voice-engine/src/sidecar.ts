import { EventEmitter } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

type SidecarMessage = Record<string, unknown>;

export class VoiceSidecar extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = '';

  start(command: string, args: string[], cwd: string) {
    if (this.child) return;

    this.child = spawn(command, args, { cwd, stdio: 'pipe' });

    this.child.on('error', (error) => {
      this.emit('error', error instanceof Error ? error.message : String(error));
    });

    this.child.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      this.flushLines();
    });

    this.child.stderr.on('data', (chunk) => {
      this.emit('stderr', chunk.toString('utf8'));
    });

    this.child.on('exit', (code, signal) => {
      this.emit('exit', { code, signal });
      this.child = null;
    });
  }

  send(message: SidecarMessage) {
    if (!this.child) throw new Error('Voice sidecar is not running.');
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  stop() {
    if (!this.child) return;
    this.child.kill();
    this.child = null;
  }

  isRunning(): boolean {
    return this.child !== null;
  }

  private flushLines() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as SidecarMessage;
        this.emit('message', parsed);
      } catch {
        this.emit('stderr', `Unparseable sidecar line: ${line}`);
      }
    }
  }
}
