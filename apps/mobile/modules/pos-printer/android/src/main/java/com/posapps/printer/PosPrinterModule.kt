package com.posapps.printer

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.math.min

private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
private const val CHUNK = 1024
private const val CHUNK_GAP_MS = 20L

class PrinterCodedException(code: String, message: String) : CodedException(code, message, null)

class PosPrinterModule : Module() {
  private var socket: BluetoothSocket? = null
  private var lastAddress: String? = null
  private var aclReceiver: BroadcastReceiver? = null
  private val stayConnected = AtomicBoolean(false)
  private val printing = AtomicBoolean(false)
  private val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private var watchdog: Job? = null

  override fun definition() = ModuleDefinition {
    Name("PosPrinter")

    Events("onDisconnected")

    AsyncFunction("scan") { timeoutMs: Double ->
      runBlocking(Dispatchers.IO) { scanDevices(timeoutMs.toLong().coerceIn(1_000, 20_000)) }
    }

    AsyncFunction("connect") { address: String ->
      runBlocking(Dispatchers.IO) { connectTo(address) }
    }

    AsyncFunction("disconnect") {
      stayConnected.set(false)
      stopWatchdog()
      closeSocket()
    }

    AsyncFunction("setStayConnected") { enabled: Boolean ->
      stayConnected.set(enabled)
      if (enabled) {
        startWatchdog()
        val address = lastAddress
        if (address != null && socket?.isConnected != true) {
          runBlocking(Dispatchers.IO) {
            try {
              connectTo(address)
            } catch (_: Exception) {
            }
          }
        }
      } else {
        stopWatchdog()
        closeSocket()
      }
    }

    AsyncFunction("isConnected") {
      socket?.isConnected == true
    }

    AsyncFunction("print") { payloadB64: String ->
      runBlocking(Dispatchers.IO) { printPayload(payloadB64) }
    }

    OnDestroy {
      stayConnected.set(false)
      stopWatchdog()
      unwatchAcl()
      closeSocket()
      ioScope.cancel()
    }
  }

  private val appCtx: Context
    get() = appContext.reactContext?.applicationContext
      ?: throw PrinterCodedException("NO_CONTEXT", "App is not ready")

  @SuppressLint("MissingPermission")
  private fun adapter(): BluetoothAdapter {
    val manager = appCtx.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    return manager.adapter ?: throw PrinterCodedException("BT_UNAVAILABLE", "Bluetooth is not available")
  }

  @SuppressLint("MissingPermission")
  private fun deviceMap(device: BluetoothDevice, bonded: Boolean): Map<String, Any> {
    val name = try {
      device.name
    } catch (_: SecurityException) {
      null
    }
    return mapOf(
      "id" to device.address,
      "name" to (name?.takeIf { it.isNotBlank() } ?: device.address),
      "bonded" to bonded,
    )
  }

  @SuppressLint("MissingPermission")
  private suspend fun scanDevices(timeoutMs: Long): List<Map<String, Any>> {
    val adapter = adapter()
    if (!adapter.isEnabled) throw PrinterCodedException("BT_OFF", "Bluetooth is off")
    val found = LinkedHashMap<String, Map<String, Any>>()
    adapter.bondedDevices?.forEach { device ->
      found[device.address] = deviceMap(device, bonded = true)
    }
    if (!adapter.startDiscovery()) return found.values.toList()
    val filter = IntentFilter().apply {
      addAction(BluetoothDevice.ACTION_FOUND)
      addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
    }
    var receiver: BroadcastReceiver? = null
    try {
      withTimeout(timeoutMs) {
        suspendCancellableCoroutine<Unit> { cont ->
          receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
              when (intent.action) {
                BluetoothDevice.ACTION_FOUND -> {
                  extraDevice(intent)?.let { device ->
                    found[device.address] = deviceMap(
                      device,
                      bonded = device.bondState == BluetoothDevice.BOND_BONDED,
                    )
                  }
                }
                BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
                  if (cont.isActive) cont.resume(Unit) {}
                }
              }
            }
          }
          registerScanReceiver(receiver!!, filter)
          cont.invokeOnCancellation {
            adapter.cancelDiscovery()
          }
        }
      }
    } catch (_: TimeoutCancellationException) {
      adapter.cancelDiscovery()
    } finally {
      adapter.cancelDiscovery()
      receiver?.let { unregisterQuietly(it) }
    }
    return found.values.toList()
  }

  private fun extraDevice(intent: Intent): BluetoothDevice? {
    return if (Build.VERSION.SDK_INT >= 33) {
      intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
    }
  }

  private fun registerScanReceiver(receiver: BroadcastReceiver, filter: IntentFilter) {
    if (Build.VERSION.SDK_INT >= 33) {
      appCtx.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      appCtx.registerReceiver(receiver, filter)
    }
  }

  private fun unregisterQuietly(receiver: BroadcastReceiver) {
    try {
      appCtx.unregisterReceiver(receiver)
    } catch (_: Exception) {
    }
  }

  @Synchronized
  @SuppressLint("MissingPermission")
  private fun connectTo(address: String): Map<String, Any> {
    val adapter = adapter()
    if (!adapter.isEnabled) throw PrinterCodedException("BT_OFF", "Bluetooth is off")
    val device = try {
      adapter.getRemoteDevice(address)
    } catch (_: Exception) {
      throw PrinterCodedException("BT_BAD_ADDRESS", "Invalid printer address")
    }
    if (socket?.isConnected == true && address.equals(lastAddress, ignoreCase = true)) {
      return deviceMap(device, bonded = device.bondState == BluetoothDevice.BOND_BONDED)
    }
    closeSocket()
    adapter.cancelDiscovery()
    val opened = openSocket(adapter, device)
    socket = opened
    lastAddress = address
    stayConnected.set(true)
    watchAcl()
    startWatchdog()
    return deviceMap(device, bonded = device.bondState == BluetoothDevice.BOND_BONDED)
  }

  @SuppressLint("MissingPermission")
  private fun openSocket(adapter: BluetoothAdapter, device: BluetoothDevice): BluetoothSocket {
    adapter.cancelDiscovery()
    val candidates = listOf(
      { device.createRfcommSocketToServiceRecord(SPP_UUID) },
      { device.createInsecureRfcommSocketToServiceRecord(SPP_UUID) },
    )
    var last: Exception? = null
    for (factory in candidates) {
      val next = try {
        factory()
      } catch (error: Exception) {
        last = error
        continue
      }
      try {
        next.connect()
        return next
      } catch (error: Exception) {
        last = error
        try {
          next.close()
        } catch (_: Exception) {
        }
      }
    }
    throw PrinterCodedException("BT_CONNECT_FAILED", last?.message ?: "Could not connect to the printer")
  }

  @Synchronized
  private fun closeSocket() {
    try {
      socket?.close()
    } catch (_: Exception) {
    }
    socket = null
  }

  @SuppressLint("MissingPermission")
  private fun printPayload(payloadB64: String) {
    val bytes = try {
      Base64.decode(payloadB64, Base64.DEFAULT)
    } catch (_: Exception) {
      throw PrinterCodedException("BT_BAD_PAYLOAD", "Invalid print data")
    }
    printing.set(true)
    try {
      if (socket == null || socket?.isConnected != true) {
        val address = lastAddress ?: throw PrinterCodedException("NOT_CONNECTED", "Printer is not connected")
        connectTo(address)
      }
      val out = socket?.outputStream ?: throw PrinterCodedException("NOT_CONNECTED", "Printer is not connected")
      var offset = 0
      while (offset < bytes.size) {
        val n = min(CHUNK, bytes.size - offset)
        out.write(bytes, offset, n)
        out.flush()
        offset += n
        if (offset < bytes.size) Thread.sleep(CHUNK_GAP_MS)
      }
      // Give the printer time to consume the buffer without closing our SPP session.
      Thread.sleep(250)
    } finally {
      printing.set(false)
    }
    restoreConnection()
  }

  private fun watchAcl() {
    if (aclReceiver != null) return
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != BluetoothDevice.ACTION_ACL_DISCONNECTED) return
        val device = extraDevice(intent) ?: return
        if (!device.address.equals(lastAddress, ignoreCase = true)) return
        val current = socket ?: return
        try {
          current.close()
        } catch (_: Exception) {
        }
        socket = null
        sendEvent("onDisconnected", mapOf("address" to device.address))
        restoreConnection()
      }
    }
    aclReceiver = receiver
    registerScanReceiver(receiver, IntentFilter(BluetoothDevice.ACTION_ACL_DISCONNECTED))
  }

  private fun unwatchAcl() {
    val receiver = aclReceiver ?: return
    aclReceiver = null
    unregisterQuietly(receiver)
  }

  private fun startWatchdog() {
    if (watchdog?.isActive == true) return
    watchdog = ioScope.launch {
      while (stayConnected.get()) {
        delay(3_000)
        if (!stayConnected.get() || printing.get()) continue
        probeOrRestore()
      }
    }
  }

  private fun stopWatchdog() {
    watchdog?.cancel()
    watchdog = null
  }

  private fun restoreConnection() {
    if (!stayConnected.get() || printing.get()) return
    val address = lastAddress ?: return
    if (socket?.isConnected == true) return
    ioScope.launch {
      if (!stayConnected.get()) return@launch
      try {
        connectTo(address)
      } catch (_: Exception) {
        delay(1_500)
        if (stayConnected.get() && socket?.isConnected != true) {
          try {
            connectTo(address)
          } catch (_: Exception) {
          }
        }
      }
    }
  }

  private fun probeOrRestore() {
    if (!stayConnected.get() || printing.get()) return
    val address = lastAddress ?: return
    val current = socket
    if (current == null || current.isConnected != true) {
      restoreConnection()
      return
    }
    try {
      // NUL is ignored by ESC/POS; a failed write means the printer dropped the SPP session.
      current.outputStream.write(0)
      current.outputStream.flush()
    } catch (_: Exception) {
      closeSocket()
      restoreConnection()
    }
  }
}
