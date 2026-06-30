const PROJECTS_DIRECTORY_NAME = "projects";
const FRAMES_DIRECTORY_NAME = "frames";
const PROJECT_METADATA_FILE_NAME = "project-metadata-list.json";
const ORIGINAL_FRAME_EXTENSION = ".jpg";
const THUMBNAIL_FRAME_SUFFIX = "-timeline.jpg";

const originValueElement = document.getElementById("originValue");
const statusPanelElement = document.getElementById("statusPanel");
const summaryGridElement = document.getElementById("summaryGrid");
const projectsCountElement = document.getElementById("projectsCount");
const framesCountElement = document.getElementById("framesCount");
const projectsListElement = document.getElementById("projectsList");
const framesListElement = document.getElementById("framesList");
const messageLogElement = document.getElementById("messageLog");
const rescanButtonElement = document.getElementById("rescanButton");
const restoreMetadataButtonElement = document.getElementById("restoreMetadataButton");
const createProjectButtonElement = document.getElementById("createProjectButton");
const downloadReportButtonElement = document.getElementById("downloadReportButton");

const objectUrlsToRevoke = new Set();

let latestScanResult = null;
let latestReportObjectUrl = null;

originValueElement.textContent = window.location.origin;

rescanButtonElement.addEventListener("click", () => {
  scanStorageAndRender();
});

restoreMetadataButtonElement.addEventListener("click", async () => {
  await runRecoveryAction({
    actionName: "restore project index",
    action: restoreProjectMetadataListFromContentFiles,
  });
});

createProjectButtonElement.addEventListener("click", async () => {
  await runRecoveryAction({
    actionName: "create recovered project",
    action: createRecoveredProjectFromOrphanFrames,
  });
});

downloadReportButtonElement.addEventListener("click", () => {
  downloadLatestReport();
});

scanStorageAndRender();

async function runRecoveryAction({ actionName, action }) {
  setButtonsDisabled(true);
  setStatus(`Running ${actionName}...`);

  try {
    const resultMessage = await action();
    logMessage(resultMessage);
    await scanStorageAndRender();
  } catch (error) {
    logMessage(`Failed to ${actionName}: ${formatError(error)}`);
    setStatus(`Failed to ${actionName}.`);
    setButtonsDisabled(false);
  }
}

async function scanStorageAndRender() {
  setButtonsDisabled(true);
  setStatus("Scanning browser storage...");
  revokeRenderedObjectUrls();

  try {
    latestScanResult = await scanStorage();
    renderScanResult(latestScanResult);
    setStatus(createStatusMessage(latestScanResult));
    downloadReportButtonElement.disabled = false;
  } catch (error) {
    latestScanResult = null;
    renderScanError(error);
    setStatus("Storage scan failed.");
  }
}

async function scanStorage() {
  const rootDirectoryHandle = await getRootDirectoryHandle();
  const storageEstimate = await getStorageEstimate();
  const rootEntries = await listDirectoryEntries(rootDirectoryHandle);
  const projectsDirectoryHandle = await getOptionalDirectoryHandle(
    rootDirectoryHandle,
    PROJECTS_DIRECTORY_NAME,
  );
  const framesDirectoryHandle = await getOptionalDirectoryHandle(
    rootDirectoryHandle,
    FRAMES_DIRECTORY_NAME,
  );

  const projectScan = projectsDirectoryHandle
    ? await scanProjectsDirectory(projectsDirectoryHandle)
    : createEmptyProjectScan();
  const frameScan = framesDirectoryHandle
    ? await scanFramesDirectory(framesDirectoryHandle)
    : createEmptyFrameScan();

  const referencedFrameIds = collectReferencedFrameIds(projectScan.projectContentFiles);
  const orphanFrameGroups = frameScan.frameGroups.filter((frameGroup) => {
    return !referencedFrameIds.has(frameGroup.frameId);
  });

  return {
    scannedAt: new Date().toISOString(),
    origin: window.location.origin,
    storageEstimate,
    rootEntries,
    projectsDirectoryExists: Boolean(projectsDirectoryHandle),
    framesDirectoryExists: Boolean(framesDirectoryHandle),
    ...projectScan,
    ...frameScan,
    referencedFrameIds: [...referencedFrameIds].sort(),
    orphanFrameGroups,
  };
}

async function getRootDirectoryHandle() {
  if (!navigator.storage || typeof navigator.storage.getDirectory !== "function") {
    throw new Error("Origin Private File System is not available in this browser.");
  }

  return navigator.storage.getDirectory();
}

async function getStorageEstimate() {
  if (!navigator.storage || typeof navigator.storage.estimate !== "function") {
    return null;
  }

  try {
    return navigator.storage.estimate();
  } catch {
    return null;
  }
}

async function getOptionalDirectoryHandle(parentDirectoryHandle, directoryName) {
  try {
    return await parentDirectoryHandle.getDirectoryHandle(directoryName);
  } catch (error) {
    if (error?.name === "NotFoundError") {
      return null;
    }

    throw error;
  }
}

async function listDirectoryEntries(directoryHandle) {
  if (typeof directoryHandle.entries !== "function") {
    return [];
  }

  const entries = [];

  for await (const [entryName, entryHandle] of directoryHandle.entries()) {
    entries.push({
      name: entryName,
      kind: entryHandle.kind,
    });
  }

  return entries.sort(compareNamedRecords);
}

function createEmptyProjectScan() {
  return {
    projectMetadataFile: null,
    projectContentFiles: [],
    projectDirectoryEntries: [],
  };
}

async function scanProjectsDirectory(projectsDirectoryHandle) {
  const projectDirectoryEntries = await listDirectoryEntries(projectsDirectoryHandle);
  const projectContentFiles = [];
  let projectMetadataFile = null;

  for (const directoryEntry of projectDirectoryEntries) {
    if (directoryEntry.kind !== "file" || !directoryEntry.name.endsWith(".json")) {
      continue;
    }

    const fileHandle = await projectsDirectoryHandle.getFileHandle(directoryEntry.name);
    const scannedJsonFile = await readJsonFile(fileHandle, directoryEntry.name);

    if (directoryEntry.name === PROJECT_METADATA_FILE_NAME) {
      projectMetadataFile = scannedJsonFile;
    } else {
      projectContentFiles.push({
        ...scannedJsonFile,
        projectId: directoryEntry.name.slice(0, -".json".length),
      });
    }
  }

  return {
    projectMetadataFile,
    projectContentFiles: projectContentFiles.sort(compareProjectFiles),
    projectDirectoryEntries,
  };
}

async function readJsonFile(fileHandle, fileName) {
  const file = await fileHandle.getFile();
  const text = await file.text();
  let parsed = null;
  let parseError = null;

  if (text.trim()) {
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      parseError = formatError(error);
    }
  }

  return {
    name: fileName,
    size: file.size,
    lastModified: file.lastModified,
    text,
    parsed,
    parseError,
  };
}

function createEmptyFrameScan() {
  return {
    frameFiles: [],
    frameGroups: [],
  };
}

async function scanFramesDirectory(framesDirectoryHandle) {
  const frameDirectoryEntries = await listDirectoryEntries(framesDirectoryHandle);
  const frameFiles = [];

  for (const directoryEntry of frameDirectoryEntries) {
    if (directoryEntry.kind !== "file" || !isJpegFrameFileName(directoryEntry.name)) {
      continue;
    }

    const frameFileHandle = await framesDirectoryHandle.getFileHandle(directoryEntry.name);
    const frameFile = await frameFileHandle.getFile();
    const parsedFrameName = parseFrameFileName(directoryEntry.name);

    frameFiles.push({
      name: directoryEntry.name,
      frameId: parsedFrameName.frameId,
      role: parsedFrameName.role,
      size: frameFile.size,
      lastModified: frameFile.lastModified,
      file: frameFile,
    });
  }

  return {
    frameFiles: frameFiles.sort(compareFrameFiles),
    frameGroups: groupFrameFiles(frameFiles),
  };
}

function isJpegFrameFileName(fileName) {
  return fileName.endsWith(ORIGINAL_FRAME_EXTENSION);
}

function parseFrameFileName(fileName) {
  if (fileName.endsWith(THUMBNAIL_FRAME_SUFFIX)) {
    return {
      frameId: fileName.slice(0, -THUMBNAIL_FRAME_SUFFIX.length),
      role: "thumbnail",
    };
  }

  return {
    frameId: fileName.slice(0, -ORIGINAL_FRAME_EXTENSION.length),
    role: "original",
  };
}

function groupFrameFiles(frameFiles) {
  const frameGroupsById = new Map();

  for (const frameFile of frameFiles) {
    if (!frameGroupsById.has(frameFile.frameId)) {
      frameGroupsById.set(frameFile.frameId, {
        frameId: frameFile.frameId,
        originalFile: null,
        thumbnailFile: null,
        sortValue: getFrameSortValue(frameFile),
      });
    }

    const frameGroup = frameGroupsById.get(frameFile.frameId);

    if (frameFile.role === "thumbnail") {
      frameGroup.thumbnailFile = frameFile;
    } else {
      frameGroup.originalFile = frameFile;
    }

    frameGroup.sortValue = Math.min(frameGroup.sortValue, getFrameSortValue(frameFile));
  }

  return [...frameGroupsById.values()].sort(compareFrameGroups);
}

function getFrameSortValue(frameFile) {
  const timestampMatch = frameFile.frameId.match(/^frame-(\d+)/);

  if (timestampMatch) {
    return Number.parseInt(timestampMatch[1], 10);
  }

  return frameFile.lastModified || 0;
}

function collectReferencedFrameIds(projectContentFiles) {
  const referencedFrameIds = new Set();

  for (const projectContentFile of projectContentFiles) {
    const frames = Array.isArray(projectContentFile.parsed?.frames)
      ? projectContentFile.parsed.frames
      : [];

    for (const frameRecord of frames) {
      const frameId = getFrameIdFromFrameRecord(frameRecord);

      if (frameId) {
        referencedFrameIds.add(frameId);
      }
    }
  }

  return referencedFrameIds;
}

function getFrameIdFromFrameRecord(frameRecord) {
  if (!frameRecord || typeof frameRecord !== "object") {
    return null;
  }

  return frameRecord.id
    || getFrameIdFromStorageKey(frameRecord.originalStorageKey)
    || getFrameIdFromStorageKey(frameRecord.thumbnailStorageKey)
    || null;
}

function getFrameIdFromStorageKey(storageKey) {
  if (typeof storageKey !== "string") {
    return null;
  }

  return parseFrameFileName(storageKey).frameId;
}

async function restoreProjectMetadataListFromContentFiles() {
  const rootDirectoryHandle = await getRootDirectoryHandle();
  const projectsDirectoryHandle = await rootDirectoryHandle.getDirectoryHandle(
    PROJECTS_DIRECTORY_NAME,
    { create: true },
  );
  const currentScan = latestScanResult || await scanStorage();
  const existingProjectMetadataList = Array.isArray(currentScan.projectMetadataFile?.parsed)
    ? [...currentScan.projectMetadataFile.parsed]
    : [];
  const knownProjectIds = new Set(existingProjectMetadataList.map((projectMetadata) => {
    return projectMetadata?.id;
  }));
  let recoveredProjectCount = 0;

  for (const projectContentFile of currentScan.projectContentFiles) {
    if (projectContentFile.parseError || knownProjectIds.has(projectContentFile.projectId)) {
      continue;
    }

    const projectMetadataRecord = createProjectMetadataRecordFromContentFile(projectContentFile);
    existingProjectMetadataList.push(projectMetadataRecord);
    knownProjectIds.add(projectMetadataRecord.id);
    recoveredProjectCount += 1;
  }

  await writeJsonFile(
    projectsDirectoryHandle,
    PROJECT_METADATA_FILE_NAME,
    existingProjectMetadataList,
  );

  if (recoveredProjectCount === 0) {
    return "Project index already covered all readable project files.";
  }

  return `Restored ${recoveredProjectCount} project metadata record(s).`;
}

async function createRecoveredProjectFromOrphanFrames() {
  const currentScan = latestScanResult || await scanStorage();

  if (currentScan.orphanFrameGroups.length === 0) {
    return "No orphan frame files were found.";
  }

  const rootDirectoryHandle = await getRootDirectoryHandle();
  const projectsDirectoryHandle = await rootDirectoryHandle.getDirectoryHandle(
    PROJECTS_DIRECTORY_NAME,
    { create: true },
  );
  const createdAtMilliseconds = Date.now();
  const projectId = `project-${createdAtMilliseconds}-recovered`;
  const title = `Recovered Project ${new Date(createdAtMilliseconds).toLocaleString()}`;
  const frames = [];

  for (const frameGroup of currentScan.orphanFrameGroups) {
    const bestOriginalFile = frameGroup.originalFile || frameGroup.thumbnailFile;
    const bestThumbnailFile = frameGroup.thumbnailFile || frameGroup.originalFile;
    const dimensions = await readImageDimensions(bestOriginalFile?.file || bestThumbnailFile?.file);

    frames.push({
      id: frameGroup.frameId,
      originalStorageKey: bestOriginalFile?.name ?? null,
      thumbnailStorageKey: bestThumbnailFile?.name ?? null,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    });
  }

  const projectContentRecord = {
    id: projectId,
    title,
    frames,
  };
  const metadataRecord = {
    id: projectId,
    title,
    createdAtMilliseconds,
    updatedAtMilliseconds: createdAtMilliseconds,
    thumbnailImageSource: null,
    thumbnailStorageKey: frames[frames.length - 1]?.thumbnailStorageKey ?? null,
  };
  const existingProjectMetadataList = Array.isArray(currentScan.projectMetadataFile?.parsed)
    ? [...currentScan.projectMetadataFile.parsed]
    : [];

  existingProjectMetadataList.push(metadataRecord);

  await writeJsonFile(projectsDirectoryHandle, `${projectId}.json`, projectContentRecord);
  await writeJsonFile(
    projectsDirectoryHandle,
    PROJECT_METADATA_FILE_NAME,
    existingProjectMetadataList,
  );

  return `Created ${title} with ${frames.length} frame record(s).`;
}

function createProjectMetadataRecordFromContentFile(projectContentFile) {
  const projectContentRecord = projectContentFile.parsed || {};
  const frames = Array.isArray(projectContentRecord.frames)
    ? projectContentRecord.frames
    : [];
  const lastFrameRecord = frames[frames.length - 1] || null;
  const updatedAtMilliseconds = projectContentFile.lastModified || Date.now();

  return {
    id: projectContentFile.projectId,
    title: projectContentRecord.title || "Untitled Project",
    createdAtMilliseconds: projectContentRecord.createdAtMilliseconds || updatedAtMilliseconds,
    updatedAtMilliseconds,
    thumbnailImageSource: null,
    thumbnailStorageKey: lastFrameRecord?.thumbnailStorageKey ?? null,
  };
}

async function writeJsonFile(directoryHandle, fileName, value) {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writableStream = await fileHandle.createWritable();

  try {
    await writableStream.write(JSON.stringify(value, null, 2));
  } finally {
    await writableStream.close();
  }
}

async function readImageDimensions(file) {
  if (!file) {
    return null;
  }

  try {
    if (typeof createImageBitmap === "function") {
      const imageBitmap = await createImageBitmap(file);
      const dimensions = {
        width: imageBitmap.width,
        height: imageBitmap.height,
      };
      imageBitmap.close?.();
      return dimensions;
    }

    return await readImageDimensionsWithElement(file);
  } catch {
    return null;
  }
}

function readImageDimensionsWithElement(file) {
  return new Promise((resolve, reject) => {
    const imageElement = new Image();
    const objectUrl = URL.createObjectURL(file);

    imageElement.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: imageElement.naturalWidth,
        height: imageElement.naturalHeight,
      });
    };
    imageElement.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image dimensions."));
    };
    imageElement.src = objectUrl;
  });
}

function renderScanResult(scanResult) {
  renderSummary(scanResult);
  renderProjects(scanResult);
  renderFrames(scanResult);
  updateActionButtons(scanResult);
  logMessage(`Scanned ${scanResult.origin} at ${new Date(scanResult.scannedAt).toLocaleString()}.`);
}

function renderSummary(scanResult) {
  const summaryItems = [
    ["Root entries", scanResult.rootEntries.length],
    ["Project files", scanResult.projectContentFiles.length],
    ["Metadata records", getMetadataRecordCount(scanResult.projectMetadataFile)],
    ["Frame groups", scanResult.frameGroups.length],
    ["Original files", scanResult.frameFiles.filter((frameFile) => frameFile.role === "original").length],
    ["Thumbnail files", scanResult.frameFiles.filter((frameFile) => frameFile.role === "thumbnail").length],
    ["Orphan frames", scanResult.orphanFrameGroups.length],
    ["Storage used", formatBytes(scanResult.storageEstimate?.usage)],
  ];

  summaryGridElement.replaceChildren(...summaryItems.map(([label, value]) => {
    const itemElement = document.createElement("article");
    itemElement.className = "summary-card";

    const valueElement = document.createElement("strong");
    valueElement.textContent = String(value);

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    itemElement.append(valueElement, labelElement);
    return itemElement;
  }));
}

function renderProjects(scanResult) {
  projectsCountElement.textContent = String(scanResult.projectContentFiles.length);
  projectsListElement.replaceChildren();

  if (!scanResult.projectsDirectoryExists) {
    projectsListElement.append(createEmptyState("No projects directory exists in this origin."));
    return;
  }

  const metadataSummaryElement = document.createElement("article");
  metadataSummaryElement.className = "project-card";
  metadataSummaryElement.append(
    createCardTitle("project-metadata-list.json"),
    createDetailLine("Status", getMetadataFileStatus(scanResult.projectMetadataFile)),
    createDetailLine("Records", String(getMetadataRecordCount(scanResult.projectMetadataFile))),
  );
  projectsListElement.append(metadataSummaryElement);

  if (scanResult.projectContentFiles.length === 0) {
    projectsListElement.append(createEmptyState("No project content files were found."));
    return;
  }

  for (const projectContentFile of scanResult.projectContentFiles) {
    const projectCardElement = document.createElement("article");
    projectCardElement.className = "project-card";
    const frameCount = Array.isArray(projectContentFile.parsed?.frames)
      ? projectContentFile.parsed.frames.length
      : 0;

    projectCardElement.append(
      createCardTitle(projectContentFile.name),
      createDetailLine("Project id", projectContentFile.projectId),
      createDetailLine("Title", projectContentFile.parsed?.title || "Unknown"),
      createDetailLine("Frames", String(frameCount)),
      createDetailLine("Size", formatBytes(projectContentFile.size)),
      createDetailLine("Modified", formatDate(projectContentFile.lastModified)),
    );

    if (projectContentFile.parseError) {
      projectCardElement.append(createWarningLine(projectContentFile.parseError));
    }

    projectsListElement.append(projectCardElement);
  }
}

function renderFrames(scanResult) {
  framesCountElement.textContent = String(scanResult.frameGroups.length);
  framesListElement.replaceChildren();

  if (!scanResult.framesDirectoryExists) {
    framesListElement.append(createEmptyState("No frames directory exists in this origin."));
    return;
  }

  if (scanResult.frameGroups.length === 0) {
    framesListElement.append(createEmptyState("No frame files were found."));
    return;
  }

  for (const frameGroup of scanResult.frameGroups) {
    const frameCardElement = document.createElement("article");
    frameCardElement.className = scanResult.orphanFrameGroups.includes(frameGroup)
      ? "frame-card is-orphan"
      : "frame-card";

    const previewFile = frameGroup.thumbnailFile?.file || frameGroup.originalFile?.file || null;

    if (previewFile) {
      const imageElement = document.createElement("img");
      const objectUrl = URL.createObjectURL(previewFile);
      objectUrlsToRevoke.add(objectUrl);
      imageElement.src = objectUrl;
      imageElement.alt = frameGroup.frameId;
      frameCardElement.append(imageElement);
    }

    const detailsElement = document.createElement("div");
    detailsElement.className = "frame-card-details";
    detailsElement.append(
      createCardTitle(frameGroup.frameId),
      createDetailLine("Original", frameGroup.originalFile ? formatBytes(frameGroup.originalFile.size) : "Missing"),
      createDetailLine("Thumbnail", frameGroup.thumbnailFile ? formatBytes(frameGroup.thumbnailFile.size) : "Missing"),
      createDetailLine("Modified", formatDate(
        Math.max(
          frameGroup.originalFile?.lastModified || 0,
          frameGroup.thumbnailFile?.lastModified || 0,
        ),
      )),
    );

    if (scanResult.orphanFrameGroups.includes(frameGroup)) {
      detailsElement.append(createWarningLine("Not referenced by a project content file."));
    }

    frameCardElement.append(detailsElement);
    framesListElement.append(frameCardElement);
  }
}

function updateActionButtons(scanResult) {
  const hasReadableProjectContent = scanResult.projectContentFiles.some((projectContentFile) => {
    return !projectContentFile.parseError;
  });

  restoreMetadataButtonElement.disabled = !hasReadableProjectContent;
  createProjectButtonElement.disabled = scanResult.orphanFrameGroups.length === 0;
  rescanButtonElement.disabled = false;
}

function setButtonsDisabled(disabled) {
  rescanButtonElement.disabled = disabled;
  restoreMetadataButtonElement.disabled = disabled;
  createProjectButtonElement.disabled = disabled;
  downloadReportButtonElement.disabled = disabled;
}

function renderScanError(error) {
  summaryGridElement.replaceChildren();
  projectsListElement.replaceChildren(createEmptyState("Scan failed."));
  framesListElement.replaceChildren(createEmptyState("Scan failed."));
  logMessage(formatError(error));
  rescanButtonElement.disabled = false;
}

function createStatusMessage(scanResult) {
  if (!scanResult.projectsDirectoryExists && !scanResult.framesDirectoryExists) {
    return "No Stop Motion Station OPFS directories were found for this origin.";
  }

  if (scanResult.frameGroups.length > 0 && scanResult.projectContentFiles.length === 0) {
    return "Frame files exist, but no project content files were found.";
  }

  if (scanResult.projectContentFiles.length > 0 && getMetadataRecordCount(scanResult.projectMetadataFile) === 0) {
    return "Project content files exist, but the project index is empty or missing.";
  }

  return "Scan complete.";
}

function downloadLatestReport() {
  if (!latestScanResult) {
    return;
  }

  if (latestReportObjectUrl) {
    URL.revokeObjectURL(latestReportObjectUrl);
  }

  const report = createSerializableReport(latestScanResult);
  const reportBlob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  latestReportObjectUrl = URL.createObjectURL(reportBlob);

  const downloadLink = document.createElement("a");
  downloadLink.href = latestReportObjectUrl;
  downloadLink.download = `stop-motion-opfs-report-${Date.now()}.json`;
  downloadLink.click();
}

function createSerializableReport(scanResult) {
  return {
    ...scanResult,
    frameFiles: scanResult.frameFiles.map(stripFileObject),
    frameGroups: scanResult.frameGroups.map(serializeFrameGroup),
    orphanFrameGroups: scanResult.orphanFrameGroups.map(serializeFrameGroup),
  };
}

function serializeFrameGroup(frameGroup) {
  return {
    frameId: frameGroup.frameId,
    originalFile: frameGroup.originalFile ? stripFileObject(frameGroup.originalFile) : null,
    thumbnailFile: frameGroup.thumbnailFile ? stripFileObject(frameGroup.thumbnailFile) : null,
    sortValue: frameGroup.sortValue,
  };
}

function stripFileObject(frameFile) {
  const { file, ...serializableFrameFile } = frameFile;
  return serializableFrameFile;
}

function createCardTitle(text) {
  const titleElement = document.createElement("h3");
  titleElement.textContent = text;
  return titleElement;
}

function createDetailLine(label, value) {
  const detailElement = document.createElement("div");
  detailElement.className = "detail-line";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("strong");
  valueElement.textContent = value;

  detailElement.append(labelElement, valueElement);
  return detailElement;
}

function createWarningLine(text) {
  const warningElement = document.createElement("p");
  warningElement.className = "warning-line";
  warningElement.textContent = text;
  return warningElement;
}

function createEmptyState(text) {
  const emptyStateElement = document.createElement("p");
  emptyStateElement.className = "empty-state";
  emptyStateElement.textContent = text;
  return emptyStateElement;
}

function getMetadataFileStatus(projectMetadataFile) {
  if (!projectMetadataFile) {
    return "Missing";
  }

  if (projectMetadataFile.parseError) {
    return "Unreadable JSON";
  }

  return "Readable";
}

function getMetadataRecordCount(projectMetadataFile) {
  return Array.isArray(projectMetadataFile?.parsed)
    ? projectMetadataFile.parsed.length
    : 0;
}

function setStatus(text) {
  statusPanelElement.textContent = text;
}

function logMessage(text) {
  const timestamp = new Date().toLocaleTimeString();
  messageLogElement.textContent = `[${timestamp}] ${text}\n${messageLogElement.textContent}`;
}

function revokeRenderedObjectUrls() {
  for (const objectUrl of objectUrlsToRevoke) {
    URL.revokeObjectURL(objectUrl);
  }

  objectUrlsToRevoke.clear();
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatBytes(byteCount) {
  if (!Number.isFinite(byteCount)) {
    return "Unknown";
  }

  if (byteCount < 1024) {
    return `${byteCount} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = byteCount / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatDate(milliseconds) {
  if (!milliseconds) {
    return "Unknown";
  }

  return new Date(milliseconds).toLocaleString();
}

function compareNamedRecords(firstRecord, secondRecord) {
  return firstRecord.name.localeCompare(secondRecord.name);
}

function compareProjectFiles(firstProjectFile, secondProjectFile) {
  return secondProjectFile.lastModified - firstProjectFile.lastModified;
}

function compareFrameFiles(firstFrameFile, secondFrameFile) {
  const sortComparison = getFrameSortValue(firstFrameFile) - getFrameSortValue(secondFrameFile);

  if (sortComparison !== 0) {
    return sortComparison;
  }

  return firstFrameFile.name.localeCompare(secondFrameFile.name);
}

function compareFrameGroups(firstFrameGroup, secondFrameGroup) {
  const sortComparison = firstFrameGroup.sortValue - secondFrameGroup.sortValue;

  if (sortComparison !== 0) {
    return sortComparison;
  }

  return firstFrameGroup.frameId.localeCompare(secondFrameGroup.frameId);
}
