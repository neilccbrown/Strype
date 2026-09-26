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
                    v-if="allowDelete"
                    class="file-system-tree-delete-btn"
                    :disabled="uploadDisabled"
                    :title="$t('fileSystemTab.deleteDir')"
                    @click="$emit('delete', node)"
                >
                    <i class="fa fa-trash"></i>
                </button>
                <button
                    class="file-system-tree-download-btn"
                    :title="$t('fileSystemTab.downloadZip')"
                    @click="$emit('downloadDir', node)"
                >
                    <i class="fa fa-download"></i>
                </button>
            </span>
            <span v-else class="file-system-tree-file">
                <!-- Same width as a directory's chevron (below), so every row's label -- file or
                     directory, at any nesting depth -- starts at the same fixed column, however
                     deep it is; the invisible-prefix text is what conveys the nesting instead: -->
                <span class="file-system-tree-chevron-spacer"></span>
                <span
                    class="file-system-tree-label"
                    :class="{ 'flash-background': justCopied }"
                    :title="labelTitle"
                    @click="copyPath"
                    @animationend="justCopied = false"
                ><span class="file-system-tree-invisible" aria-hidden="true">{{ invisiblePrefix }}</span>{{ node.name }}</span>
                <span class="file-system-tree-spacer"></span>
                <button
                    v-if="allowDelete"
                    class="file-system-tree-delete-btn"
                    :disabled="uploadDisabled"
                    :title="$t('fileSystemTab.delete')"
                    @click="$emit('delete', node)"
                >
                    <i class="fa fa-trash"></i>
                </button>
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
                    :allow-delete="allowDelete"
                    :upload-disabled="uploadDisabled"
                    :invisible-prefix="childInvisiblePrefix"
                    @download="(n) => $emit('download', n)"
                    @downloadDir="(n) => $emit('downloadDir', n)"
                    @upload="(n, file) => $emit('upload', n, file)"
                    @delete="(n) => $emit('delete', n)"
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
        // Whether items in this subtree get a delete button -- true only under /local (see
        // FileSystemPane.vue): unlike upload, this isn't offered under /cloud too, since deleting a
        // cloud file needs real API calls this doesn't (yet) make, not just a local cache edit.
        allowDelete: { type: Boolean, default: false },
        // Uploads/deletes are disabled while Python is executing (see FileSystemPane.vue): /local's
        // main-thread cache (and, for uploads only, /cloud's cache in cloudFileIO.ts) are only meant
        // to be touched between runs, not while a run might also be reading/writing the same files.
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
        // An invisible (visibility:hidden, revealed on hover -- see the CSS below) copy of this
        // text is rendered before the node's own label, in the same font, so the *visible* label
        // lines up with wherever the text of the row above it ended -- e.g. under "/books/", every
        // child's name starts exactly where "/books/" itself ends, rather than at a fixed small
        // indent. Accumulates as it recurses (see the recursive FileSystemTree below, which passes
        // this node's own invisiblePrefix + ownLabelText down as its children's prefix), and also
        // doubles as a hover hint showing the item's full path.
        invisiblePrefix: { type: String, default: "" },
    },

    emits: ["download", "downloadDir", "upload", "delete"],

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
        // What's actually shown as this node's own label (directories only -- see the template):
        // labelOverride for the root nodes FileSystemPane.vue passes it for (e.g. "/books/", which
        // already has its own trailing slash baked in), otherwise the plain node name with a
        // trailing slash added (e.g. "backgrounds/") so it reads as a path segment and so
        // childInvisiblePrefix below can append it without the two run together (e.g.
        // "backgroundsspace" for a "space.png" under "backgrounds" without the slash).
        ownLabelText(): string {
            if (this.labelOverride != null) {
                return this.labelOverride;
            }
            return this.node.isDir ? this.node.name + "/" : this.node.name;
        },

        // The invisible-alignment prefix to pass down to this node's own children (see
        // invisiblePrefix's own comment) -- this node's own inherited prefix plus its own label,
        // which (per ownLabelText above) always ends in "/". Accumulates at every nesting level,
        // so e.g. a file two levels under "/images/" (in "backgrounds") gets the invisible prefix
        // "/images/backgrounds/" and a visible label starting exactly where that ends:
        childInvisiblePrefix(): string {
            return this.invisiblePrefix + this.ownLabelText;
        },

        labelTitle(): string {
            const copyHint = this.$t("fileSystemTab.copyPath") as string;
            return this.isCwd ? `${this.$t("fileSystemTab.cwd")} -- ${copyHint}` : copyHint;
        },

        // What copyPath() below actually puts on the clipboard: with the leading "/local/" or
        // "/cloud/" stripped off for anything under either of those roots, since one of them is
        // always the working directory the code runs from (see cwdRoot, FileSystemPane.vue) -- a
        // plain relative path (e.g. "photo.png", not "/local/photo.png") is what you'd actually
        // write in open(...) etc. Left as the full path for everything else (the read-only asset
        // roots): those are never the working directory, so only their absolute path ever resolves.
        pathToCopy(): string {
            const path = this.node.path;
            for (const cwdRoot of ["/local", "/cloud"]) {
                if (path === cwdRoot) {
                    return ".";
                }
                if (path.startsWith(cwdRoot + "/")) {
                    return path.slice(cwdRoot.length + 1);
                }
            }
            return path;
        },
    },

    methods: {
        copyPath(): void {
            navigator.clipboard.writeText(this.pathToCopy);
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
// No left indent at any nesting depth -- deliberately: the folding triangle stays in a single
// fixed-left column at every depth (matching the section heading above the whole tree) instead of
// stepping in further with each level, and the invisible-prefix text (see invisiblePrefix) is what
// conveys nesting instead, via each row's *label* starting further right the deeper it is. Browsers
// give a bare <ul> its own default padding otherwise, so this has to be reset explicitly:
.file-system-tree-node,
.file-system-tree-children {
    list-style: none;
    margin: 0;
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

.file-system-tree-chevron-spacer {
    display: inline-block;
    width: 1em;
}

.file-system-tree-spacer {
    flex: 1;
}

// Deliberately two separate classes, not one shared class on both buttons: tests (and any other
// code) locating ".file-system-tree-download-btn" within a row must find exactly the download
// button, never also the delete button next to it.
.file-system-tree-download-btn,
.file-system-tree-delete-btn {
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

// A slight red tint on hover, distinguishing it from the (non-destructive) download button next
// to it:
.file-system-tree-delete-btn:hover {
    color: #c33;
}

.file-system-tree-dir:hover > .file-system-tree-download-btn,
.file-system-tree-file:hover > .file-system-tree-download-btn,
.file-system-tree-dir:hover > .file-system-tree-delete-btn,
.file-system-tree-file:hover > .file-system-tree-delete-btn {
    visibility: visible;
}

.file-system-tree-upload-btn {
    // No margin-left here: the flex spacer before it (in a tree row) already provides the
    // separation, and FileSystemPane.vue's standalone "Local files" upload row (not preceded by a
    // label/spacer at all) needs this to be flush left, matching the "(empty)" message above it.
    flex-shrink: 0;
}

.file-system-tree-empty {
    opacity: 0.6;
    font-style: italic;
}
</style>
