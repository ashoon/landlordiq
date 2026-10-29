/**
 * attachments.js — shared glue for files attached to records (contract scans, receipts).
 *
 * The files themselves live on the user's Google Drive (see driveSync.js); the records only keep a
 * small reference `{ id, name, mimeType, uploadedAt }`. This module checks and shrinks the picked
 * file, uploads it, and adds / removes references on a list of references.
 */
import { uploadAttachment, trashAttachment } from './driveSync.js'
import { t } from './i18n.js'

export { isUploadAvailable, openAttachment, trashAttachment, getStatus, subscribeStatus } from './driveSync.js'

/** Largest file accepted, in bytes (applies after photos are shrunk). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024
/** Photos are scaled down so the longest side is at most this many pixels. */
const MAX_IMAGE_SIDE = 1600
const JPEG_QUALITY = 0.8

/** The `accept` value for file inputs: photos and PDFs (phones offer the camera for images). */
export const ACCEPTED_TYPES = 'image/*,application/pdf'

/**
 * Checks a picked file.
 *
 * @param {File} file
 * @returns {string} an English error message, or '' when the file is fine
 */
export function validateAttachment(file) {
  if (!file) return 'Choose a file first.'
  const isImage = file.type.startsWith('image/')
  if (!isImage && file.type !== 'application/pdf') return 'Only photos and PDF files can be attached.'
  if (!isImage && file.size > MAX_FILE_BYTES) return 'That file is too large (10 MB maximum).'
  return ''
}

/** Replaces the extension of a file name. */
function withExtension(name, extension) {
  const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name
  return `${base}.${extension}`
}

/** Scales a photo down to JPEG, or returns it unchanged if it cannot be decoded. */
async function shrinkImage(file) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return { blob: file, name: file.name }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    return blob ? { blob, name: withExtension(file.name, 'jpg') } : { blob: file, name: file.name }
  } catch {
    return { blob: file, name: file.name }
  }
}

/**
 * Shrinks (photos only) and uploads a file to Drive.
 *
 * @param {File} file
 * @param {'contracts'|'receipts'} kind
 * @returns {Promise<{ id: string, name: string, mimeType: string, uploadedAt: string }>} the reference to store
 * @throws {Error} with an English message when the file is rejected or too large
 */
export async function uploadFile(file, kind) {
  const problem = validateAttachment(file)
  if (problem) throw new Error(problem)
  const { blob, name } = file.type.startsWith('image/') ? await shrinkImage(file) : { blob: file, name: file.name }
  if (blob.size > MAX_FILE_BYTES) throw new Error('That file is too large (10 MB maximum).')
  return uploadAttachment(blob, name, kind)
}

/**
 * Returns a copy of a list of references with one added.
 *
 * @param {Array<object> | undefined} list
 * @param {object} ref
 * @returns {Array<object>}
 */
export function withAttachment(list, ref) {
  return [...(list ?? []), ref]
}

/**
 * Returns a copy of a list of references without the one with this Drive file id.
 *
 * @param {Array<object> | undefined} list
 * @param {string} fileId
 * @returns {Array<object>}
 */
export function withoutAttachment(list, fileId) {
  return (list ?? []).filter((ref) => ref.id !== fileId)
}

/**
 * Moves the Drive files behind a list of references to the trash (best effort, never throws).
 *
 * @param {Array<{ id: string }> | undefined} list
 * @returns {void}
 */
export function trashAttachments(list) {
  for (const ref of list ?? []) trashAttachment(ref.id)
}

/**
 * Describes a failed upload / open in the current language.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function describeAttachmentError(error) {
  const known = error?.message && !/^\d{3}$/.test(error.message) ? error.message : ''
  return known ? t(known) : t('Could not reach Google Drive. Try again.')
}
