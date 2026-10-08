module.exports = {
  Platform: { OS: "android", Version: 34 },
  PermissionsAndroid: {
    PERMISSIONS: {
      BLUETOOTH_SCAN: "android.permission.BLUETOOTH_SCAN",
      BLUETOOTH_CONNECT: "android.permission.BLUETOOTH_CONNECT",
      ACCESS_FINE_LOCATION: "android.permission.ACCESS_FINE_LOCATION",
    },
    RESULTS: { GRANTED: "granted", DENIED: "denied" },
    requestMultiple: async () => ({
      "android.permission.BLUETOOTH_SCAN": "granted",
      "android.permission.BLUETOOTH_CONNECT": "granted",
    }),
    request: async () => "granted",
  },
};
