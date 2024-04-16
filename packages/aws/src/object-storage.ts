import * as S3 from '@aws-sdk/client-s3';
import { ObjectStorage } from '@full-stack-effect/services';
import { type Cause, Context, Effect, Layer } from 'effect';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { toMillis, type DurationInput, millis } from 'effect/Duration';

export class S3Client extends Context.Tag('s3/S3Client')<
  S3Client,
  S3.S3Client
>() {}

export class S3Config extends Context.Tag('s3/S3Config')<
  S3Config,
  {
    readonly region?: string;
    readonly bucketName: string;
  }
>() {}

export const PRESIGNED_EXPIRES_IN_DEFAULT = millis(3600);

const makeObjectStorageClient = Effect.gen(function* (_) {
  const ctx = yield* _(S3Config);
  const s3 = yield* _(S3Client);

  function getObject(
    key: string,
    transform?: 'string',
  ): Effect.Effect<string, Cause.UnknownException, never>;
  function getObject(
    key: string,
    transform?: 'binary',
  ): Effect.Effect<Uint8Array, Cause.UnknownException, never>;
  function getObject(
    key: string,
    transform: 'string' | 'binary' = 'string',
  ): Effect.Effect<string | Uint8Array, Cause.UnknownException, never> {
    return Effect.tryPromise(async (abortSignal) => {
      const cmd = new S3.GetObjectCommand({
        Bucket: ctx.bucketName,
        Key: key,
      });

      const resp = await s3.send(cmd, { abortSignal });
      if (!resp.Body) throw new Error('No body in response');

      switch (transform) {
        case 'string':
          return resp.Body.transformToString();
        case 'binary':
          return resp.Body.transformToByteArray();
      }
    }).pipe(Effect.withSpan('getObject'));
  }

  function putObject(
    key: string,
    body: string | Uint8Array | ReadableStream,
  ): Effect.Effect<void, Cause.UnknownException, never> {
    return Effect.tryPromise(async (abortSignal) => {
      const cmd = new S3.PutObjectCommand({
        Bucket: ctx.bucketName,
        Key: key,
        Body: body,
      });

      await s3.send(cmd, { abortSignal });
    }).pipe(Effect.withSpan('putObject'));
  }

  const getPresignedUrl = (
    key: string,
    expiresIn: DurationInput = PRESIGNED_EXPIRES_IN_DEFAULT,
  ) => {
    const cmd = new S3.GetObjectCommand({
      Bucket: ctx.bucketName,
      Key: key,
    });

    return Effect.tryPromise(() =>
      getSignedUrl(s3, cmd, { expiresIn: toMillis(expiresIn) }),
    ).pipe(
      Effect.map((url) => new URL(url)),
      Effect.withSpan('getPresignedUrl'),
    );
  };

  return {
    getObject,
    putObject,
    getPresignedUrl,
  };
}).pipe(Effect.withSpan('makeObjectStorageClient'));

export const Live: Layer.Layer<ObjectStorage, never, S3Client | S3Config> =
  Layer.effect(ObjectStorage, makeObjectStorageClient);
