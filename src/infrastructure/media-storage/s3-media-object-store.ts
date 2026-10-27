import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import type { MediaStorageNamespace } from "./media-object-store.types.js";
import type {
  MediaObjectGetResult,
  MediaObjectStore,
  PutMediaObjectInput,
} from "./media-object-store.types.js";
import { MediaStorageError } from "./media-storage.errors.js";
import { buildS3ObjectKey } from "./storage-key.js";

export type S3MediaObjectStoreOptions = {
  client: S3Client;
  bucket: string;
  namespace: MediaStorageNamespace;
  keyPrefix?: string;
  requestTimeoutMs: number;
  maxRetries: number;
};

function isRetryableS3Error(statusCode: number | undefined): boolean {
  if (statusCode === undefined) {
    return true;
  }
  if (statusCode === 429) {
    return true;
  }
  return statusCode >= 500;
}

function mapAwsError(err: unknown): MediaStorageError {
  const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
  const status =
    err && typeof err === "object" && "$metadata" in err
      ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;

  if (name === "NotFound" || status === 404) {
    return new MediaStorageError("NOT_FOUND", "Object not found");
  }
  if (name === "AccessDenied" || status === 403) {
    return new MediaStorageError("ACCESS_DENIED", "Object access denied");
  }
  if (name === "TimeoutError") {
    return new MediaStorageError("TIMEOUT", "Object storage request timed out", {
      retryable: true,
    });
  }
  if (isRetryableS3Error(status)) {
    return new MediaStorageError("UNAVAILABLE", "Object storage temporarily unavailable", {
      retryable: true,
    });
  }
  return new MediaStorageError("INTERNAL", "Object storage operation failed");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new MediaStorageError("TIMEOUT", "Object storage request timed out", {
              retryable: true,
            }),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof body === "object" && body !== null && Symbol.asyncIterator in body) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new MediaStorageError("INTERNAL", "Unexpected object body stream");
}

export class S3MediaObjectStore implements MediaObjectStore {
  constructor(private readonly options: S3MediaObjectStoreOptions) {}

  objectKeyFor(storageKey: string): string {
    return buildS3ObjectKey(this.options.namespace, this.options.keyPrefix, storageKey);
  }

  private async executeIdempotent<T>(operation: () => Promise<T>): Promise<T> {
    const { maxRetries, requestTimeoutMs } = this.options;
    let attempt = 0;
    let lastError: unknown;
    while (attempt <= maxRetries) {
      attempt += 1;
      try {
        return await withTimeout(operation(), requestTimeoutMs);
      } catch (err) {
        lastError = err;
        const mapped = err instanceof MediaStorageError ? err : mapAwsError(err);
        if (!mapped.retryable || attempt > maxRetries) {
          throw mapped;
        }
      }
    }
    throw lastError instanceof Error ? lastError : mapAwsError(lastError);
  }

  async putObject(input: PutMediaObjectInput): Promise<void> {
    const Key = this.objectKeyFor(input.storageKey);
    const command = new PutObjectCommand({
      Bucket: this.options.bucket,
      Key,
      Body: input.body,
      ContentType: input.contentType,
    });
    try {
      await withTimeout(this.options.client.send(command), this.options.requestTimeoutMs);
    } catch (err) {
      throw err instanceof MediaStorageError ? err : mapAwsError(err);
    }
  }

  async getObject(storageKey: string): Promise<MediaObjectGetResult> {
    const Key = this.objectKeyFor(storageKey);
    return this.executeIdempotent(async () => {
      try {
        const response = await this.options.client.send(
          new GetObjectCommand({ Bucket: this.options.bucket, Key }),
        );
        const body = await streamToBuffer(response.Body);
        return { body, contentType: response.ContentType };
      } catch (err) {
        throw mapAwsError(err);
      }
    });
  }

  async deleteObject(storageKey: string): Promise<void> {
    const Key = this.objectKeyFor(storageKey);
    await this.executeIdempotent(async () => {
      try {
        await this.options.client.send(
          new DeleteObjectCommand({ Bucket: this.options.bucket, Key }),
        );
      } catch (err) {
        throw mapAwsError(err);
      }
    });
  }

  async objectExists(storageKey: string): Promise<boolean> {
    const Key = this.objectKeyFor(storageKey);
    try {
      await this.executeIdempotent(async () => {
        await this.options.client.send(new HeadObjectCommand({ Bucket: this.options.bucket, Key }));
      });
      return true;
    } catch (err) {
      if (err instanceof MediaStorageError && err.code === "NOT_FOUND") {
        return false;
      }
      throw err;
    }
  }
}
