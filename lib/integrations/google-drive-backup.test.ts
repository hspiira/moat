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
