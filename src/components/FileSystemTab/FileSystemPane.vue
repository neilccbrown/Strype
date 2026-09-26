<template>
    <div class="file-system-pane">
        <div v-if="loading" class="file-system-pane-loading">{{ $t("fileSystemTab.loading") }}</div>
        <template v-else>
            <div v-if="isPythonExecuting" class="file-system-pane-running-note">
                {{ $t("fileSystemTab.programRunning") }}
            </div>
            <!-- Deliberately no FileSystemTree for "local" itself (unlike cloudRoot/assetRoots below):
                 its children are listed flat, straight under this heading, rather than behind a
                 redundant bold "local" row that just repeats what the heading above it already says. -->
            <div class="file-system-pane-root" v-if="localRoot">
                <h4
                    :class="{ 'file-system-tree-label-cwd': cwdRoot === '/local' }"
                    :title="cwdRoot === '/local' ? $t('fileSystemTab.cwd') : undefined"
                >{{ $t("fileSystemTab.local") }}</h4>
                <div v-if="(localRoot.children ?? []).length === 0" class="file-system-tree-empty file-system-pane-flat-item">
                    {{ $t("fileSystemTab.emptyFolder") }}
                </div>
                <FileSystemTree
                    v-for="child in localRoot.children"
                    :key="child.path"
                    :node="child"
                    allow-upload
                    :upload-disabled="isPythonExecuting"
                    @download="(n) => onDownload(n, '/local')"
                    @downloadDir="(n) => onDownloadDir(n, '/local')"
                    @upload="(n, file) => onUpload(n, file, '/local')"
                />
                <div class="file-system-pane-flat-item">
                    <button
                        class="file-system-tree-upload-btn"
                        :disabled="isPythonExecuting"
                        :title="$t('fileSystemTab.upload')"
                        @click="clickLocalUploadInput"
                    >
                        {{ $t("fileSystemTab.upload") }}
                    </button>
                    <input ref="localUploadInput" type="file" class="file-system-tree-upload-input" style="display:none" @change="onLocalFileSelected" />
                </div>
            </div>
            <div class="file-system-pane-root" v-if="cloudRoot">
                <h4>{{ $t("fileSystemTab.cloud") }}</h4>
                <FileSystemTree
                    :node="cloudRoot"
                    start-expanded
                    allow-upload
                    :upload-disabled="isPythonExecuting"
                    :is-cwd="cwdRoot === '/cloud'"
                    @download="(n) => onDownload(n, '/cloud')"
                    @downloadDir="(n) => onDownloadDir(n, '/cloud')"
                    @upload="(n, file) => onUpload(n, file, '/cloud')"
                />
            </div>
            <div class="file-system-pane-root" v-if="assetRoots.length">
                <h4>{{ $t("fileSystemTab.builtIn") }}</h4>
                <FileSystemTree
                    v-for="entry in assetRoots"
                    :key="entry.root"
                    :node="entry.tree"
                    :label-override="entry.root + '/'"
                    @download="(n) => onDownload(n, entry.root)"
                    @downloadDir="(n) => onDownloadDir(n, entry.root)"
                />
            </div>
        </template>
        <ArchiveImportDialog
            :dlgId="archiveImportDlgId"
            :fileName="pendingUpload?.file.name ?? ''"
            @keep-zip="onKeepAsZip"
            @unzip="onUnzipContents"
            @cancelled="pendingUpload = null"
        />
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapStores } from "pinia";
import { useStore } from "@/store/store";
import { PythonExecRunningState } from "@/types/types";
import FileSystemTree from "@/components/FileSystemTab/FileSystemTree.vue";
import ArchiveImportDialog from "@/components/FileSystemTab/ArchiveImportDialog.vue";
import {
    assetsRoots,
    downloadFsDirectoryAsZip,
    downloadFsFile,
    FsRoot,
    isCloudMounted,
    listFsRootTree,
    uploadEntriesToCloud,
    uploadEntriesToLocal,
    uploadToCloud,
    uploadToLocal,
} from "@/helpers/fileSystemTabIO";
import { FsTreeNode } from "@/stryperuntime/file_system_tree_types";
import { isZipFile, unzipEntries } from "@/helpers/archive";
import { eventBus } from "@/helpers/appContext";
import { CustomEventTypes } from "@/helpers/editor";

interface PendingUpload {
    dirNode: FsTreeNode,
    file: File,
    root: "/local" | "/cloud",
}

export default defineComponent({
    name: "FileSystemPane",

    components: {
        FileSystemTree,
        ArchiveImportDialog,
    },

    data() {
        return {
            loading: true,
            assetRoots: [] as { root: FsRoot, tree: FsTreeNode }[],
            localRoot: null as FsTreeNode | null,
            cloudRoot: null as FsTreeNode | null,
            // Set while the "keep as zip / unzip contents" dialog is open for a .zip upload --
            // see onUpload()/ArchiveImportDialog.vue.
            pendingUpload: null as PendingUpload | null,
        };
    },

    computed: {
        ...mapStores(useStore),

        isPythonExecuting(): boolean {
            return this.appStore.pythonExecRunningState != PythonExecRunningState.NotRunning;
        },

        archiveImportDlgId(): string {
            return "fileSystemArchiveImportDlg";
        },

        // The root that will be the current working directory when the code is next run --
        // matches the mounting logic in python-execution.ts's executePython() (startInSlashCloud).
        cwdRoot(): "/local" | "/cloud" {
            return isCloudMounted() ? "/cloud" : "/local";
        },
    },

    mounted() {
        this.refresh();
    },

    methods: {
        async refresh(): Promise<void> {
            this.loading = true;
            const roots = assetsRoots();
            const [assetTrees, localRoot, cloudRoot] = await Promise.all([
                Promise.all(roots.map((root) => listFsRootTree(root))),
                listFsRootTree("/local"),
                isCloudMounted() ? listFsRootTree("/cloud") : Promise.resolve(null),
            ]);
            this.assetRoots = roots
                .map((root, i) => ({root, tree: assetTrees[i]}))
                .filter((entry): entry is { root: FsRoot, tree: FsTreeNode } => entry.tree != null);
            this.localRoot = localRoot;
            this.cloudRoot = cloudRoot;
            this.loading = false;
        },

        async refreshLocal(): Promise<void> {
            this.localRoot = await listFsRootTree("/local");
        },

        async refreshCloud(): Promise<void> {
            this.cloudRoot = isCloudMounted() ? await listFsRootTree("/cloud") : null;
        },

        onDownload(node: FsTreeNode, root: FsRoot): void {
            void downloadFsFile(node, root);
        },

        onDownloadDir(node: FsTreeNode, root: FsRoot): void {
            void downloadFsDirectoryAsZip(node, root);
        },

        // "/local" doesn't render its own root row (see the template) -- there's no FileSystemTree
        // instance there to own an upload button/input, so this pane owns one directly instead,
        // uploading to localRoot itself (the same target the old root row's own upload button had).
        clickLocalUploadInput(): void {
            (this.$refs.localUploadInput as HTMLInputElement).click();
        },

        onLocalFileSelected(event: Event): void {
            const input = event.target as HTMLInputElement;
            const file = input.files?.[0];
            input.value = "";
            if (!file || this.localRoot == null) {
                return;
            }
            this.onUpload(this.localRoot, file, "/local");
        },

        onUpload(dirNode: FsTreeNode, file: File, root: "/local" | "/cloud"): void {
            if (isZipFile(file)) {
                // Ask the user whether to keep the archive as-is or unzip its contents -- see
                // onKeepAsZip()/onUnzipContents() below, triggered from ArchiveImportDialog.vue.
                this.pendingUpload = {dirNode, file, root};
                eventBus.emit(CustomEventTypes.showStrypeModal, this.archiveImportDlgId);
                return;
            }
            void this.uploadPlainFile(dirNode, file, root);
        },

        async uploadPlainFile(dirNode: FsTreeNode, file: File, root: "/local" | "/cloud"): Promise<void> {
            if (root === "/local") {
                await uploadToLocal(dirNode, file);
                await this.refreshLocal();
            }
            else {
                await uploadToCloud(dirNode, file);
                await this.refreshCloud();
            }
        },

        async onKeepAsZip(): Promise<void> {
            const pending = this.pendingUpload;
            this.pendingUpload = null;
            if (pending) {
                await this.uploadPlainFile(pending.dirNode, pending.file, pending.root);
            }
        },

        async onUnzipContents(): Promise<void> {
            const pending = this.pendingUpload;
            this.pendingUpload = null;
            if (!pending) {
                return;
            }
            const entries = await unzipEntries(pending.file);
            if (pending.root === "/local") {
                await uploadEntriesToLocal(pending.dirNode, entries);
                await this.refreshLocal();
            }
            else {
                await uploadEntriesToCloud(pending.dirNode, entries);
                await this.refreshCloud();
            }
        },
    },
});
</script>

<style lang="scss">
.file-system-pane {
    height: 100%;
    overflow: auto;
    padding: 0.5em;
    // Matches .pea-console's colours (PythonExecutionArea.vue) so the Files tab looks consistent
    // with the Console tab right next to it:
    background-color: #333;
    color: white;
}

// Mac Safari: always show scrollbar (when content is large enough to require one), and make it
// light -- same treatment as .pea-console's own scrollbar (PythonExecutionArea.vue):
.file-system-pane::-webkit-scrollbar {
    width: 8px;
}

.file-system-pane::-webkit-scrollbar-track {
    background: #333;
}

.file-system-pane::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 5px;
}

.file-system-pane-running-note {
    opacity: 0.7;
    font-style: italic;
    margin-bottom: 0.5em;
}

.file-system-pane-root {
    margin-bottom: 1em;

    h4 {
        margin: 0 0 0.25em 0;
    }
}

// The bits of the "Local files" section that aren't FileSystemTree instances themselves (the
// empty-folder message, the upload row) -- see the template's comment on why "/local" has no root
// row of its own to hang those off of instead. Matches the 1em gutter every file/directory row
// reserves for a folding triangle (see .file-system-tree-chevron/-spacer, FileSystemTree.vue) --
// neither of these has one of its own, any more than a file row does, so they align with those
// rows' *labels* rather than sitting flush with where a triangle would be:
.file-system-pane-flat-item {
    padding-left: 1em;
    margin-top: 0.25em;
}
</style>
