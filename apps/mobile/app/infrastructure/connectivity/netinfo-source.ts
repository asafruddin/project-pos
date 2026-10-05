import NetInfo from "@react-native-community/netinfo";
import type { NetworkSource } from "./connectivity-monitor";

function isUp(state: { isConnected: boolean | null; isInternetReachable: boolean | null }) {
  // isInternetReachable is null while NetInfo is still checking — trust isConnected then.
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

export const netInfoSource: NetworkSource = {
  subscribe(listener) {
    return NetInfo.addEventListener((state) => listener(isUp(state)));
  },
  async fetch() {
    return isUp(await NetInfo.fetch());
  },
};
