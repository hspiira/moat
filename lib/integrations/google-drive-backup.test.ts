import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
});

describe("google drive backup client", () => {
  it("guards browser-only usage", async () => {
    const { loadGoogleIdentityScript } = await import("@/lib/integrations/google-drive-backup");

    await expect(loadGoogleIdentityScript()).rejects.toThrow(
      "Google Drive backup is only available in the browser.",
    );
  });

  it("uploads encrypted blobs and lists backups in newest-first order", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID = "client-id";

    vi.stubGlobal("window", {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: ({ callback }: { callback: (response: { access_token?: string }) => void }) => {
              const tokenClient = {
                callback,
                requestAccessToken: () => {
                  tokenClient.callback({ access_token: "token-123" });
                },
              };
              return tokenClient;
            },
            revoke: vi.fn(),
          },
        },
      },
    });
    vi.stubGlobal("document", {});

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "drive-file-1" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [
              {
                id: "older",
                name: "moat-backup-2026-04-06T10-00-00.000Z.enc",
                modifiedTime: "2026-04-06T10:00:00.000Z",
                size: "120",
              },
              {
                id: "newer",
                name: "moat-backup-2026-04-07T10-00-00.000Z.enc",
                modifiedTime: "2026-04-07T10:00:00.000Z",
                size: "140",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("encrypted-payload", { status: 200 }));

    const { createGoogleDriveBackupClient } = await import("@/lib/integrations/google-drive-backup");
    const client = createGoogleDriveBackupClient({
      scriptLoader: async () => undefined,
      fetchImpl,
    });

    await client.signIn();
    expect(client.isConnected()).toBe(true);

    const upload = await client.uploadBackup({
      filename: "moat-backup-2026-04-07T10-00-00.000Z.enc",
      blob: new Blob(["ciphertext"], { type: "application/octet-stream" }),
    });
    expect(upload).toEqual({ fileId: "drive-file-1" });

    const files = await client.listBackups();
    expect(files.map((file) => file.fileId)).toEqual(["newer", "older"]);

    const downloaded = await client.downloadBackup("newer");
    expect(downloaded).toBe("encrypted-payload");

    const uploadCall = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(uploadCall[0]).toContain("upload/drive/v3/files");
    expect(uploadCall[1].headers).toMatchObject({
      Authorization: "Bearer token-123",
    });
  });

  it("can restore a prior session silently when google cookies are still valid", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID = "client-id";

    vi.stubGlobal("window", {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: ({ callback }: { callback: (response: { access_token?: string }) => void }) => {
              const tokenClient = {
                callback,
                requestAccessToken: ({ prompt }: { prompt?: string } = {}) => {
                  tokenClient.callback(
                    prompt === ""
                      ? { access_token: "silent-token" }
                      : { access_token: "interactive-token" },
                  );
                },
              };
              return tokenClient;
            },
            revoke: vi.fn(),
          },
        },
      },
    });
    vi.stubGlobal("document", {});

    const { createGoogleDriveBackupClient } = await import("@/lib/integrations/google-drive-backup");
    const client = createGoogleDriveBackupClient({
      scriptLoader: async () => undefined,
      fetchImpl: vi.fn(),
    });

    await expect(client.restoreSession()).resolves.toBe(true);
    expect(client.isConnected()).toBe(true);
  });
});

function stubGoogleIdentity() {
  vi.stubGlobal("window", {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }: { callback: (response: { access_token?: string }) => void }) => {
            const tokenClient = {
              callback,
              requestAccessToken: () => {
                tokenClient.callback({ access_token: "token-123" });
              },
            };
            return tokenClient;
          },
          revoke: vi.fn(),
        },
      },
    },
  });
  vi.stubGlobal("document", {});
}

describe("key vault in the drive app folder", () => {
  it("creates the vault file the first time and updates that same file afterwards", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID = "client-id";
    stubGoogleIdentity();

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "vault-1" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [
              {
                id: "vault-1",
                name: "moat-key-vault.json",
                modifiedTime: "2026-08-19T09:00:00.000Z",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "vault-1" }), { status: 200 }));

    const { createGoogleDriveBackupClient } = await import("@/lib/integrations/google-drive-backup");
    const client = createGoogleDriveBackupClient({
      scriptLoader: async () => undefined,
      fetchImpl,
    });

    await expect(client.saveKeyVault('{"version":1}')).resolves.toEqual({ fileId: "vault-1" });
    await expect(client.saveKeyVault('{"version":1}')).resolves.toEqual({ fileId: "vault-1" });

    const [createUrl, createInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(createUrl).toContain("uploadType=multipart");
    expect(createInit.method).toBe("POST");

    const [updateUrl, updateInit] = fetchImpl.mock.calls[3] as [string, RequestInit];
    expect(updateUrl).toContain("files/vault-1?uploadType=media");
    expect(updateInit.method).toBe("PATCH");
  });

  it("looks for the vault by name, not among the backups", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID = "client-id";
    stubGoogleIdentity();

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [
              {
                id: "vault-1",
                name: "moat-key-vault.json",
                modifiedTime: "2026-08-19T09:00:00.000Z",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('{"version":1}', { status: 200 }));

    const { createGoogleDriveBackupClient } = await import("@/lib/integrations/google-drive-backup");
    const client = createGoogleDriveBackupClient({
      scriptLoader: async () => undefined,
      fetchImpl,
    });

    await expect(client.loadKeyVault()).resolves.toBe('{"version":1}');

    const [searchUrl] = fetchImpl.mock.calls[0] as [string];
    expect(decodeURIComponent(searchUrl)).toContain("name = 'moat-key-vault.json'");
  });

  it("reports no vault rather than failing when the folder is empty", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID = "client-id";
    stubGoogleIdentity();

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }));

    const { createGoogleDriveBackupClient } = await import("@/lib/integrations/google-drive-backup");
    const client = createGoogleDriveBackupClient({
      scriptLoader: async () => undefined,
      fetchImpl,
    });

    await expect(client.loadKeyVault()).resolves.toBeNull();
  });
});

describe("an expired access token", () => {
  it("is replaced silently and the request is retried once", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID = "client-id";

    let issued = 0;
    vi.stubGlobal("window", {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: ({ callback }: { callback: (response: { access_token?: string }) => void }) => {
              const tokenClient = {
                callback,
                requestAccessToken: () => {
                  issued += 1;
                  tokenClient.callback({ access_token: `token-${issued}` });
                },
              };
              return tokenClient;
            },
            revoke: vi.fn(),
          },
        },
      },
    });
    vi.stubGlobal("document", {});

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("no", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }));

    const { createGoogleDriveBackupClient } = await import("@/lib/integrations/google-drive-backup");
    const client = createGoogleDriveBackupClient({
      scriptLoader: async () => undefined,
      fetchImpl,
    });

    await expect(client.loadKeyVault()).resolves.toBeNull();

    const [, firstInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const [, retryInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(firstInit.headers).toMatchObject({ Authorization: "Bearer token-1" });
    expect(retryInit.headers).toMatchObject({ Authorization: "Bearer token-2" });
  });

  it("reports the failure when a fresh token does not help either", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID = "client-id";
    stubGoogleIdentity();

    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Insufficient permissions" } }), {
          status: 401,
        }),
      );

    const { createGoogleDriveBackupClient } = await import("@/lib/integrations/google-drive-backup");
    const client = createGoogleDriveBackupClient({
      scriptLoader: async () => undefined,
      fetchImpl,
    });

    await expect(client.loadKeyVault()).rejects.toThrow("Insufficient permissions");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
