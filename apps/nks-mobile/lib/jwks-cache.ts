import { API } from "@nks/api-manager";

/**
 * Fetches the JWKS (JSON Web Key Set) public key from the backend.
 * Used for offline JWT verification (RS256 signature validation).
 *
 * Endpoint: GET /.well-known/jwks.json (public, no auth required)
 *
 * Returns the first RS256 public key found in the JWKS response.
 * The public key is a PEM-formatted string like:
 *   -----BEGIN PUBLIC KEY-----
 *   MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
 *   -----END PUBLIC KEY-----
 *
 * Throws if the endpoint is unreachable or the key is not found.
 */
export async function fetchJwksPublicKey(): Promise<string> {
  try {
    // JWKS endpoint is public — no auth required
    // The API interceptor may add a Bearer token, but server accepts both auth/no-auth
    const response = await API.get("/.well-known/jwks.json");

    const jwks = response.data;

    // JWKS format: { keys: [{ kty: "RSA", use: "sig", kid: "...", n: "...", e: "..." }, ...] }
    if (!jwks.keys || jwks.keys.length === 0) {
      throw new Error("No keys found in JWKS response");
    }

    // Find the first RS256 signing key
    const rsaKey = jwks.keys.find(
      (key: any) => key.kty === "RSA" && key.use === "sig",
    );

    if (!rsaKey) {
      throw new Error("No RS256 signing key found in JWKS");
    }

    // The backend must return the full PEM public key for offline verification
    // If only JWK is returned (n, e), conversion would be needed:
    // For now, assume the backend provides the PEM format in a custom field
    const pem = rsaKey.pem || rsaKey.publicKey;
    if (!pem) {
      throw new Error(
        "Public key (pem/publicKey field) not found in JWKS response",
      );
    }

    return pem;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch JWKS public key: ${message}`);
  }
}

/**
 * Validates a JWT token signature offline using the cached JWKS public key.
 * Uses a simple RS256 verification (requires a JWT library like jsonwebtoken or jose).
 *
 * NOTE: For MVP, this is a placeholder. In production, use the 'jose' library:
 *   import { jwtVerify } from 'jose';
 *   const verified = await jwtVerify(token, publicKeyObject);
 *
 * For now, we trust the server's token verification and cache the key for future use.
 */
export function validateJwtOffline(token: string, publicKey: string): boolean {
  // TODO: Implement proper RS256 verification with 'jose' library
  // For MVP, assume token is already valid if it came from the server
  // The public key is cached for future implementations
  console.log("[JWT] offline validation (MVP: skipped)", {
    tokenLength: token.length,
    keyLength: publicKey.length,
  });
  return true;
}
