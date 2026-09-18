<template>
    <div class="file-system-pane">
        <div v-if="loading" class="file-system-pane-loading">{{ $t("fileSystemTab.loading") }}</div>
        <template v-else>
            <div v-if="isPythonExecuting" class="file-system-pane-running-note">
                {{ $t("fileSystemTab.programRunning") }}
            </div>
            <div class="file-system-pane-root" v-if="dataRoot">
                <h4>{{ $t("fileSystemTab.data") }}</h4>
                <FileSystemTree :node="dataRoot" start-expanded @download="(n) => onDownload(n, '/data')" />
            </div>
            <div class="file-system-pane-root" v-if="cloudRoot">
                <h4>{{ $t("fileSystemTab.cloud") }}</h4>
                <FileSystemTree
                    :node="cloudRoot"
                    start-expanded
                    allow-upload
                    :upload-disabled="isPythonExecuting"
                    @download="(n) => onDownload(n, '/cloud')"
                    @upload="(n, file) => onUpload(n, file, '/cloud')"
                />
            </div>
            <div class="file-system-pane-root" v-if="localRoot">
                <h4>{{ $t("fileSystemTab.local") }}</h4>
                <FileSystemTree
                    :node="localRoot"
                    start-expanded
                    allow-upload
                    :upload-disabled="isPythonExecuting"
                    @download="(n) => onDownload(n, '/local')"
                    @upload="(n, file) => onUpload(n, file, '/local')"
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
            dataRoot: null as FsTreeNode | null,
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
    },

    mounted() {
        this.refresh();
    },

    methods: {
        async refresh(): Promise<void> {
            this.loading = true;
            const [dataRoot, localRoot, cloudRoot] = await Promise.all([
                listFsRootTree("/data"),
                listFsRootTree("/local"),
                isCloudMounted() ? listFsRootTree("/cloud") : Promise.resolve(null),
            ]);
            this.dataRoot = dataRoot;
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
</style>
