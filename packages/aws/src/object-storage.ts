import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { ObjectStorageClient } from '@full-stack-effect/services';
import { Effect } from 'effect';
import type { UnknownException } from 'effect/Cause';

export type S3Context = { client: S3Client; bucketName: string };

const ObjectStorageClient_ = (ctx: S3Context): ObjectStorageClient => {
  function getObject(
    key: string,
    transform?: 'string',
  ): Effect.Effect<string, UnknownException, never>;
  function getObject(
    key: string,
    transform?: 'binary',
  ): Effect.Effect<Uint8Array, UnknownException, never>;
  function getObject(
    key: string,
    transform: 'string' | 'binary' = 'string',
  ): Effect.Effect<string | Uint8Array, UnknownException, never> {
    return Effect.tryPromise(async (abortSignal) => {
      const cmd = new GetObjectCommand({
        Bucket: ctx.bucketName,
        Key: key,
      });

      const resp = await ctx.client.send(cmd, { abortSignal });
      if (!resp.Body) throw new Error('No body in response');

      switch (transform) {
        case 'string':
          return resp.Body.transformToString();
        case 'binary':
          return resp.Body.transformToByteArray();
      }
    });
  }

  return {
    getObject,
  };
};

export { ObjectStorageClient_ as ObjectStorageClient };
