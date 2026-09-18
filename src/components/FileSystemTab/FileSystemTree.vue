<template>
    <ul class="file-system-tree-node">
        <li>
            <span v-if="node.isDir" class="file-system-tree-dir" @click="expanded = !expanded">
                <span class="file-system-tree-chevron">{{ expanded ? "▾" : "▸" }}</span>
                {{ node.name }}
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
                    @download="(n) => $emit('download', n)"
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
        // FileSystemPane passes true for the top-level /data and /local roots so they open
        // immediately; nested directories always start collapsed.
        startExpanded: { type: Boolean, default: false },
    },

    emits: ["download"],

    data() {
        return {
            expanded: this.startExpanded,
        };
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
    cursor: pointer;
    user-select: none;
}

.file-system-tree-chevron {
    display: inline-block;
    width: 1em;
}

.file-system-tree-download-btn {
    margin-left: 0.5em;
}

.file-system-tree-empty {
    opacity: 0.6;
    font-style: italic;
}
</style>
