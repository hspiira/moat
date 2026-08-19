import { isBackupFilename } from "@/lib/security/encrypted-backup";
import { isSealedBackupFilename } from "@/lib/security/sealed-backup";
import { KEY_VAULT_FILENAME } from "@/lib/security/key-vault";

const GOOGLE_GIS_SCRIPT_ID = "moat-google-gis-script";
const GOOGLE_GIS_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

export type GoogleDriveBackupFile = {
  fileId: string;
  name: string;
  modifiedTime: string;
  size?: string;
};

export interface GoogleDriveBackupClient {
  signIn(): Promise<void>;
  restoreSession(): Promise<boolean>;
  signOut(): Promise<void>;
  isConnected(): boolean;
  uploadBackup(params: { filename: string; blob: Blob }): Promise<{ fileId: string }>;
  listBackups(): Promise<GoogleDriveBackupFile[]>;
  downloadBackup(fileId: string): Promise<string>;
  saveKeyVault(vaultText: string): Promise<{ fileId: string }>;
  loadKeyVault(): Promise<string | null>;
  listKeyVaults(): Promise<GoogleDriveBackupFile[]>;
  deleteFile(fileId: string): Promise<void>;
}

type ScriptLoader = () => Promise<void>;
type FetchLike = typeof fetch;

type GoogleTokenClient = {
  callback: ((response: GoogleOAuthTokenResponse) => void) | null;
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type GoogleOAuthTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleOAuthTokenResponse) => void;
          }) => GoogleTokenClient;
          revoke?: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

function assertBrowser() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Google Drive backup is only available in the browser.");
  }
}

function getGoogleDriveClientId() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("Google Drive backup is not configured for this environment.");
  }
  return clientId;
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID?.trim());
}

export async function loadGoogleIdentityScript(): Promise<void> {
  assertBrowser();

  if (window.google?.accounts?.oauth2) {
    return;
  }

  const existing = document.getElementById(GOOGLE_GIS_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services.")), {
        once: true,
      });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = GOOGLE_GIS_SCRIPT_ID;
    script.src = GOOGLE_GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });
}

async function parseDriveError(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    return payload.error?.message || `Google Drive request failed with status ${response.status}.`;
  } catch {
    return `Google Drive request failed with status ${response.status}.`;
  }
}

export function createGoogleDriveBackupClient(params?: {
  scriptLoader?: ScriptLoader;
  fetchImpl?: FetchLike;
}): GoogleDriveBackupClient {
  let accessToken: string | null = null;
  let tokenClient: GoogleTokenClient | null = null;
  let signInAttempted = false;

  const scriptLoader = params?.scriptLoader ?? loadGoogleIdentityScript;
  const fetchImpl = params?.fetchImpl ?? fetch;

  async function ensureTokenClient() {
    assertBrowser();
    await scriptLoader();

    const oauth = window.google?.accounts?.oauth2;
    if (!oauth?.initTokenClient) {
      throw new Error("Google Identity Services is unavailable.");
    }

    if (!tokenClient) {
      tokenClient = oauth.initTokenClient({
        client_id: getGoogleDriveClientId(),
        scope: GOOGLE_DRIVE_SCOPE,
        callback: () => undefined,
      });
    }

    return tokenClient;
  }

  async function ensureAccessToken() {
    return requestAccessToken(signInAttempted ? "" : "consent");
  }

  async function requestAccessToken(prompt: "" | "consent"): Promise<string> {
    if (accessToken) {
      return accessToken;
    }

    const client = await ensureTokenClient();

    accessToken = await new Promise<string>((resolve, reject) => {
      client.callback = (response) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description ||
                response.error ||
                "Google sign-in did not return an access token.",
            ),
          );
          return;
        }

        signInAttempted = true;
        resolve(response.access_token);
      };

      client.requestAccessToken({ prompt });
    });

    return accessToken;
  }

  function fetchWithToken(input: string, init: RequestInit | undefined, token: string) {
    return fetchImpl(input, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async function authorizedFetch(input: string, init?: RequestInit) {
    const response = await fetchWithToken(input, init, await ensureAccessToken());

    // An access token lasts about an hour, so any tab left open will meet this.
    // Asking for a fresh one silently beats reporting a failure that reads like
    // the backup itself went wrong.
    if (response.status === 401) {
      accessToken = null;
      const retried = await fetchWithToken(input, init, await ensureAccessToken());

      if (!retried.ok) {
        throw new Error(await parseDriveError(retried));
      }

      return retried;
    }

    if (!response.ok) {
      throw new Error(await parseDriveError(response));
    }

    return response;
  }

  async function listAppDataFilesNamed(name: string): Promise<GoogleDriveBackupFile[]> {
    const query = encodeURIComponent(`name = '${name}' and trashed = false`);
    const response = await authorizedFetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`,
    );
    const payload = (await response.json()) as {
      files?: Array<{ id: string; name: string; modifiedTime: string; size?: string }>;
    };

    return (payload.files ?? [])
      .sort((left, right) => right.modifiedTime.localeCompare(left.modifiedTime))
      .map((file) => ({
        fileId: file.id,
        name: file.name,
        modifiedTime: file.modifiedTime,
        size: file.size,
      }));
  }

  async function findAppDataFile(name: string): Promise<GoogleDriveBackupFile | null> {
    const [newest] = await listAppDataFilesNamed(name);
    return newest ?? null;
  }

  async function createAppDataFile(params: {
    filename: string;
    body: Blob;
  }): Promise<{ fileId: string }> {
    const metadata = {
      name: params.filename,
      parents: ["appDataFolder"],
    };

    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    );
    formData.append("file", params.body, params.filename);

    const response = await authorizedFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        body: formData,
      },
    );

    const payload = (await response.json()) as { id: string };
    return { fileId: payload.id };
  }

  async function downloadAppDataFile(fileId: string): Promise<string> {
    const response = await authorizedFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    );
    return response.text();
  }

  return {
    async signIn() {
      await requestAccessToken(signInAttempted ? "" : "consent");
    },
    async restoreSession() {
      try {
        await requestAccessToken("");
        return true;
      } catch {
        accessToken = null;
        return false;
      }
    },
    async signOut() {
      if (accessToken && typeof window !== "undefined") {
        window.google?.accounts?.oauth2?.revoke?.(accessToken, () => undefined);
      }
      accessToken = null;
      signInAttempted = false;
    },
    isConnected() {
      return Boolean(accessToken);
    },
    async uploadBackup({ filename, blob }) {
      return createAppDataFile({ filename, body: blob });
    },
    async listBackups() {
      const response = await authorizedFetch(
        "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&q=trashed=false",
      );
      const payload = (await response.json()) as {
        files?: Array<{ id: string; name: string; modifiedTime: string; size?: string }>;
      };

      return (payload.files ?? [])
        .filter((file) => isBackupFilename(file.name) || isSealedBackupFilename(file.name))
        .sort((left, right) => right.modifiedTime.localeCompare(left.modifiedTime))
        .map((file) => ({
          fileId: file.id,
          name: file.name,
          modifiedTime: file.modifiedTime,
          size: file.size,
        }));
    },
    async downloadBackup(fileId) {
      return downloadAppDataFile(fileId);
    },
    // One vault, updated in place. A pile of dated vault files would leave the
    // newest device guessing which one still wraps the current key.
    async saveKeyVault(vaultText) {
      const body = new Blob([vaultText], { type: "application/json" });
      const existing = await findAppDataFile(KEY_VAULT_FILENAME);

      if (!existing) {
        return createAppDataFile({ filename: KEY_VAULT_FILENAME, body });
      }

      const response = await authorizedFetch(
        `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.fileId)}?uploadType=media&fields=id`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
        },
      );

      const payload = (await response.json()) as { id: string };
      return { fileId: payload.id };
    },
    async loadKeyVault() {
      const existing = await findAppDataFile(KEY_VAULT_FILENAME);
      return existing ? downloadAppDataFile(existing.fileId) : null;
    },
    // The app data folder is hidden from the Drive UI, so a second copy is
    // something only the app can see, report, and clear up.
    async listKeyVaults() {
      return listAppDataFilesNamed(KEY_VAULT_FILENAME);
    },
    async deleteFile(fileId) {
      await authorizedFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
        { method: "DELETE" },
      );
    },
  };
}
