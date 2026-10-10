package com.posapps.crypto

import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

private const val MAX_ITERATIONS = 2_000_000

class CryptoCodedException(code: String, message: String) : CodedException(code, message, null)

/**
 * PBKDF2-HMAC-SHA256 on the JVM. The same derivation in pure JS on Hermes takes minutes; here it
 * takes milliseconds. Output matches `@noble/hashes` pbkdf2 (and the API's `node:crypto` hashes).
 */
class PosCryptoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PosCrypto")

    // Runs off the JS thread, so the PIN pad stays responsive.
    AsyncFunction("pbkdf2") { password: String, saltB64: String, iterations: Int, dkLen: Int ->
      if (password.isEmpty() || iterations < 1 || iterations > MAX_ITERATIONS || dkLen < 1) {
        throw CryptoCodedException("ERR_PBKDF2_PARAMS", "Invalid PBKDF2 parameters")
      }
      val salt = Base64.decode(saltB64, Base64.DEFAULT)
      Base64.encodeToString(pbkdf2(password.toByteArray(Charsets.UTF_8), salt, iterations, dkLen), Base64.NO_WRAP)
    }
  }

  private fun pbkdf2(password: ByteArray, salt: ByteArray, iterations: Int, dkLen: Int): ByteArray {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(password, "HmacSHA256"))
    val hLen = mac.macLength
    val blocks = (dkLen + hLen - 1) / hLen
    val out = ByteArray(blocks * hLen)
    for (block in 1..blocks) {
      mac.update(salt)
      mac.update(byteArrayOf((block ushr 24).toByte(), (block ushr 16).toByte(), (block ushr 8).toByte(), block.toByte()))
      var u = mac.doFinal()
      val t = u.copyOf()
      for (i in 1 until iterations) {
        u = mac.doFinal(u)
        for (j in t.indices) t[j] = (t[j].toInt() xor u[j].toInt()).toByte()
      }
      System.arraycopy(t, 0, out, (block - 1) * hLen, hLen)
    }
    return out.copyOf(dkLen)
  }
}
