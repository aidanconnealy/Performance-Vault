const $ = (id) => document.getElementById(id);

let sasPayload = null;

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

async function httpJson(url, method, bodyObj) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined
  });
  const text = await res.text();
  let json = safeJsonParse(text);
  if (!json) json = { raw: text };
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}\n${text}`);
  return json;
}

function withTeam(urlWithQuery, teamId, extraPath = "") {
  const [base, query] = urlWithQuery.split("?");
  const newBase = `${base}/${encodeURIComponent(teamId)}${extraPath}`;
  return query ? `${newBase}?${query}` : newBase;
}


$("btnRequestSas").onclick = async () => {
  try {
    const teamId = $("teamId").value.trim();
    const fileName = $("fileName").value.trim();
    const file = $("fileInput").files[0];
    if (!teamId) throw new Error("teamId required");
    if (!file) throw new Error("select a file first");

    const payload = { teamId, fileName, contentType: file.type || "application/octet-stream" };
    sasPayload = await httpJson(window.CONFIG.requestSasUrl, "POST", payload);

    $("sasOut").textContent = JSON.stringify(sasPayload, null, 2);
    $("btnUpload").disabled = false;
  } catch (e) {
    $("sasOut").textContent = String(e);
  }
};

$("btnUpload").onclick = async () => {
  try {
    if (!sasPayload?.uploadUrl) throw new Error("Request SAS first");
    const file = $("fileInput").files[0];
    if (!file) throw new Error("select a file first");

    const headers = sasPayload.requiredHeaders || {};
    const res = await fetch(sasPayload.uploadUrl, {
      method: "PUT",
      headers,
      body: file
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`PUT SAS -> ${res.status}\n${text}`);

    $("sasOut").textContent = $("sasOut").textContent + `\n\nUpload OK: ${res.status}`;
  } catch (e) {
    $("sasOut").textContent = String(e);
  }
};

$("btnCreateMeta").onclick = async () => {
  try {
    if (!sasPayload?.containerName || !sasPayload?.blobName) {
      throw new Error("Do SAS first so we can reuse containerName/blobName for metadata");
    }

    const body = {
      teamId: $("teamId").value.trim(),
      athleteName: $("athleteName").value.trim(),
      liftType: $("liftType").value,
      loadKg: Number($("loadKg").value),
      rpe: $("rpe").value === "" ? "" : Number($("rpe").value),
      timestamp: $("timestamp").value.trim(),
      mediaType: "video",
      containerName: sasPayload.containerName,
      blobName: sasPayload.blobName
    };

    const json = await httpJson(window.CONFIG.createUrl, "POST", body);
    $("createOut").textContent = JSON.stringify(json, null, 2);

    if (json?.id) $("docId").value = json.id;
  } catch (e) {
    $("createOut").textContent = String(e);
  }
};

$("btnList").onclick = async () => {
  try {
    const teamId = $("teamIdQuery").value.trim();
    const url = withTeam(window.CONFIG.listBaseUrl, teamId, "");
    const json = await httpJson(url, "GET");
    $("crudOut").textContent = JSON.stringify(json, null, 2);
  } catch (e) {
    $("crudOut").textContent = String(e);
  }
};


$("btnGetOne").onclick = async () => {
  try {
    const teamId = $("teamIdQuery").value.trim();
    const id = $("docId").value.trim();
    const url = withTeam(window.CONFIG.getOneBaseUrl, teamId, `/${encodeURIComponent(id)}`);
    const json = await httpJson(url, "GET");
    $("crudOut").textContent = JSON.stringify(json, null, 2);
  } catch (e) {
    $("crudOut").textContent = String(e);
  }
};


$("btnUpdate").onclick = async () => {
  try {
    const teamId = $("teamIdQuery").value.trim();
    const id = $("docId").value.trim();
    const patch = safeJsonParse($("updateBody").value);
    if (!patch) throw new Error("Update JSON is invalid");

    const url = withTeam(window.CONFIG.updateBaseUrl, teamId, `/${encodeURIComponent(id)}`);
    const json = await httpJson(url, "PUT", patch);
    $("crudOut").textContent = JSON.stringify(json, null, 2);
  } catch (e) {
    $("crudOut").textContent = String(e);
  }
};


$("btnDelete").onclick = async () => {
  try {
    const teamId = $("teamIdQuery").value.trim();
    const id = $("docId").value.trim();
    const url = withTeam(window.CONFIG.deleteBaseUrl, teamId, `/${encodeURIComponent(id)}`);
    const json = await httpJson(url, "DELETE");
    $("crudOut").textContent = JSON.stringify(json, null, 2);
  } catch (e) {
    $("crudOut").textContent = String(e);
  }
};
