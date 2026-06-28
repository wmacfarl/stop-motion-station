import assert from "node:assert/strict";
import test from "node:test";

import {
  createProjectMetadataRecordFromContentRecord,
} from "../services/project-storage-service.js";

test("createProjectMetadataRecordFromContentRecord rebuilds browser metadata from project content", () => {
  const projectMetadata = createProjectMetadataRecordFromContentRecord({
    projectId: "project-one",
    updatedAtMilliseconds: 1234,
    projectContentRecord: {
      title: "Recovered Project",
      frames: [
        {
          id: "first-frame",
          thumbnailStorageKey: "first-frame-timeline.jpg",
        },
        {
          id: "second-frame",
          thumbnailStorageKey: "second-frame-timeline.jpg",
        },
      ],
    },
  });

  assert.deepEqual(projectMetadata, {
    id: "project-one",
    title: "Recovered Project",
    createdAtMilliseconds: 1234,
    updatedAtMilliseconds: 1234,
    thumbnailImageSource: null,
    thumbnailStorageKey: "second-frame-timeline.jpg",
  });
});

test("createProjectMetadataRecordFromContentRecord tolerates sparse content", () => {
  const projectMetadata = createProjectMetadataRecordFromContentRecord({
    projectId: "project-two",
    updatedAtMilliseconds: 5678,
    projectContentRecord: {},
  });

  assert.equal(projectMetadata.title, "Untitled Project");
  assert.equal(projectMetadata.thumbnailImageSource, null);
  assert.equal(projectMetadata.thumbnailStorageKey, null);
});
