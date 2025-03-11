<template>
  <svg :class="{'svg-icon':true, ...customClass}" :style="{...customStyle}">
    <use :xlink:href="'#strype-svgicon-'+name" fill="currentColor"></use>
  </svg>
</template>

<script lang="ts">

import Vue from "vue";

/**
 * This SVGIcon component is a helper component to use in place
 * of fontawesome (when we don't find a proper icon), it relies
 * on a SVG containing the different named symbols we need.
 * 
 * The SVG to look for symbols is inserted in index.html (rather
 * than App.vue because we need it to be loaded ASAP).
 */

export default Vue.extend({
    name: "SVGIcon",

    props: {
        name: { type: String, required: true }, // the icon name
        customClass: { type: Object, required: false}, // the custom class to apply to the icon
        customStyle: {type: Object, required: false}, // the custom style to apply to the icon
    },
});
</script>

<style lang="scss">
    // The default style of our SVG icons
    .svg-icon {
        width: 24px;
        height: 24px;
        fill: currentColor; /* Inherits text color */
    }
</style>
