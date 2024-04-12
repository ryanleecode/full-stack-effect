import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ObjectStorageClient } from '@full-stack-effect/services';
import { Context, Effect } from 'effect';
import { UnknownException } from 'effect/Cause';

export class S3BucketContext extends Context.Tag('S3BucketContext')<
	S3BucketContext,
	{ client: S3Client; bucketName: string }
>() {}

export const objectStorageClient: Effect.Effect<ObjectStorageClient, UnknownException, S3BucketContext> = Effect.gen(
	function*(_) {
		const ctx = yield* _(S3BucketContext);

		function getObject(key: string, transform: 'string'): Effect.Effect<string, UnknownException, never>;
		function getObject(key: string, transform: 'binary'): Effect.Effect<Uint8Array, UnknownException, never>;
		function getObject(key: string, transform: 'string' | 'binary') {
			return Effect.gen(function*(_) {
				const cmd = new GetObjectCommand({
					Bucket: ctx.bucketName,
					Key: key,
				});

				const content = yield* _(Effect.tryPromise(async (abortSignal) => {
					const resp = await ctx.client.send(cmd, { abortSignal });
					if (!resp.Body) throw new Error('No body in response');

					switch (transform) {
						case 'string':
							return resp.Body.transformToString();
						case 'binary':
							return resp.Body.transformToByteArray();
					}
				}));

				return content;
			});
		}

		return {
			getObject,
		};
	},
);
