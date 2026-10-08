module.exports = {
  requireOptionalNativeModule: () => null,
  requireNativeModule: () => {
    throw new Error("native module unavailable in tests");
  },
};
