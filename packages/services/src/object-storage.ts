import type { Cause, Effect } from 'effect';
import type { DurationInput } from 'effect/Duration';

export interface ObjectStorageClient {
  getObject(
    key: string,
    transform?: 'string',
  ): Effect.Effect<string, Cause.UnknownException, never>;
  getObject(
    key: string,
    transform: 'binary',
  ): Effect.Effect<Uint8Array, Cause.UnknownException, never>;

  putObject(
    key: string,
    body: string | Uint8Array | ReadableStream,
  ): Effect.Effect<void, Cause.UnknownException, never>;

  getPresignedUrl(
    key: string,
    expiresIn?: DurationInput,
  ): Effect.Effect<URL, Cause.UnknownException, never>;
}
