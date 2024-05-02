import {
  type EventFilter,
  isTriggerError,
  type IO as IO_,
  type IOTask,
  type Json,
  type RunTaskOptions,
  type WaitForEventResult,
} from '@trigger.dev/sdk';
import { Effect, Runtime, Context, pipe, Cause } from 'effect';
import { UnknownException } from 'effect/Cause';
import type { AsyncReturnType } from 'type-fest';
import type { z } from 'zod';

export class IO extends Context.Tag('IO')<IO, IO_>() {}

type GuardType<T> = T extends (x: any, ...rest: any) => x is infer U
  ? U
  : never;

type TriggerInternalError = GuardType<typeof isTriggerError>;

export const runTask = <T extends Json<T>, E = never, R = never>(
  cacheKey: string,
  effect: (task: IOTask) => Effect.Effect<T, E | TriggerInternalError, R>,
  options?: RunTaskOptions & {
    parseOutput?: (output: unknown) => T;
  },
): Effect.Effect<T, TriggerInternalError | E, IO | R> => {
  return Effect.gen(function* (_) {
    const io = yield* IO;
    const runPromise = yield* pipe(
      Effect.runtime<R>(),
      Effect.andThen(Runtime.runPromise),
    );

    return yield* Effect.async<T, E | TriggerInternalError, R>((resume) => {
      io.runTask(
        cacheKey,
        (t) =>
          pipe(
            effect(t),
            Effect.withSpan(`task.run/${cacheKey}`),
            Effect.tapErrorCause((cause) =>
              Effect.sync(() => {
                const squashed = Cause.squash(cause);
                if (isTriggerError(squashed)) {
                  resume(Effect.fail(squashed));
                } else {
                  resume(Effect.failCause(cause));
                }
              }),
            ),
            runPromise,
          ),
        options,
      ).then(
        (value) => {
          resume(Effect.succeed(value));
        },
        (err) => {
          if (isTriggerError(err)) {
            resume(Effect.fail(err));
          }
        },
      );
    });
  });
};

export const waitForEvent = <T extends z.ZodTypeAny = z.ZodTypeAny>(
  cacheKey: string,
  event: {
    name: string;
    schema: T;
    filter?: EventFilter;
    source?: string;
    contextFilter?: EventFilter;
    accountId?: string;
  },
  options?: {
    timeoutInSeconds?: number;
  },
): Effect.Effect<
  WaitForEventResult<z.output<T>>,
  TriggerInternalError | UnknownException,
  IO
> => {
  type Result = WaitForEventResult<z.output<T>>;
  return Effect.gen(function* (_) {
    const io = yield* IO;
    const result = yield* Effect.async<
      Result,
      TriggerInternalError | UnknownException
    >((resume) => {
      io.waitForEvent(cacheKey, event, options).then(
        (value) => {
          resume(Effect.succeed(value));
        },
        (err) => {
          if (isTriggerError(err)) {
            resume(Effect.fail(err));
          } else {
            resume(
              Effect.fail(new UnknownException(err, 'wait for event failed')),
            );
          }
        },
      );
    });

    return result;
  }).pipe(Effect.withSpan(`event.wait/${cacheKey}`));
};

export const sendEvent = (
  cacheKey: string,
  event: Parameters<InstanceType<typeof IO_>['sendEvent']>[1],
  options?: Parameters<InstanceType<typeof IO_>['sendEvent']>[2],
): Effect.Effect<
  AsyncReturnType<InstanceType<typeof IO_>['sendEvent']>,
  UnknownException | TriggerInternalError,
  IO
> => {
  return Effect.gen(function* (_) {
    const io = yield* IO;
    const sendEvent = () => io.sendEvent(cacheKey, event, options);
    const result = yield* Effect.async<
      AsyncReturnType<typeof sendEvent>,
      UnknownException | TriggerInternalError
    >((resume) => {
      sendEvent().then(
        (value) => {
          resume(Effect.succeed(value));
        },
        (err) => {
          if (isTriggerError(err)) {
            resume(Effect.fail(err));
          } else {
            resume(Effect.fail(new UnknownException(err, 'send event failed')));
          }
        },
      );
    });

    return result;
  }).pipe(Effect.withSpan(`event.send/${cacheKey}`));
};
