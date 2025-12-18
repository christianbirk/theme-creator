import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, Tablet, Smartphone, Loader2, X, ExternalLink, LayoutGrid, FileText } from 'lucide-react';
import { CSSVariable } from './types';
import { useToast } from '@/hooks/use-toast';

interface PreviewPaneProps {
  variables: CSSVariable[];
  previewHtml: string;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';
type ZoomLevel = 50 | 75 | 100;
type PreviewTab = 'variables' | 'frontpage' | 'external';

const deviceWidths: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

// Variables preview HTML - organized by control panel sections
const variablesPreviewHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://poc.media.gopublic.eu/Assets/Clients/dominiktest/Themes/new-v6-style/Release/theme.min.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
    <style id="custom-variables"></style>
    <style>
        .preview-section { padding: 2rem; margin: 1rem; }
        .preview-section-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 1.5rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--boxed-border-color); display: flex; align-items: center; gap: 0.5rem; }
        .preview-subsection { margin-bottom: 2rem; }
        .preview-subsection-title { font-size: 1rem; font-weight: 500; margin-bottom: 1rem; color: var(--color-neutral-b); }
        .color-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 1rem; }
        .color-swatch { text-align: center; }
        .color-swatch-box { width: 100%; height: 50px; border-radius: var(--universal-border-radius); border: 1px solid var(--boxed-border-color); }
        .color-swatch-label { margin-top: 0.25rem; font-size: var(--font-xsmall); }
    </style>
    <title>Variables Preview</title>
</head>
<body id="body" class="wide-page">
<div class="overflow">
    <div id="wrapper" class="wrapper" style="padding-top: 0.5rem;">
        <div role="main">
            <div name="content" id="content-main">

                <!-- ==================== COLORS ==================== -->
                <section class="preview-section boxed">
                    <h2 class="preview-section-title"><i class="fa-light fa-palette" style="color: var(--color-brand-a);"></i> Colors</h2>
                    
                    <!-- Brand Colors -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Brand Colors</h3>
                        <div class="color-grid">
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-brand-a);"></div>
                                <p class="color-swatch-label">Brand A</p>
                            </div>
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-brand-b);"></div>
                                <p class="color-swatch-label">Brand B</p>
                            </div>
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-brand-c);"></div>
                                <p class="color-swatch-label">Brand C</p>
                            </div>
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-brand-d);"></div>
                                <p class="color-swatch-label">Brand D</p>
                            </div>
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-brand-e);"></div>
                                <p class="color-swatch-label">Brand E</p>
                            </div>
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-brand-f);"></div>
                                <p class="color-swatch-label">Brand F</p>
                            </div>
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-brand-g);"></div>
                                <p class="color-swatch-label">Brand G</p>
                            </div>
                        </div>
                    </div>

                    <!-- Neutral Colors -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Neutral Colors</h3>
                        <div class="color-grid">
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-neutral-a);"></div>
                                <p class="color-swatch-label">Neutral A</p>
                            </div>
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-neutral-b);"></div>
                                <p class="color-swatch-label">Neutral B</p>
                            </div>
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-neutral-c);"></div>
                                <p class="color-swatch-label">Neutral C</p>
                            </div>
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-neutral-d);"></div>
                                <p class="color-swatch-label">Neutral D</p>
                            </div>
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-neutral-e);"></div>
                                <p class="color-swatch-label">Neutral E</p>
                            </div>
                            <div class="color-swatch">
                                <div class="color-swatch-box" style="background: var(--color-neutral-f);"></div>
                                <p class="color-swatch-label">Neutral F</p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- ==================== COLOR COMBINATIONS ==================== -->
                <section class="preview-section">
                    <h2 class="preview-section-title"><i class="fa-light fa-layer-group" style="color: var(--color-brand-a);"></i> Color Combinations</h2>
                    
                    <!-- Light Background Tones -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Light Background Tones</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                            <div class="boxed" style="padding: 1rem;">
                                <h4 style="color: var(--font-heading-color);">Heading Color</h4>
                                <p style="color: var(--font-base-color); margin-top: 0.5rem;">Body text color on light background.</p>
                                <a href="#" style="color: var(--link-color); margin-top: 0.5rem; display: inline-block;">Link color</a>
                            </div>
                            <div class="boxed" style="padding: 1rem;">
                                <p class="pre-heading" style="color: var(--pre-heading-color);">Pre-heading</p>
                                <p class="lead" style="color: var(--lead-color); margin-top: 0.5rem;">Lead text color</p>
                            </div>
                        </div>
                    </div>

                    <!-- Dark Background Tones -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Dark Background Tones</h3>
                        <div style="background: var(--color-brand-a); padding: 1.5rem; border-radius: var(--universal-border-radius);">
                            <h4 style="color: var(--font-heading-color-bg-dark);">Heading on Dark</h4>
                            <p style="color: var(--font-base-color-bg-dark); margin-top: 0.5rem;">Body text on dark background.</p>
                            <p class="pre-heading" style="color: var(--pre-heading-color-bg-dark); margin-top: 0.5rem;">Pre-heading on dark</p>
                            <p class="lead" style="color: var(--lead-color-bg-dark); margin-top: 0.5rem;">Lead text on dark</p>
                            <div style="display: flex; gap: 1rem; margin-top: 1rem; flex-wrap: wrap;">
                                <button class="btn" style="background: var(--button-background-color-bg-dark); color: var(--button-font-color-bg-dark);">Button</button>
                                <button class="btn btn-outline" style="border-color: var(--button-outline-border-color-bg-dark); color: var(--button-outline-font-color-bg-dark);">Outline</button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- ==================== TYPOGRAPHY ==================== -->
                <section class="preview-section boxed">
                    <h2 class="preview-section-title"><i class="fa-light fa-font" style="color: var(--color-brand-a);"></i> Typography</h2>
                    
                    <!-- Font Sizes -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Font Sizes</h3>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <span style="font-size: var(--font-xsmall);">XSmall: The quick brown fox</span>
                            <span style="font-size: var(--font-small);">Small: The quick brown fox</span>
                            <span style="font-size: var(--font-normal);">Normal: The quick brown fox</span>
                            <span style="font-size: var(--font-xnormal);">XNormal: The quick brown fox</span>
                            <span style="font-size: var(--font-medium);">Medium: The quick brown fox</span>
                            <span style="font-size: var(--font-xmedium);">XMedium: The quick brown fox</span>
                            <span style="font-size: var(--font-large);">Large: The quick brown fox</span>
                            <span style="font-size: var(--font-xlarge);">XLarge: The quick brown fox</span>
                            <span style="font-size: var(--font-xxlarge);">XXLarge: The quick</span>
                        </div>
                    </div>

                    <!-- Headings -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Headings</h3>
                        <h1>Heading 1</h1>
                        <h2>Heading 2</h2>
                        <h3>Heading 3</h3>
                        <h4>Heading 4</h4>
                        <h5>Heading 5</h5>
                        <h6>Heading 6</h6>
                    </div>

                    <!-- Body & Lead -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Body Text & Lead</h3>
                        <p class="pre-heading">Pre-heading text style</p>
                        <p class="lead" style="margin-top: 0.5rem;">This is a lead paragraph demonstrating larger introductory text styling.</p>
                        <p style="margin-top: 0.5rem;">Regular body text with <a href="#">inline link</a> demonstrating base font family, size, weight, and line height settings.</p>
                    </div>
                </section>

                <!-- ==================== LAYOUT AND SPACING ==================== -->
                <section class="preview-section">
                    <h2 class="preview-section-title"><i class="fa-light fa-grid-2" style="color: var(--color-brand-a);"></i> Layout and Spacing</h2>
                    
                    <!-- Borders & Radius -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Borders & Border Radius</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                            <div style="padding: 1rem; border: 1px solid var(--boxed-border-color); border-radius: var(--universal-border-radius); text-align: center;">
                                <p style="font-size: var(--font-small);">Universal Radius</p>
                            </div>
                            <div style="padding: 1rem; border: 1px solid var(--boxed-border-color); border-radius: var(--button-border-radius); text-align: center;">
                                <p style="font-size: var(--font-small);">Button Radius</p>
                            </div>
                        </div>
                    </div>

                    <!-- Grid & Spacing -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Grid & Box Padding</h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--grid-gutter);">
                            <div class="boxed" style="padding: var(--grid-box-padding);">
                                <p style="font-size: var(--font-small);">Box with grid-box-padding</p>
                            </div>
                            <div class="boxed" style="padding: var(--grid-box-padding);">
                                <p style="font-size: var(--font-small);">Grid gutter spacing</p>
                            </div>
                        </div>
                    </div>

                    <!-- Shadows -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Shadows</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1.5rem;">
                            <div class="boxed" style="padding: 1.5rem; text-align: center;">
                                <p style="font-size: var(--font-small);">Boxed style</p>
                            </div>
                            <div class="highlighted" style="padding: 1.5rem; text-align: center;">
                                <p style="font-size: var(--font-small);">Highlighted style</p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- ==================== HEADER, BODY AND FOOTER ==================== -->
                <section class="preview-section boxed">
                    <h2 class="preview-section-title"><i class="fa-light fa-window-maximize" style="color: var(--color-brand-a);"></i> Header, Body and Footer</h2>
                    
                    <!-- Header Preview -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Header</h3>
                        <div style="background: var(--header-background-color, var(--color-neutral-f)); padding: 1rem; border-radius: var(--universal-border-radius);">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-weight: 600;">Logo Area</span>
                                <nav style="display: flex; gap: 1.5rem;">
                                    <a href="#" style="text-decoration: none;">Menu Item</a>
                                    <a href="#" style="text-decoration: none;">Menu Item</a>
                                </nav>
                            </div>
                        </div>
                    </div>

                    <!-- Body Background -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Body Background</h3>
                        <div style="background: var(--main-bg-color, var(--color-neutral-f)); padding: 1.5rem; border-radius: var(--universal-border-radius); border: 1px dashed var(--boxed-border-color);">
                            <p style="font-size: var(--font-small); color: var(--color-neutral-b);">Main background color area</p>
                        </div>
                    </div>

                    <!-- Footer Preview -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Footer</h3>
                        <div style="background: var(--footer-background-color, var(--color-neutral-e)); padding: 1.5rem; border-radius: var(--universal-border-radius);">
                            <h4 style="font-family: var(--footer-heading-font-family); font-weight: var(--footer-heading-font-weight);">Footer Heading</h4>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small); color: var(--color-neutral-b);">Footer content area</p>
                        </div>
                    </div>
                </section>

                <!-- ==================== NAVIGATION ==================== -->
                <section class="preview-section">
                    <h2 class="preview-section-title"><i class="fa-light fa-bars" style="color: var(--color-brand-a);"></i> Navigation</h2>
                    
                    <!-- Breadcrumb -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Breadcrumb</h3>
                        <nav aria-label="Breadcrumb" class="breadcrumb">
                            <div>
                                <ul>
                                    <li><span class="breadcrumb-label">You are here:</span></li>
                                    <li><a href="#"><span>Home</span></a></li>
                                    <li><a href="#"><span>Section</span></a></li>
                                    <li class="active"><span>Current Page</span></li>
                                </ul>
                            </div>
                        </nav>
                    </div>

                    <!-- Service Menu -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Service Menu & Burger</h3>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <button class="site-search-toggler" style="position: relative;"><span></span></button>
                            <div class="nav-toggle" style="position: relative;">
                                <span class="dropdown-toggle" role="button">
                                    <span class="title">menu</span>
                                    <span class="button"></span>
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- ==================== BUTTONS ==================== -->
                <section class="preview-section boxed">
                    <h2 class="preview-section-title"><i class="fa-light fa-hand-pointer" style="color: var(--color-brand-a);"></i> Buttons</h2>
                    
                    <!-- Primary Buttons -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Button Styles</h3>
                        <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
                            <button class="btn">Primary Button</button>
                            <button class="btn btn-outline">Outline Button</button>
                            <button class="btn btn-alternate">Alternate Button</button>
                        </div>
                    </div>

                    <!-- Link Styles -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Link Styles</h3>
                        <div style="display: flex; flex-wrap: wrap; gap: 2rem; align-items: center;">
                            <a href="#" class="link-arrow">Link with Arrow</a>
                            <a href="#">Standard Link</a>
                        </div>
                    </div>
                </section>

                <!-- ==================== ICONS ==================== -->
                <section class="preview-section">
                    <h2 class="preview-section-title"><i class="fa-light fa-star" style="color: var(--color-brand-a);"></i> Icons</h2>
                    
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Icon Circles</h3>
                        <div style="display: flex; flex-wrap: wrap; gap: 1.5rem;">
                            <div class="icon-circle">
                                <i class="fa-light fa-home"></i>
                            </div>
                            <div class="icon-circle">
                                <i class="fa-light fa-user"></i>
                            </div>
                            <div class="icon-circle">
                                <i class="fa-light fa-envelope"></i>
                            </div>
                            <div class="icon-circle">
                                <i class="fa-light fa-phone"></i>
                            </div>
                            <div class="icon-circle">
                                <i class="fa-light fa-cog"></i>
                            </div>
                            <div class="icon-circle">
                                <i class="fa-light fa-search"></i>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- ==================== LABELS ==================== -->
                <section class="preview-section boxed">
                    <h2 class="preview-section-title"><i class="fa-light fa-tag" style="color: var(--color-brand-a);"></i> Labels</h2>
                    
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Label Styles</h3>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                            <span class="label">Default</span>
                            <span class="label">Category</span>
                            <span class="label">News</span>
                            <span class="label">Event</span>
                            <span class="label">Featured</span>
                        </div>
                    </div>
                </section>

                <!-- ==================== FORMS ==================== -->
                <section class="preview-section">
                    <h2 class="preview-section-title"><i class="fa-light fa-rectangle-list" style="color: var(--color-brand-a);"></i> Forms</h2>
                    
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Form Elements</h3>
                        <form style="max-width: 400px;">
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem;">Text Input</label>
                                <input type="text" placeholder="Enter text..." style="width: 100%; height: var(--form-field-height); padding: 0 1rem; border: 1px solid var(--boxed-border-color); border-radius: var(--universal-border-radius);" />
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem;">Email</label>
                                <input type="email" placeholder="email@example.com" style="width: 100%; height: var(--form-field-height); padding: 0 1rem; border: 1px solid var(--boxed-border-color); border-radius: var(--universal-border-radius);" />
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem;">Select</label>
                                <select style="width: 100%; height: var(--form-field-height); padding: 0 1rem; border: 1px solid var(--boxed-border-color); border-radius: var(--universal-border-radius);">
                                    <option>Option 1</option>
                                    <option>Option 2</option>
                                    <option>Option 3</option>
                                </select>
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem;">Textarea</label>
                                <textarea rows="3" placeholder="Enter message..." style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--boxed-border-color); border-radius: var(--universal-border-radius); resize: vertical;"></textarea>
                            </div>
                            <button type="submit" class="btn">Submit Form</button>
                        </form>
                    </div>
                </section>

                <!-- ==================== HERO AND RATIOS ==================== -->
                <section class="preview-section boxed">
                    <h2 class="preview-section-title"><i class="fa-light fa-image" style="color: var(--color-brand-a);"></i> Hero and Ratios</h2>
                    
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Hero Section</h3>
                        <div style="background: linear-gradient(135deg, var(--color-brand-a), var(--color-brand-b)); padding: 3rem 2rem; border-radius: var(--universal-border-radius); text-align: center;">
                            <h1 style="color: var(--font-heading-color-bg-dark); font-size: var(--hero-h1-font-size);">Hero Heading</h1>
                            <h2 style="color: var(--font-heading-color-bg-dark); font-size: var(--hero-h2-font-size); margin-top: 0.5rem; opacity: 0.9;">Hero Subheading</h2>
                            <p class="lead" style="color: var(--lead-color-bg-dark); margin-top: 1rem; max-width: 600px; margin-left: auto; margin-right: auto;">Hero lead text demonstrating the hero typography settings.</p>
                            <button class="btn" style="margin-top: 1.5rem; background: var(--button-background-color-bg-dark); color: var(--button-font-color-bg-dark);">Call to Action</button>
                        </div>
                    </div>
                </section>

                <!-- ==================== OTHER ==================== -->
                <section class="preview-section">
                    <h2 class="preview-section-title"><i class="fa-light fa-sliders" style="color: var(--color-brand-a);"></i> Other</h2>
                    
                    <!-- Module Headings -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Module Headings</h3>
                        <div style="display: grid; gap: 1rem;">
                            <div class="module-heading">
                                <h3>Default Module Heading</h3>
                            </div>
                            <div class="module-heading alternate">
                                <h3>Alternate Module Heading</h3>
                            </div>
                        </div>
                    </div>

                    <!-- Transitions Demo -->
                    <div class="preview-subsection">
                        <h3 class="preview-subsection-title">Transitions</h3>
                        <p style="font-size: var(--font-small); color: var(--color-neutral-b);">Hover over the buttons and elements above to see transition effects applied throughout the theme.</p>
                    </div>
                </section>

            </div>
        </div>
    </div>
</div>
</body>
</html>
`;

// Frontpage preview HTML - simulating a typical frontpage with Hero, modules, etc.
const frontpagePreviewHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://poc.media.gopublic.eu/Assets/Clients/dominiktest/Themes/new-v6-style/Release/theme.min.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
    <style id="custom-variables"></style>
    <title>Frontpage Preview</title>
</head>
<body id="body" class="wide-page">
<div class="overflow">
    <!-- Header -->
    <header class="header">
        <div class="header-container">
            <div class="logo">
                <div>
                    <a aria-label="Go to homepage" href="#">
                        <img loading="lazy" src="https://poc.media.gopublic.eu/dominiktest/Media/638965430310767602/logo.png" alt="Logo" style="max-width: 180px;" />
                    </a>
                </div>
            </div>
            <nav class="main-nav" aria-label="Main navigation">
                <ul style="display: flex; gap: 1.5rem; list-style: none; margin: 0; padding: 0;">
                    <li><a href="#" style="text-decoration: none;">Home</a></li>
                    <li><a href="#" style="text-decoration: none;">About</a></li>
                    <li><a href="#" style="text-decoration: none;">Services</a></li>
                    <li><a href="#" style="text-decoration: none;">Contact</a></li>
                </ul>
            </nav>
            <div class="services burger-active">
                <div class="service-menu">
                    <button class="site-search-toggler"><span></span></button>
                    <nav aria-label="Mobile Menu" class="mobile tree-nav burger">
                        <div class="nav-toggle">
                            <span class="dropdown-toggle no-smoothscroll" role="button" tabindex="0">
                                <span aria-hidden class="title">menu</span>
                                <span class="button"></span>
                            </span>
                        </div>
                    </nav>
                </div>
            </div>
        </div>
    </header>

    <div id="wrapper" class="wrapper">
        <div role="main">
            <!-- Hero Section -->
            <section class="hero-module" style="position: relative; height: 500px; background: linear-gradient(135deg, var(--color-brand-a) 0%, var(--color-brand-b) 100%); display: flex; align-items: center; justify-content: center; text-align: center; margin-bottom: 2rem;">
                <div style="max-width: 800px; padding: 2rem;">
                    <p class="pre-heading" style="color: var(--pre-heading-color-bg-dark, #fff); opacity: 0.9;">Welcome to our website</p>
                    <h1 style="color: var(--font-heading-color-bg-dark, #fff); font-size: var(--hero-h1-font-size); margin-bottom: 1rem;">Build Something Amazing</h1>
                    <p class="lead" style="color: var(--lead-color-bg-dark, #fff); opacity: 0.9; margin-bottom: 2rem;">Create beautiful, responsive websites with our powerful theming system. Customize every aspect to match your brand.</p>
                    <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                        <button class="btn" style="background: var(--button-background-color-bg-dark); color: var(--button-font-color-bg-dark);">Get Started</button>
                        <button class="btn btn-outline" style="border-color: var(--button-outline-border-color-bg-dark); color: var(--button-outline-font-color-bg-dark);">Learn More</button>
                    </div>
                </div>
            </section>

            <!-- Breadcrumb -->
            <div class="tool-section">
                <div>
                    <nav aria-label="Breadcrumb" class="breadcrumb">
                        <div>
                            <ul>
                                <li><span class="breadcrumb-label">You are here:</span></li>
                                <li class="active"><span>Home</span></li>
                            </ul>
                        </div>
                    </nav>
                </div>
            </div>

            <div name="content" id="content-main">
                <!-- Introduction Section -->
                <section class="module" style="padding: 3rem 2rem; margin: 1rem; text-align: center;">
                    <p class="pre-heading">Our Services</p>
                    <h2 style="margin-bottom: 1rem;">What We Offer</h2>
                    <p class="lead" style="max-width: 700px; margin: 0 auto;">We provide comprehensive solutions tailored to your needs. Explore our range of services designed to help you succeed.</p>
                </section>

                <!-- Content Boxes Grid -->
                <section class="module" style="padding: 2rem; margin: 1rem;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
                        <div class="boxed" style="padding: var(--grid-box-padding);">
                            <div class="icon-circle" style="margin-bottom: 1rem;">
                                <i class="fa-light fa-rocket"></i>
                            </div>
                            <h3>Fast Performance</h3>
                            <p style="margin-top: 0.75rem; color: var(--color-neutral-b);">Optimized code and efficient loading ensure your website performs at its best.</p>
                            <a href="#" class="link-arrow" style="margin-top: 1rem; display: inline-block;">Learn more</a>
                        </div>
                        <div class="boxed" style="padding: var(--grid-box-padding);">
                            <div class="icon-circle" style="margin-bottom: 1rem;">
                                <i class="fa-light fa-palette"></i>
                            </div>
                            <h3>Custom Design</h3>
                            <p style="margin-top: 0.75rem; color: var(--color-neutral-b);">Fully customizable themes that adapt to your brand identity and preferences.</p>
                            <a href="#" class="link-arrow" style="margin-top: 1rem; display: inline-block;">Learn more</a>
                        </div>
                        <div class="boxed" style="padding: var(--grid-box-padding);">
                            <div class="icon-circle" style="margin-bottom: 1rem;">
                                <i class="fa-light fa-shield-check"></i>
                            </div>
                            <h3>Secure & Reliable</h3>
                            <p style="margin-top: 0.75rem; color: var(--color-neutral-b);">Built with security in mind to protect your data and maintain uptime.</p>
                            <a href="#" class="link-arrow" style="margin-top: 1rem; display: inline-block;">Learn more</a>
                        </div>
                    </div>
                </section>

                <!-- Featured Content with Image -->
                <section class="module bg-dark" style="padding: 3rem 2rem; margin: 1rem; background: var(--color-brand-a);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; max-width: 1200px; margin: 0 auto;">
                        <div>
                            <p class="pre-heading" style="color: var(--pre-heading-color-bg-dark);">Featured</p>
                            <h2 style="color: var(--font-heading-color-bg-dark); margin-bottom: 1rem;">Transform Your Digital Presence</h2>
                            <p style="color: var(--font-base-color-bg-dark); margin-bottom: 1.5rem;">Our platform provides all the tools you need to create stunning websites that engage your audience and drive results.</p>
                            <ul style="color: var(--font-base-color-bg-dark); margin-bottom: 1.5rem; padding-left: 1.5rem;">
                                <li style="margin-bottom: 0.5rem;">Responsive design for all devices</li>
                                <li style="margin-bottom: 0.5rem;">SEO optimized structure</li>
                                <li style="margin-bottom: 0.5rem;">Easy content management</li>
                            </ul>
                            <button class="btn" style="background: var(--button-background-color-bg-dark); color: var(--button-font-color-bg-dark);">Get Started Today</button>
                        </div>
                        <div style="background: var(--color-neutral-e); height: 300px; border-radius: var(--universal-border-radius); display: flex; align-items: center; justify-content: center;">
                            <i class="fa-light fa-image" style="font-size: 4rem; color: var(--color-neutral-c);"></i>
                        </div>
                    </div>
                </section>

                <!-- News/Articles Section -->
                <section class="module" style="padding: 3rem 2rem; margin: 1rem;">
                    <div class="module-heading alternate" style="margin-bottom: 2rem;">
                        <h2>Latest News</h2>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
                        <article class="boxed" style="overflow: hidden;">
                            <div style="background: var(--color-neutral-e); height: 180px; margin: -1rem -1rem 1rem -1rem; display: flex; align-items: center; justify-content: center;">
                                <i class="fa-light fa-newspaper" style="font-size: 3rem; color: var(--color-neutral-c);"></i>
                            </div>
                            <span class="label" style="margin-bottom: 0.75rem; display: inline-block;">News</span>
                            <h4>Introducing New Features</h4>
                            <p style="margin-top: 0.5rem; color: var(--color-neutral-b); font-size: var(--font-small);">We are excited to announce our latest updates that will improve your workflow.</p>
                            <a href="#" class="link-arrow" style="margin-top: 1rem; display: inline-block;">Read more</a>
                        </article>
                        <article class="boxed" style="overflow: hidden;">
                            <div style="background: var(--color-neutral-e); height: 180px; margin: -1rem -1rem 1rem -1rem; display: flex; align-items: center; justify-content: center;">
                                <i class="fa-light fa-calendar" style="font-size: 3rem; color: var(--color-neutral-c);"></i>
                            </div>
                            <span class="label" style="margin-bottom: 0.75rem; display: inline-block;">Events</span>
                            <h4>Upcoming Webinar</h4>
                            <p style="margin-top: 0.5rem; color: var(--color-neutral-b); font-size: var(--font-small);">Join us for an exclusive session on best practices for web development.</p>
                            <a href="#" class="link-arrow" style="margin-top: 1rem; display: inline-block;">Read more</a>
                        </article>
                        <article class="boxed" style="overflow: hidden;">
                            <div style="background: var(--color-neutral-e); height: 180px; margin: -1rem -1rem 1rem -1rem; display: flex; align-items: center; justify-content: center;">
                                <i class="fa-light fa-lightbulb" style="font-size: 3rem; color: var(--color-neutral-c);"></i>
                            </div>
                            <span class="label" style="margin-bottom: 0.75rem; display: inline-block;">Tips</span>
                            <h4>Design Best Practices</h4>
                            <p style="margin-top: 0.5rem; color: var(--color-neutral-b); font-size: var(--font-small);">Learn how to create engaging user experiences with our design guidelines.</p>
                            <a href="#" class="link-arrow" style="margin-top: 1rem; display: inline-block;">Read more</a>
                        </article>
                    </div>
                </section>

                <!-- Contact/CTA Section -->
                <section class="module highlighted" style="padding: 3rem 2rem; margin: 1rem; text-align: center;">
                    <h2 style="margin-bottom: 1rem;">Ready to Get Started?</h2>
                    <p style="max-width: 600px; margin: 0 auto 2rem; color: var(--color-neutral-b);">Contact us today to learn how we can help you achieve your goals. Our team is ready to assist you.</p>
                    <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                        <button class="btn">Contact Us</button>
                        <button class="btn btn-outline">View Pricing</button>
                    </div>
                </section>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <footer class="footer" style="padding: 3rem 2rem; margin-top: 2rem; background: var(--footer-background-color, var(--color-neutral-e));">
        <div style="max-width: var(--grid-container-max-width); margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem;">
            <div>
                <h4 style="font-family: var(--footer-heading-font-family); font-weight: var(--footer-heading-font-weight); margin-bottom: 1rem;">About Us</h4>
                <p style="color: var(--color-neutral-b); font-size: var(--font-small);">We create beautiful, functional websites that help businesses grow and succeed online.</p>
            </div>
            <div>
                <h4 style="font-family: var(--footer-heading-font-family); font-weight: var(--footer-heading-font-weight); margin-bottom: 1rem;">Quick Links</h4>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="margin-bottom: 0.5rem;"><a href="#" style="color: var(--color-neutral-b); font-size: var(--font-small);">Home</a></li>
                    <li style="margin-bottom: 0.5rem;"><a href="#" style="color: var(--color-neutral-b); font-size: var(--font-small);">Services</a></li>
                    <li style="margin-bottom: 0.5rem;"><a href="#" style="color: var(--color-neutral-b); font-size: var(--font-small);">Contact</a></li>
                </ul>
            </div>
            <div>
                <h4 style="font-family: var(--footer-heading-font-family); font-weight: var(--footer-heading-font-weight); margin-bottom: 1rem;">Contact</h4>
                <p style="color: var(--color-neutral-b); font-size: var(--font-small);">
                    Email: info@example.com<br>
                    Phone: +45 12 34 56 78
                </p>
            </div>
        </div>
    </footer>
</div>
</body>
</html>
`;

export function PreviewPane({ variables, previewHtml }: PreviewPaneProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [zoom, setZoom] = useState<ZoomLevel>(100);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('variables');
  const [urlInput, setUrlInput] = useState('');
  const [customHtml, setCustomHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  // Build a map for resolving var() references
  const variableMap = useMemo(() => {
    const map = new Map<string, string>();
    variables.forEach(v => map.set(v.name, v.value));
    return map;
  }, [variables]);

  // Resolve var() references to their computed values
  const resolveVarReferences = useCallback((value: string, depth = 0): string => {
    if (depth > 10) return value;
    
    const varRegex = /var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]+))?\)/g;
    
    return value.replace(varRegex, (match, varName, fallback) => {
      const resolvedValue = variableMap.get(varName);
      if (resolvedValue) {
        return resolveVarReferences(resolvedValue, depth + 1);
      }
      return fallback ? resolveVarReferences(fallback.trim(), depth + 1) : match;
    });
  }, [variableMap]);

  // Generate CSS with all var() references resolved to computed values
  const cssVariablesStyle = useMemo(() => {
    return variables.map(v => {
      const resolvedValue = resolveVarReferences(v.value);
      return `${v.name}: ${resolvedValue};`;
    }).join('\n      ');
  }, [variables, resolveVarReferences]);

  const handleFetchUrl = useCallback(async () => {
    if (!urlInput.trim()) {
      toast({
        title: 'URL required',
        description: 'Please enter a URL to load',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/fetch-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch URL');
      }

      setCustomHtml(data.html);
      setLoadedUrl(data.url);
      setPreviewTab('external');
      toast({
        title: 'Preview loaded',
        description: `Loaded HTML from ${data.url}`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not fetch the website';
      toast({
        title: 'Failed to load URL',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [urlInput, toast]);

  const handleClearCustom = useCallback(() => {
    setCustomHtml(null);
    setLoadedUrl(null);
    setUrlInput('');
    setPreviewTab('variables');
  }, []);

  // Generate CSS content
  const customCssContent = useMemo(() => {
    return `
      :root {
        ${cssVariablesStyle}
      }
    `;
  }, [cssVariablesStyle]);

  // Get the current HTML based on selected tab
  const getCurrentHtml = useCallback(() => {
    if (previewTab === 'external' && customHtml) {
      return customHtml;
    }
    if (previewTab === 'frontpage') {
      return frontpagePreviewHtml;
    }
    return variablesPreviewHtml;
  }, [previewTab, customHtml]);

  // Base HTML for initial iframe load
  const iframeSrcDoc = useMemo(() => {
    const baseHtml = getCurrentHtml();
    const initialCss = customCssContent;
    
    if (baseHtml.includes('<style id="custom-variables">')) {
      return baseHtml.replace(
        /<style id="custom-variables">.*?<\/style>/s,
        `<style id="custom-variables">${initialCss}</style>`
      );
    }
    
    if (baseHtml.includes('</head>')) {
      return baseHtml.replace(
        '</head>',
        `<style id="custom-variables">${initialCss}</style></head>`
      );
    }
    
    if (baseHtml.includes('</body>')) {
      return baseHtml.replace(
        '</body>',
        `<style id="custom-variables">${initialCss}</style></body>`
      );
    }
    
    return `${baseHtml}<style id="custom-variables">${initialCss}</style>`;
  }, [getCurrentHtml, customCssContent]);

  // Dynamically update CSS in iframe without re-rendering
  useEffect(() => {
    if (!iframeLoaded || !iframeRef.current) return;
    
    try {
      const iframeDoc = iframeRef.current.contentDocument;
      if (!iframeDoc) return;
      
      let styleEl = iframeDoc.getElementById('custom-variables') as HTMLStyleElement;
      
      if (!styleEl) {
        styleEl = iframeDoc.createElement('style');
        styleEl.id = 'custom-variables';
        const head = iframeDoc.head || iframeDoc.querySelector('head');
        if (head) {
          head.appendChild(styleEl);
        } else {
          iframeDoc.body?.appendChild(styleEl);
        }
      }
      
      styleEl.textContent = customCssContent;
    } catch (e) {
      console.warn('Could not update iframe styles dynamically:', e);
    }
  }, [customCssContent, iframeLoaded]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
  }, []);

  // Reset iframe loaded state when HTML changes
  useEffect(() => {
    setIframeLoaded(false);
  }, [previewTab, customHtml]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 p-3 border-b bg-muted/30">
        <div className="flex items-center justify-between gap-4">
          <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as PreviewTab)} className="flex-1">
            <TabsList className="h-8">
              <TabsTrigger value="variables" className="text-xs gap-1.5 px-3" data-testid="tab-variables">
                <LayoutGrid className="h-3.5 w-3.5" />
                Variables
              </TabsTrigger>
              <TabsTrigger value="frontpage" className="text-xs gap-1.5 px-3" data-testid="tab-frontpage">
                <FileText className="h-3.5 w-3.5" />
                Frontpage
              </TabsTrigger>
              {loadedUrl && (
                <TabsTrigger value="external" className="text-xs gap-1.5 px-3" data-testid="tab-external">
                  <ExternalLink className="h-3.5 w-3.5" />
                  External
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md">
              <Button
                variant={device === 'desktop' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setDevice('desktop')}
                className="h-8 w-8 rounded-r-none"
                data-testid="preview-device-desktop"
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={device === 'tablet' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setDevice('tablet')}
                className="h-8 w-8 rounded-none border-x"
                data-testid="preview-device-tablet"
              >
                <Tablet className="h-4 w-4" />
              </Button>
              <Button
                variant={device === 'mobile' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setDevice('mobile')}
                className="h-8 w-8 rounded-l-none"
                data-testid="preview-device-mobile"
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>

            <Select value={zoom.toString()} onValueChange={(v) => setZoom(parseInt(v) as ZoomLevel)}>
              <SelectTrigger className="w-20 h-8" data-testid="preview-zoom-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50%</SelectItem>
                <SelectItem value="75">75%</SelectItem>
                <SelectItem value="100">100%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Load external URL (e.g., https://dominik.gopublic.dk)"
              className="pr-8 h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
              data-testid="input-preview-url"
            />
            {loadedUrl && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearCustom}
                className="absolute right-0 top-0 h-8 w-8"
                data-testid="button-clear-url"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Button
            onClick={handleFetchUrl}
            disabled={isLoading}
            size="sm"
            className="h-8"
            data-testid="button-load-url"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Load
              </>
            )}
          </Button>
        </div>

        {loadedUrl && previewTab === 'external' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Loaded:</span>
            <span className="truncate font-mono">{loadedUrl}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-muted/50 p-4">
        <div 
          className="mx-auto bg-background border rounded-md shadow-sm overflow-hidden transition-all duration-200"
          style={{ 
            width: deviceWidths[device],
            maxWidth: '100%',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            height: zoom < 100 ? `${100 / (zoom / 100)}%` : 'auto',
          }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={iframeSrcDoc}
            onLoad={handleIframeLoad}
            className="w-full h-[800px] border-0"
            title="Theme Preview"
            sandbox="allow-same-origin"
            data-testid="preview-iframe"
          />
        </div>
      </div>
    </div>
  );
}

export default PreviewPane;
