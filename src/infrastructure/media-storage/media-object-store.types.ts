import type { AvatarStoredContentType } from "../../modules/profile-media/avatar.constants.js";

export type MediaStorageNamespace =
  | "profile"
  | "activity-cover"
  | "group-cover"
  | "group-content"
  | "store-product";

export type PutMediaObjectInput = {
  /** Logical storage key persisted in the database (never from client input). */
  storageKey: string;
  body: Buffer;
  contentType: AvatarStoredContentType;
};

export type MediaObjectGetResult = {
  body: Buffer;
  contentType?: string;
};

/** Private object store boundary (local disk or S3-compatible). */
export interface MediaObjectStore {
  putObject(input: PutMediaObjectInput): Promise<void>;
  getObject(storageKey: string): Promise<MediaObjectGetResult>;
  deleteObject(storageKey: string): Promise<void>;
  objectExists(storageKey: string): Promise<boolean>;
}

export type StoredMediaObject = {
  storageKey: string;
};
