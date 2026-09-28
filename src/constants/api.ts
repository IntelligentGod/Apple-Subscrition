/**
 * Where the Eazee backend (server/ folder) runs.
 *
 * - iOS Simulator: `localhost` is your Mac, so the default works.
 * - Physical iPhone: use your Mac's LAN IP, e.g. 'http://192.168.1.20:3000'
 *   (System Settings → Wi-Fi → Details). Phone and Mac must be on the same Wi-Fi.
 * - Release builds: your deployed HTTPS server.
 */
export const API_BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://api.eazee.ai';
