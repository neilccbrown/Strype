<template>
    <ul class="file-system-tree-node" :class="{ 'file-system-tree-node-top': topLevel }">
        <li>
            <span v-if="node.isDir" class="file-system-tree-dir">
                <span class="file-system-tree-chevron" @click="expanded = !expanded">{{ expanded ? "▾" : "▸" }}</span>
                <span
                    class="file-system-tree-label"
                    :class="{ 'file-system-tree-label-cwd': isCwd, 'flash-background': justCopied }"
                    :title="labelTitle"
                    @click="copyPath"
                    @animationend="justCopied = false"
                ><span class="file-system-tree-invisible" aria-hidden="true">{{ invisiblePrefix }}</span>{{ ownLabelText }}</span>
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
                ><span class="file-system-tree-invisible" aria-hidden="true">{{ invisiblePrefix }}</span>{{ node.name }}</span>
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
                    :invisible-prefix="childInvisiblePrefix"
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
        // Removes this node's own left indent (see .file-system-tree-node-top below) so its
        // folding triangle/label lines up with the section heading above it, rather than sitting
        // one indent level in from it. FileSystemPane.vue passes this for every root-level
        // FileSystemTree it renders directly (the asset roots, "cloud", local's own children) --
        // deliberately not forwarded to the recursive FileSystemTree below, so only ever true for
        // that first row, never anything nested under it.
        topLevel: { type: Boolean, default: false },
        // An invisible (visibility:hidden, revealed on hover -- see the CSS below) copy of this
        // text is rendered before the node's own label, in the same font, so the *visible* label
        // lines up with wherever the text of the row above it ended -- e.g. under "/books/", every
        // child's name starts exactly where "/books/" itself ends, rather than at a fixed small
        // indent. Accumulates as it recurses (see the recursive FileSystemTree below, which passes
        // this node's own invisiblePrefix + ownLabelText down as its children's prefix), and also
        // doubles as a hover hint showing the item's full path.
        invisiblePrefix: { type: String, default: "" },
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
        // What's actually shown as this node's own label -- labelOverride for the root nodes
        // FileSystemPane.vue passes it for (e.g. "/books/"), otherwise the plain node name.
        ownLabelText(): string {
            return this.labelOverride ?? this.node.name;
        },

        // The invisible-alignment prefix to pass down to this node's own children (see
        // invisiblePrefix's own comment). Only ever non-empty for the direct children of a
        // labelOverride'd root (e.g. "/books/"'s own children): labelOverride text already reads
        // as a full path with its own trailing slash, so appending it verbatim reads naturally.
        // Deeper levels reset to "" rather than keep accumulating plain node names with no
        // separator between them, which would otherwise read as one run-together word on hover
        // (e.g. "backgroundsspace" for a "space.png" two levels under "/images/"):
        childInvisiblePrefix(): string {
            return this.labelOverride != null ? this.invisiblePrefix + this.ownLabelText : "";
        },

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

// Each child's own indent comes entirely from its own recursive FileSystemTree's outer
// .file-system-tree-node (above) -- this wrapper (rendered by the *parent*, around its children)
// must not add any further padding of its own, or it stacks with that and the invisible-text
// alignment (see invisiblePrefix) ends up short of where it's meant to land. Browsers give a
// bare <ul> its own default padding otherwise, so this has to be reset explicitly:
.file-system-tree-children {
    list-style: none;
    margin: 0;
    padding-left: 0;
}

// Root-level rows (see the topLevel prop) skip the usual indent, so their folding triangle lines
// up with the section heading above them instead of sitting one indent step in from it:
.file-system-tree-node-top {
    padding-left: 0;
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

.file-system-tree-invisible {
    visibility: hidden;
}

.file-system-tree-label:hover .file-system-tree-invisible {
    visibility: visible;
    opacity: 0.5;
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
    opacity: 0.5;
    font-size: 0.9em;
    margin-left: 0.5em;
    flex-shrink: 0;
    // Hidden (not display:none, so it doesn't shift the row's layout) until the row is hovered --
    // see the two rules just below:
    visibility: hidden;
}

.file-system-tree-download-btn:hover {
    opacity: 0.8;
}

.file-system-tree-dir:hover > .file-system-tree-download-btn,
.file-system-tree-file:hover > .file-system-tree-download-btn {
    visibility: visible;
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
