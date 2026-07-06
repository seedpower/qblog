import type { MermaidConfig } from 'mermaid'

const HANDWRITTEN_FONT = 'var(--font-caveat), "Segoe Print", "Bradley Hand", cursive, sans-serif'

const MERMAID_LABEL_CSS = `
  .node .label foreignObject div {
    line-height: 1.1 !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .node .nodeLabel {
    line-height: 1.1 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
`.trim()

const sketchLightVariables = {
  primaryColor: '#ffffff',
  primaryTextColor: '#000000',
  primaryBorderColor: '#000000',
  secondaryColor: '#ffffff',
  secondaryTextColor: '#000000',
  secondaryBorderColor: '#000000',
  tertiaryColor: '#ffffff',
  tertiaryTextColor: '#000000',
  tertiaryBorderColor: '#000000',
  lineColor: '#000000',
  textColor: '#000000',
  mainBkg: '#ffffff',
  secondBkg: '#ffffff',
  tertiaryBkg: '#ffffff',
  clusterBkg: '#ffffff',
  clusterBorder: '#000000',
  titleColor: '#000000',
  edgeLabelBackground: '#ffffff',
  nodeTextColor: '#000000',
  arrowheadColor: '#000000',
  background: 'transparent',
}

const sketchDarkVariables = {
  primaryColor: 'transparent',
  primaryTextColor: '#ffffff',
  primaryBorderColor: '#ffffff',
  secondaryColor: 'transparent',
  secondaryTextColor: '#ffffff',
  secondaryBorderColor: '#ffffff',
  tertiaryColor: 'transparent',
  tertiaryTextColor: '#ffffff',
  tertiaryBorderColor: '#ffffff',
  lineColor: '#ffffff',
  textColor: '#ffffff',
  mainBkg: 'transparent',
  secondBkg: 'transparent',
  tertiaryBkg: 'transparent',
  clusterBkg: 'transparent',
  clusterBorder: '#ffffff',
  titleColor: '#ffffff',
  edgeLabelBackground: 'transparent',
  nodeTextColor: '#ffffff',
  arrowheadColor: '#ffffff',
  background: 'transparent',
  darkMode: true,
}

const baseSketchConfig: Pick<
  MermaidConfig,
  | 'look'
  | 'handDrawnSeed'
  | 'flowchart'
  | 'fontFamily'
  | 'htmlLabels'
  | 'fontSize'
  | 'wrap'
  | 'markdownAutoWrap'
> = {
  look: 'handDrawn',
  handDrawnSeed: 1,
  fontFamily: HANDWRITTEN_FONT,
  fontSize: 21,
  htmlLabels: true,
  wrap: false,
  markdownAutoWrap: false,
  flowchart: {
    curve: 'linear',
    // Space between label text and box border (default 15).
    padding: 6,
    // Default is 200px; Chinese labels wrap too early and grow box height.
    wrappingWidth: 580,
    nodeSpacing: 40,
    rankSpacing: 50,
  },
}

export function getMermaidConfig(isDark: boolean): MermaidConfig {
  return {
    ...baseSketchConfig,
    startOnLoad: false,
    theme: 'base',
    darkMode: isDark,
    themeVariables: isDark ? sketchDarkVariables : sketchLightVariables,
    themeCSS: MERMAID_LABEL_CSS,
    securityLevel: 'loose',
  }
}
