const { app } = require("@azure/functions");
const crypto = require("crypto");
const {
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  SASProtocol,
  StorageSharedKeyCredential,
} = require("@azure/storage-blob");

function sanitizeFileName(name) {
  return String(name)
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

app.http("requestSAS", {
  methods: ["POST"],
  authLevel: "function",
  route: "upload/request-sas",
  handler: async (request, context) => {
    try {
      const body = await request.json();

      const accountName = process.env.STORAGE_ACCOUNT_NAME;
      const accountKey = process.env.STORAGE_ACCOUNT_KEY;
      const defaultContainer =
        process.env.STORAGE_CONTAINER_RAW || "media-raw";
      const expiryMinutes = Number(process.env.SAS_EXPIRY_MINUTES || "15");

      if (!accountName || !accountKey) {
        return {
          status: 500,
          jsonBody: { error: "Missing STORAGE_ACCOUNT_NAME or STORAGE_ACCOUNT_KEY" },
        };
      }

      const teamId = (body.teamId || "team-unknown").toString();
      const containerName = (body.containerName || defaultContainer).toString();
      const fileName = body.fileName;
      const contentType = body.contentType || "application/octet-stream";

      if (!fileName) {
        return { status: 400, jsonBody: { error: "fileName is required" } };
      }

      const safeFileName = sanitizeFileName(fileName);
      const blobName = `${teamId}/${crypto.randomUUID()}-${safeFileName}`;
      const blobPath = `${containerName}/${blobName}`;

      const credential = new StorageSharedKeyCredential(accountName, accountKey);

      const perms = new BlobSASPermissions();
      perms.create = true;
      perms.write = true;

      const now = new Date();
      const startsOn = new Date(now.getTime() - 5 * 60 * 1000);
      const expiresOn = new Date(now.getTime() + expiryMinutes * 60 * 1000);

      const sas = generateBlobSASQueryParameters(
        {
          containerName,
          blobName,
          permissions: perms,
          startsOn,
          expiresOn,
          protocol: SASProtocol.Https,
        },
        credential
      ).toString();

      const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sas}`;

      return {
        status: 200,
        jsonBody: {
          uploadUrl,
          containerName,
          blobName,
          blobPath,
          expiresAt: expiresOn.toISOString(),
          requiredHeaders: {
            "x-ms-blob-type": "BlockBlob",
            "Content-Type": contentType,
          },
        },
      };
    } catch (e) {
      context.error(e);
      return { status: 500, jsonBody: { error: "Unhandled error" } };
    }
  },
});
