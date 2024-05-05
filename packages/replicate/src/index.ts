import type Replicate from 'replicate';
import { Context, Effect, type Cause } from 'effect';

export class ReplicateConfig extends Context.Tag('replicate/config')<
  ReplicateConfig,
  {
    client: Replicate;
  }
>() {}

type ReplicateRunParams = Parameters<InstanceType<typeof Replicate>['run']>;

export type RunParams = {
  identifier: ReplicateRunParams[0];
  options: Omit<ReplicateRunParams[1], 'signal'>;
  progress?: ReplicateRunParams[2];
};

export const run = ({
  identifier,
  options,
  progress,
}: RunParams): Effect.Effect<
  object,
  Cause.UnknownException,
  ReplicateConfig
> => {
  return Effect.gen(function* (_) {
    const { client } = yield* ReplicateConfig;
    const result = yield* Effect.tryPromise((signal) =>
      client.run(identifier, { ...options, signal }, progress),
    );

    return result;
  }).pipe(Effect.withSpan(`replicate.run/${identifier}`));
};
