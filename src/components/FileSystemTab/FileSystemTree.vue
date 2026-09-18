<template>
    <ul class="file-system-tree-node">
        <li>
            <span v-if="node.isDir" class="file-system-tree-dir">
                <span class="file-system-tree-label" @click="expanded = !expanded">
                    <span class="file-system-tree-chevron">{{ expanded ? "▾" : "▸" }}</span>
                    {{ node.name }}
                </span>
                <button
                    v-if="allowUpload"
                    class="file-system-tree-upload-btn"
                    :disabled="uploadDisabled"
                    :title="$t('fileSystemTab.upload')"
                    @click="clickUploadInput"
                >
                    {{ $t("fileSystemTab.upload") }}
                </button>
                <input
                    v-if="allowUpload"
                    ref="uploadInput"
                    type="file"
                    style="display:none"
                    @change="onFileSelected"
                />
            </span>
            <span v-else class="file-system-tree-file">
                {{ node.name }}
                <button class="file-system-tree-download-btn" :title="$t('fileSystemTab.download')" @click="$emit('download', node)">
                    {{ $t("fileSystemTab.download") }}
                </button>
            </span>
            <ul v-if="node.isDir && expanded" class="file-system-tree-children">
                <li v-if="(node.children ?? []).length === 0" class="file-system-tree-empty">
                    {{ $t("fileSystemTab.emptyFolder") }}
                </li>
                <FileSystemTree
                    v-for="child in node.children"
                    :key="child.path"
                    :node="child"
                    :allow-upload="allowUpload"
                    :upload-disabled="uploadDisabled"
                    @download="(n) => $emit('download', n)"
                    @uploaded="$emit('uploaded')"
                />
            </ul>
        </li>
    </ul>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { FsTreeNode } from "@/stryperuntime/file_system_tree_types";
import { uploadToLocal } from "@/helpers/fileSystemTabIO";

export default defineComponent({
    name: "FileSystemTree",

    props: {
        node: { type: Object as PropType<FsTreeNode>, required: true },
        // FileSystemPane passes true for the top-level /data and /local roots so they open
        // immediately; nested directories always start collapsed.
        startExpanded: { type: Boolean, default: false },
        // Whether directories in this subtree get an upload button -- true only under /local.
        allowUpload: { type: Boolean, default: false },
        // Uploads are disabled while Python is executing (see FileSystemPane.vue): the main-thread
        // cache backing /local is only resynced with the worker at the start/end of a run, so a
        // write made mid-run would silently be lost once that run's own snapshot is taken.
        uploadDisabled: { type: Boolean, default: false },
    },

    emits: ["download", "uploaded"],

    data() {
        return {
            expanded: this.startExpanded,
        };
    },

    methods: {
        clickUploadInput(): void {
            (this.$refs.uploadInput as HTMLInputElement).click();
        },

        async onFileSelected(event: Event): Promise<void> {
            const input = event.target as HTMLInputElement;
            const file = input.files?.[0];
            input.value = "";
            if (!file) {
                return;
            }
            await uploadToLocal(this.node.path, file);
            this.expanded = true;
            this.$emit("uploaded");
        },
    },
});
</script>

<style lang="scss">
.file-system-tree-node {
    list-style: none;
    margin: 0;
    padding-left: 1em;
}

.file-system-tree-dir {
    display: flex;
    align-items: center;
}

.file-system-tree-label {
    cursor: pointer;
    user-select: none;
}

.file-system-tree-chevron {
    display: inline-block;
    width: 1em;
}

.file-system-tree-download-btn,
.file-system-tree-upload-btn {
    margin-left: 0.5em;
}

.file-system-tree-empty {
    opacity: 0.6;
    font-style: italic;
}
</style>
