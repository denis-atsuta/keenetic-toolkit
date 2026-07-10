import { md5 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * Derived credential stored instead of the raw password.
 *
 * The realm is the device model string (e.g. "Keenetic Ultra") and is stable
 * for a given router, so ha1 keeps working across sessions while the raw
 * password never touches storage.
 */
export function computeHa1(login: string, realm: string, password: string): string {
  return bytesToHex(md5(utf8ToBytes(`${login}:${realm}:${password}`)));
}

/** Response to the /auth challenge: sha256(challenge + ha1). */
export function challengeResponse(challenge: string, ha1: string): string {
  return bytesToHex(sha256(utf8ToBytes(challenge + ha1)));
}
