/**
 * @file Error for expected tool failures (unknown product, invalid
 * combination of arguments...). The server turns it into a tool result with
 * `isError: true`, so the agent reads the message and can try again.
 */
export class ToolError extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolError";
  }
}
