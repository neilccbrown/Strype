<template>
</template>

<script setup lang="ts">
import { eventBus } from "@/helpers/appContext";
import { adjustContextMenuPosition, CustomEventTypes } from "@/helpers/editor";
import { CoordPosition, StrypeContextMenuItem } from "@/types/types";
import ContextMenu from "@imengyu/vue3-context-menu";
import { watch } from "vue";

const contextMenuDefaultOptions =  {
    // These are the default option settings for the Strype context menu (used througout the application)
    zIndex: 600,
    minWidth: 10 * parseFloat(getComputedStyle(document.documentElement).fontSize), // equivalent to old context menu, 10 rem                
    x: 0, y: 0, // The coordinates need to be handled by the context menu callers                 
};

const props = defineProps<{
    contextMenuItemsDef: StrypeContextMenuItem[],
    showContextMenu: Boolean,
    showAt: CoordPosition,
    onOpened?: VoidFunction,
    onClosed?: VoidFunction,
    doAfterShownOnMenuItem?: (ctxMenuItemDef: StrypeContextMenuItem, menuEntryWrapperElement: HTMLDivElement) => void,
    doAfterShownOnMenuItemKeyboardFocusAddedObs?: (ctxMenuItemDef: StrypeContextMenuItem) => void,
    doAfterShownOnMenuItemKeyboardFocusRemovedObs?: (ctxMenuItemDef: StrypeContextMenuItem) => void,
}>();

// Watch when the showContextMenu property is set to true, to show the context menu
watch(
    () => props.showContextMenu,
    (newVal, _) => {
        // We only need to handle the case when the menu shows, as the Vue 3 context menu component already handles
        // what we need to be removed when the menu is disused.
        if(newVal){
            showContextMenu();            
        }
    }
);

function showContextMenu() {
    // Trigger the context menu (we add a small offset to the X position to avoid the mouse position staying over the first menu entry (HTML) element,
    // when the menu is opened, because otherwise, we won't get the hover event being raised for that first element since the event registration callback
    // wouldn't be called "later".
    ContextMenu.showContextMenu({...contextMenuDefaultOptions, x: props.showAt.x + 1, y: props.showAt.y, items: props.contextMenuItemsDef, onClose: props.onClosed, closeWhenScroll: false});

    // Notify the context menu is opened
    if(props.onOpened){
        props.onOpened();
    }

    // With the Vue3 context menu, there are few things we cannot set directly on the menu items definitions that we would like to be used in the HTML menu entry,
    // so we do that in this part - some things are generic and will be done for every context menus, some depends on a specific menu and are taylored by the caller,
    // which will the right props of this component (functions) we can call below.
    setTimeout(() => {
        const contextMenu = document.querySelector(".mx-context-menu");
        if(contextMenu){
            // Add an ARIA role attribute to the menu
            contextMenu.setAttribute("role", "menu");

            props.contextMenuItemsDef.forEach((ctxMenuItemDef, itemPos) => {
                applyOnContextMenuItems(contextMenu as HTMLElement, ctxMenuItemDef, itemPos);                 
            });

            // We position the menu if the menu was opened (via a keyboard shortcut)
            adjustContextMenuPosition(contextMenu as HTMLElement, props.showAt.pos);
        }
    }, 100);  

    // Notify the context menu is opened
    if(props.onOpened){
        props.onOpened();
    }
}

function applyOnContextMenuItems(cxtMenu: HTMLElement, ctxMenuItemDef: StrypeContextMenuItem, itemPos: number){
    const menuEntryWrapperElement = cxtMenu.querySelectorAll(".mx-context-menu-items > div")[itemPos];                
    const menuEntryHTMLItem = menuEntryWrapperElement?.querySelector(".mx-context-menu-item");
    if(menuEntryWrapperElement && menuEntryHTMLItem){
        // Add the mouse over registration here, see App.vue for the event handler itself.
        (menuEntryHTMLItem as HTMLDivElement).onmouseenter = (event) => eventBus.emit(CustomEventTypes.contextMenuHovered, event.target as HTMLElement);

        // Add an ARIA role attribute to the menu item (we could have done it attrs of the StrypeContextMenuItem items, but since we're already looping, better do so here...)
        (menuEntryHTMLItem as HTMLDivElement).setAttribute("role", "menuitem");
                    
        // We need to register some event handlers on the menu HTML item
        if(props.doAfterShownOnMenuItem){
            props.doAfterShownOnMenuItem(ctxMenuItemDef, menuEntryWrapperElement as HTMLDivElement);
        }                         
                    
        // Add class "keyboard-focus" change listener on the menu HTML item to handle the conflict situation of  hovering/selecting a menu element with keyboard,
        // plus any other cases if requested.
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.attributeName === "class") {
                    if((m.target as HTMLDivElement).classList.contains("keyboard-focus")){
                        // When an element of the menu is hovered, it shows as selected. If then the keyboard 
                        // is used to change the selection, we need to explicitly remove the "keyboard-focus" on
                        // the hovered element since we have added this class ourselves before, so we don't end up
                        // with 2 selections in the menu. (All other cases are handled properly within the menu.)
                        if(document?.querySelectorAll(".mx-context-menu .keyboard-focus").length > 1){
                            // Remove the other, which is the one being hovered
                            Array.from(document?.querySelectorAll(".mx-context-menu .keyboard-focus")).forEach((mi) => {
                                if(mi.matches(":hover")){
                                    mi.classList.remove("keyboard-focus");
                                }
                            });
                        }
                        props.doAfterShownOnMenuItemKeyboardFocusAddedObs?.(ctxMenuItemDef);
                        
                    }
                    else{
                        props.doAfterShownOnMenuItemKeyboardFocusRemovedObs?.(ctxMenuItemDef);
                    }
                }
            }
        });
        // Listen to the keyboard focus class set onto the underlying context menu item element                            
        if(menuEntryHTMLItem){
            observer.observe(menuEntryHTMLItem, { attributes: true });
        }                            

        // If this menu entry has children, we apply the same on them too when the related context menu is opened
        // (this simpler handling works for our current configuration: 1 submenu existing on 1 entry for caret container context menu)
        if(ctxMenuItemDef.children){
            ctxMenuItemDef.onSubMenuOpen = () => ctxMenuItemDef.children?.forEach((subCxtMenuItemDef, subItemPos) => {                
                applyOnContextMenuItems(document.querySelectorAll(".mx-context-menu")[1] as HTMLElement, subCxtMenuItemDef, subItemPos);
            });
        }
    }
}
</script>

<style lang="scss">
/**
 * Style defined for the context menus (based on CSS templates of the Vue3 Contenxt Menu package)
 * (note that the method onContextMenuHover() in App.vue handles conflicts between selection and hovering)
 */
$black: #333;
$hover-blue: #5a7bfc;
$background-grey: #ecf0f1;
$divider-grey: darken($background-grey, 15%);

.mx-context-menu {
    --mx-menu-text: #{$black};
    --mx-menu-active-text: white;
    --mx-menu-backgroud: #{$background-grey};
    --mx-menu-divider: #{$divider-grey};
    --mx-menu-shortcut-backgroud: #{$background-grey};
    --mx-menu-shortcut-backgroud-active: #{$hover-blue};
    --mx-menu-shortcut-text: gray;
    --mx-menu-shortcut-text-active: white;
    --mx-menu-active-backgroud: #{$hover-blue};
    margin:0 !important;
    padding: 0 !important;
    box-shadow: 0 3px 6px 0 rgba($black, 0.2) !important;
    border-radius: 4px !important;
}

.mx-context-menu .keyboard-focus {
    --mx-menu-text: white;
    --mx-menu-shortcut-backgroud: #{$hover-blue};
    --mx-menu-shortcut-text: white !important;
}

.mx-context-menu .keyboard-focus:hover {
    --mx-menu-hover-text: white;
    --mx-menu-shortcut-backgroud-hover: #{$hover-blue};
    --mx-menu-shortcut-text-hover: white;
}

.mx-icon-placeholder {
    width: 0 !important;
}

.mx-shortcut {
    padding-left: 0 !important;
    padding-right: 0 !important;
}

.mx-context-menu-item-sperator { //yes, the typo is in their source code...
    padding: 2px 0 !important;
}

// Autocompletion menu styling
.#{$strype-classname-ac-item}.#{$strype-classname-ac-item-selected} {
    text-decoration:none;
    color:white !important;
    background-color: $hover-blue;
}
</style>