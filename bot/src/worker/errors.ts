export class NeedsReviewError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'NeedsReviewError';
  }
}

export class RepoNotReadyError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'RepoNotReadyError';
  }
}

export class AgentError extends Error {
  constructor(
    message: string,
    readonly logPath: string,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class GateError extends Error {
  constructor(
    message: string,
    readonly logPath: string,
  ) {
    super(message);
    this.name = 'GateError';
  }
}

export class PostMergeError extends Error {
  constructor(
    message: string,
    readonly reverted: boolean,
  ) {
    super(message);
    this.name = 'PostMergeError';
  }
}

export class PushError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PushError';
  }
}
