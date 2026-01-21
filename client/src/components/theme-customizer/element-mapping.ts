export interface ElementMapping {
  id: string;
  name: string;
  selectors: string[];
  variables: string[];
}

export const elementMappings: ElementMapping[] = [
  {
    id: 'h1',
    name: 'Heading 1 (H1)',
    selectors: ['h1', '.h1'],
    variables: [
      '--font-heading-family',
      '--font-heading-weight',
      '--font-heading-color',
      '--font-heading-hyphens',
      '--h1-font-family',
      '--h1-font-weight',
      '--h1-text-transform',
      '--font-xlarge',
      '--font-xlarge-line-height',
    ]
  },
  {
    id: 'h2',
    name: 'Heading 2 (H2)',
    selectors: ['h2', '.h2'],
    variables: [
      '--font-heading-family',
      '--font-heading-weight',
      '--font-heading-color',
      '--font-heading-hyphens',
      '--h2-font-family',
      '--h2-font-weight',
      '--h2-text-transform',
      '--font-large',
      '--font-large-line-height',
    ]
  },
  {
    id: 'h3',
    name: 'Heading 3 (H3)',
    selectors: ['h3', '.h3'],
    variables: [
      '--font-heading-family',
      '--font-heading-weight',
      '--font-heading-color',
      '--font-heading-hyphens',
      '--h3-font-family',
      '--h3-font-weight',
      '--h3-text-transform',
      '--font-xmedium',
      '--font-xmedium-line-height',
    ]
  },
  {
    id: 'h4',
    name: 'Heading 4 (H4)',
    selectors: ['h4', '.h4'],
    variables: [
      '--font-heading-family',
      '--font-heading-weight',
      '--font-heading-color',
      '--font-heading-hyphens',
      '--h4-font-family',
      '--h4-font-weight',
      '--h4-text-transform',
      '--font-medium',
      '--font-medium-line-height',
    ]
  },
  {
    id: 'h5',
    name: 'Heading 5 (H5)',
    selectors: ['h5', '.h5'],
    variables: [
      '--font-heading-family',
      '--font-heading-weight',
      '--font-heading-color',
      '--font-heading-hyphens',
      '--h5-font-family',
      '--h5-font-weight',
      '--h5-text-transform',
      '--font-xnormal',
      '--font-xnormal-line-height',
    ]
  },
  {
    id: 'h6',
    name: 'Heading 6 (H6)',
    selectors: ['h6', '.h6'],
    variables: [
      '--font-heading-family',
      '--font-heading-weight',
      '--font-heading-color',
      '--font-heading-hyphens',
      '--h6-font-family',
      '--h6-font-weight',
      '--h6-text-transform',
      '--font-normal',
      '--font-normal-line-height',
    ]
  },
  {
    id: 'paragraph',
    name: 'Paragraph / Body Text',
    selectors: ['p', '.body-text', '.text'],
    variables: [
      '--font-base-family',
      '--font-base-weight',
      '--font-base-color',
      '--font-normal',
      '--font-normal-line-height',
    ]
  },
  {
    id: 'lead',
    name: 'Lead Text',
    selectors: ['.lead', '.intro'],
    variables: [
      '--lead-font-family',
      '--lead-font-weight',
      '--lead-font-size',
      '--lead-font-line-height',
      '--lead-color',
    ]
  },
  {
    id: 'pre-heading',
    name: 'Pre-heading',
    selectors: ['.pre-heading', '.eyebrow', '.overline'],
    variables: [
      '--pre-heading-family',
      '--pre-heading-weight',
      '--pre-heading-text-transform',
      '--pre-heading-font-size',
      '--pre-heading-color',
    ]
  },
  {
    id: 'link',
    name: 'Link',
    selectors: ['a', '.link'],
    variables: [
      '--link-style',
      '--link-color',
    ]
  },
  {
    id: 'button',
    name: 'Button',
    selectors: ['button', '.btn', '.button', '[class*="btn-"]'],
    variables: [
      '--button-universal-padding',
      '--button-universal-text-transform',
      '--button-universal-font-size',
      '--button-universal-font-weight',
      '--button-universal-font-family',
      '--button-universal-border-radius',
      '--button-background-color',
      '--button-color',
      '--button-outline-border-size',
      '--button-outline-color',
      '--button-outline-border-color',
    ]
  },
  {
    id: 'link-arrow',
    name: 'Link Arrow',
    selectors: ['.link-arrow', '.arrow-link'],
    variables: [
      '--link-arrow-text-font-weight',
      '--link-arrow-text-font-family',
      '--link-arrow-text-transform',
    ]
  },
  {
    id: 'nav-main',
    name: 'Main Navigation',
    selectors: ['nav', '.nav-main', '.main-nav', '.navigation', 'header nav'],
    variables: [
      '--nav-main-align',
      '--nav-main-background-color',
      '--nav-main-container-background-color',
      '--nav-main-container-padding-inline',
      '--nav-main-border-top',
      '--nav-main-border-bottom',
      '--nav-main-active-state-height',
      '--nav-main-active-state-color',
      '--nav-main-font-family',
      '--nav-main-link-gap',
      '--nav-main-link-padding',
      '--nav-main-link-font-size',
      '--nav-main-link-font-weight',
      '--nav-main-link-text-transform',
      '--nav-main-link-color',
    ]
  },
  {
    id: 'nav-burger',
    name: 'Burger Navigation',
    selectors: ['.burger', '.hamburger', '.mobile-nav', '.nav-toggle'],
    variables: [
      '--nav-burger-background-color',
      '--nav-burger-background-color-hover',
      '--nav-burger-label-and-icon-color',
      '--nav-burger-label-and-icon-color-hover',
      '--nav-burger-border-color',
      '--nav-burger-border-color-hover',
      '--nav-burger-dropdown-link-align',
      '--nav-burger-dropdown-link-font-size',
      '--nav-burger-dropdown-link-font-family',
    ]
  },
  {
    id: 'breadcrumb',
    name: 'Breadcrumb',
    selectors: ['.breadcrumb', '.breadcrumbs', 'nav[aria-label="breadcrumb"]'],
    variables: [
      '--breadcrumb-bg-color',
      '--breadcrumb-padding',
      '--breadcrumb-link-color',
      '--breadcrumb-label-color',
      '--breadcrumb-active-color',
      '--breadcrumb-divider-color',
    ]
  },
  {
    id: 'search',
    name: 'Search Button',
    selectors: ['.search-btn', '.search-button', '[type="search"]', '.search'],
    variables: [
      '--search-btn-border-radius',
      '--search-btn-background-color',
      '--search-btn-background-color-hover',
      '--search-text-color',
      '--search-text-color-hover',
      '--search-icon-color',
      '--search-icon-color-hover',
    ]
  },
  {
    id: 'header',
    name: 'Header',
    selectors: ['header', '.header', '.site-header'],
    variables: [
      '--header-container-padding',
      '--header-background-color',
    ]
  },
  {
    id: 'footer',
    name: 'Footer',
    selectors: ['footer', '.footer', '.site-footer'],
    variables: [
      '--footer-background-color',
      '--footer-heading-font-size',
      '--footer-heading-text-transform',
      '--footer-heading-font-family',
      '--footer-heading-font-weight',
    ]
  },
  {
    id: 'label',
    name: 'Label / Badge',
    selectors: ['.label', '.badge', '.tag', '.chip'],
    variables: [
      '--label-border-radius',
      '--label-text-transform',
      '--label-font-family',
      '--label-font-weight',
      '--label-padding',
      '--label-background',
      '--label-color',
      '--label-border-color',
    ]
  },
  {
    id: 'icon',
    name: 'Icon',
    selectors: ['.icon', '[class*="fa-"]', 'svg', '.icon-wrapper'],
    variables: [
      '--icon-default-font-family',
      '--icon-alternate-font-family',
      '--icon-default-font-size',
      '--icon-font-weight',
      '--icon-small-font-size',
      '--icon-background-size',
      '--icon-background-border-radius',
      '--icon-background-color',
      '--icon-color',
    ]
  },
  {
    id: 'form',
    name: 'Form Field',
    selectors: ['input', 'textarea', 'select', '.form-control', '.input', '.field'],
    variables: [
      '--form-field-height',
      '--universal-border-radius',
    ]
  },
  {
    id: 'hero',
    name: 'Hero Section',
    selectors: ['.hero', '.banner', '.jumbotron', '[class*="hero"]'],
    variables: [
      '--hero-ratio-full-width',
      '--hero-ratio-desktop',
      '--hero-ratio-mobile',
      '--hero-h1-font-size',
      '--hero-h1-line-height',
      '--hero-h2-font-size',
      '--hero-h2-line-height',
    ]
  },
  {
    id: 'card',
    name: 'Card / Box',
    selectors: ['.card', '.box', '.module', '.boxed', '.highlighted'],
    variables: [
      '--universal-border-radius',
      '--boxed-border-width',
      '--boxed-border-color',
      '--highlighted-box-shadow',
      '--grid-box-padding',
      '--grid-box-padding-mobile',
    ]
  },
  {
    id: 'grid',
    name: 'Grid / Layout',
    selectors: ['.grid', '.container', '.row', '.col', '[class*="grid"]'],
    variables: [
      '--grid-gutter-desktop',
      '--grid-gutter-mobile',
      '--grid-container-max-width',
      '--grid-header-container-width',
      '--grid-box-padding',
      '--grid-box-padding-mobile',
    ]
  },
  {
    id: 'nav-service',
    name: 'Service Navigation',
    selectors: ['.service-navigation', '.nav-service', '.service-nav', '.service-links'],
    variables: [
      '--service-color',
      '--service-font-weight',
      '--service-font-family',
      '--service-font-size',
      '--service-text-transform',
    ]
  },
  {
    id: 'colors-brand',
    name: 'Brand Colors',
    selectors: ['[class*="brand"]', '[class*="primary"]', '[class*="bg-color"]', '.bg-color-a', '.bg-color-b', '.bg-color-c', '.bg-color-d', '.bg-color-e', '.bg-color-f', '.bg-color-g'],
    variables: [
      '--color-brand-a',
      '--color-brand-b',
      '--color-brand-c',
      '--color-brand-d',
      '--color-brand-e',
      '--color-brand-f',
      '--color-brand-g',
    ]
  },
  {
    id: 'colors-neutral',
    name: 'Neutral Colors',
    selectors: ['body', '.neutral', '[class*="neutral"]', '[class*="gray"]'],
    variables: [
      '--color-neutral-a',
      '--color-neutral-b',
      '--color-neutral-c',
      '--color-neutral-d',
      '--color-neutral-e',
      '--color-neutral-f',
    ]
  },
];

export function findElementMapping(element: HTMLElement): ElementMapping | null {
  const tagName = element.tagName.toLowerCase();
  const classList = Array.from(element.classList);
  
  for (const mapping of elementMappings) {
    for (const selector of mapping.selectors) {
      if (selector === tagName) {
        return mapping;
      }
      if (selector.startsWith('.') && classList.some(c => c === selector.slice(1))) {
        return mapping;
      }
      if (selector.startsWith('[class*="') && selector.endsWith('"]')) {
        const pattern = selector.slice(9, -2);
        if (classList.some(c => c.includes(pattern))) {
          return mapping;
        }
      }
    }
  }
  
  return null;
}

export function getVariablesForElement(mapping: ElementMapping, allVariables: { name: string }[]): string[] {
  const variableNames = new Set(allVariables.map(v => v.name));
  return mapping.variables.filter(v => variableNames.has(v));
}
