import {
  downloadOfficialTunnelClient as downloadOfficialTunnelClientToRoot,
  parseSha256Sums,
  selectTunnelClientReleaseAssets,
  tunnelClientPlatformAsset
} from "@planweave-ai/mcp";
import type {
  GitHubRelease,
  GitHubReleaseAsset,
  TunnelClientDownloadResult,
  TunnelClientPlatformAsset
} from "@planweave-ai/mcp";
import { mcpTunnelDownloadsDir } from "./tunnelClientStore.js";

export { parseSha256Sums, selectTunnelClientReleaseAssets, tunnelClientPlatformAsset };
export type { GitHubRelease, GitHubReleaseAsset, TunnelClientDownloadResult, TunnelClientPlatformAsset };

export async function downloadOfficialTunnelClient(downloadsDir = mcpTunnelDownloadsDir()): Promise<TunnelClientDownloadResult> {
  return downloadOfficialTunnelClientToRoot(downloadsDir);
}
