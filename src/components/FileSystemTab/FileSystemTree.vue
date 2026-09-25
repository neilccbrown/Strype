<template>
    <ul class="file-system-tree-node">
        <li>
            <span v-if="node.isDir" class="file-system-tree-dir">
                <span class="file-system-tree-chevron" @click="expanded = !expanded">{{ expanded ? "▾" : "▸" }}</span>
                <span
                    class="file-system-tree-label"
                    :class="{ 'file-system-tree-label-cwd': isCwd, 'flash-background': justCopied }"
                    :title="labelTitle"
                    @click="copyPath"
                    @animationend="justCopied = false"
                >{{ labelOverride ?? node.name }}</span>
                <span class="file-system-tree-spacer"></span>
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
                    class="file-system-tree-upload-input"
                    style="display:none"
                    @change="onFileSelected"
                />
                <button
                    class="file-system-tree-download-btn"
                    :title="$t('fileSystemTab.downloadZip')"
                    @click="$emit('downloadDir', node)"
                >
                    <i class="fa fa-download"></i>
                </button>
            </span>
            <span v-else class="file-system-tree-file">
                <span
                    class="file-system-tree-label"
                    :class="{ 'flash-background': justCopied }"
                    :title="labelTitle"
                    @click="copyPath"
                    @animationend="justCopied = false"
                >{{ node.name }}</span>
                <span class="file-system-tree-spacer"></span>
                <button class="file-system-tree-download-btn" :title="$t('fileSystemTab.download')" @click="$emit('download', node)">
                    <i class="fa fa-download"></i>
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
                    @downloadDir="(n) => $emit('downloadDir', n)"
                    @upload="(n, file) => $emit('upload', n, file)"
                />
            </ul>
        </li>
    </ul>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { FsTreeNode } from "@/stryperuntime/file_system_tree_types";

export default defineComponent({
    name: "FileSystemTree",

    props: {
        node: { type: Object as PropType<FsTreeNode>, required: true },
        // FileSystemPane passes true for the top-level asset roots, /local and /cloud so they
        // open immediately; nested directories always start collapsed.
        startExpanded: { type: Boolean, default: false },
        // Whether directories in this subtree get an upload button -- true under /local and /cloud,
        // false under the read-only asset roots (/data, /books, etc).
        allowUpload: { type: Boolean, default: false },
        // Uploads are disabled while Python is executing (see FileSystemPane.vue): both /local's
        // main-thread cache and /cloud's cache (cloudFileIO.ts) are only meant to be touched
        // between runs, not while a run might also be reading/writing the same files.
        uploadDisabled: { type: Boolean, default: false },
        // Whether this node is the directory that will be the current working directory when the
        // code is next run. Only ever true for the root node passed in by FileSystemPane.vue --
        // it's deliberately not forwarded to the recursive FileSystemTree below, since the cwd is
        // always a /local or /cloud root, never a subdirectory.
        isCwd: { type: Boolean, default: false },
        // Overrides the displayed label for this node only (e.g. "/data/" instead of the bare
        // node name "data") -- like isCwd, deliberately not forwarded to the recursive
        // FileSystemTree below, so it only ever affects the root node passed in by FileSystemPane.
        labelOverride: { type: String, default: null },
    },

    emits: ["download", "downloadDir", "upload"],

    data() {
        return {
            expanded: this.startExpanded,
            // Flash the label briefly after a click copies its path -- see copyPath()/the
            // "flash-background"/"flash-bg-anim" keyframes (defined globally in
            // PythonExecutionArea.vue, alongside the console's own copy-to-clipboard button).
            justCopied: false,
        };
    },

    computed: {
        labelTitle(): string {
            const copyHint = this.$t("fileSystemTab.copyPath") as string;
            return this.isCwd ? `${this.$t("fileSystemTab.cwd")} -- ${copyHint}` : copyHint;
        },
    },

    methods: {
        copyPath(): void {
            navigator.clipboard.writeText(this.node.path);
            this.justCopied = true;
        },

        clickUploadInput(): void {
            (this.$refs.uploadInput as HTMLInputElement).click();
        },

        onFileSelected(event: Event): void {
            const input = event.target as HTMLInputElement;
            const file = input.files?.[0];
            input.value = "";
            if (!file) {
                return;
            }
            this.expanded = true;
            this.$emit("upload", this.node, file);
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

.file-system-tree-dir,
.file-system-tree-file {
    display: flex;
    align-items: center;
}

.file-system-tree-label {
    cursor: pointer;
    user-select: none;
    border-radius: 3px;
    padding: 0 2px;
}

.file-system-tree-label-cwd {
    font-weight: bold;
}

.file-system-tree-chevron {
    display: inline-block;
    width: 1em;
    cursor: pointer;
    user-select: none;
}

.file-system-tree-spacer {
    flex: 1;
}

.file-system-tree-download-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    color: inherit;
    margin-left: 0.5em;
    flex-shrink: 0;
}

.file-system-tree-download-btn:hover {
    opacity: 0.6;
}

.file-system-tree-upload-btn {
    margin-left: 0.5em;
    flex-shrink: 0;
}

.file-system-tree-empty {
    opacity: 0.6;
    font-style: italic;
}
</style>
