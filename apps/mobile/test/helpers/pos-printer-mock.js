module.exports = {
  isAvailable: () => false,
  scan: async () => [],
  connect: async () => ({ id: "", name: "", bonded: false }),
  disconnect: async () => {},
  print: async () => {},
  isConnected: async () => false,
  setStayConnected: async () => {},
};
