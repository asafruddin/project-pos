const { withAndroidManifest } = require("expo/config-plugins");

/** Keep BLUETOOTH_SCAN from requesting location, and cap legacy Bluetooth perms at API 30. */
function withBluetoothPrinter(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const uses = manifest["uses-permission"] ?? [];
    function setPermission(name, extra) {
      let entry = uses.find((item) => item.$["android:name"] === name);
      if (!entry) {
        entry = { $: { "android:name": name } };
        uses.push(entry);
      }
      Object.assign(entry.$, extra);
    }
    setPermission("android.permission.BLUETOOTH", { "android:maxSdkVersion": "30" });
    setPermission("android.permission.BLUETOOTH_ADMIN", { "android:maxSdkVersion": "30" });
    setPermission("android.permission.BLUETOOTH_CONNECT", {});
    setPermission("android.permission.BLUETOOTH_SCAN", { "android:usesPermissionFlags": "neverForLocation" });
    manifest["uses-permission"] = uses;
    return mod;
  });
}

module.exports = withBluetoothPrinter;
