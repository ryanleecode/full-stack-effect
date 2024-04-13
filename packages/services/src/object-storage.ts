import type { Effect } from 'effect';
import type { UnknownException } from 'effect/Cause';

namespace ObjectStorageClient {
  export declare function getObject(
    key: string,
    transform?: 'string',
  ): Effect.Effect<string, UnknownException, never>;
  export declare function getObject(
    key: string,
    transform: 'binary',
  ): Effect.Effect<Uint8Array, UnknownException, never>;
}

export type ObjectStorageClient = typeof ObjectStorageClient;
