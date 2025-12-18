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

// Variables preview HTML - showing all variable sections
const variablesPreviewHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://poc.media.gopublic.eu/Assets/Clients/dominiktest/Themes/new-v6-style/Release/theme.min.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
    <style id="custom-variables"></style>
    <title>Variables Preview</title>
</head>
<body id="body" class="wide-page">
<div class="overflow">
    <div id="wrapper" class="wrapper" style="padding-top: 1rem;">
        <div role="main">
            <div name="content" id="content-main">
                <!-- Brand Colors Section -->
                <section class="module boxed" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading">
                        <h2>Brand Colors</h2>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-top: 1rem;">
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 60px; background: var(--color-brand-a); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Brand A</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 60px; background: var(--color-brand-b); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Brand B</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 60px; background: var(--color-brand-c); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Brand C</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 60px; background: var(--color-brand-d); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Brand D</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 60px; background: var(--color-brand-e); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Brand E</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 60px; background: var(--color-brand-f); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Brand F</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 60px; background: var(--color-brand-g); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Brand G</p>
                        </div>
                    </div>
                </section>

                <!-- Neutral Colors Section -->
                <section class="module" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading alternate">
                        <h2>Neutral Colors</h2>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 0.75rem; margin-top: 1rem;">
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 50px; background: var(--color-neutral-a); border-radius: var(--universal-border-radius); border: 1px solid var(--boxed-border-color);"></div>
                            <p style="margin-top: 0.25rem; font-size: var(--font-xsmall);">Neutral A</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 50px; background: var(--color-neutral-b); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.25rem; font-size: var(--font-xsmall);">Neutral B</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 50px; background: var(--color-neutral-c); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.25rem; font-size: var(--font-xsmall);">Neutral C</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 50px; background: var(--color-neutral-d); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.25rem; font-size: var(--font-xsmall);">Neutral D</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 50px; background: var(--color-neutral-e); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.25rem; font-size: var(--font-xsmall);">Neutral E</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 50px; background: var(--color-neutral-f); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.25rem; font-size: var(--font-xsmall);">Neutral F</p>
                        </div>
                    </div>
                </section>

                <!-- Typography Section -->
                <section class="module boxed" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading">
                        <h2>Typography</h2>
                    </div>
                    <div style="margin-top: 1rem;">
                        <p class="pre-heading">Pre-heading text</p>
                        <h1>Heading 1</h1>
                        <h2>Heading 2</h2>
                        <h3>Heading 3</h3>
                        <h4>Heading 4</h4>
                        <h5>Heading 5</h5>
                        <h6>Heading 6</h6>
                        <p class="lead" style="margin-top: 1rem;">This is a lead paragraph with larger text for introductions and summaries.</p>
                        <p style="margin-top: 1rem;">This is regular body text demonstrating the base font settings. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                        <p style="margin-top: 0.5rem;"><a href="#">This is a link</a> within body text.</p>
                    </div>
                </section>

                <!-- Buttons Section -->
                <section class="module" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading alternate">
                        <h2>Buttons</h2>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem; align-items: center;">
                        <button class="btn">Primary Button</button>
                        <button class="btn btn-outline">Outline Button</button>
                        <button class="btn btn-alternate">Alternate Button</button>
                        <a href="#" class="link-arrow">Link with Arrow</a>
                    </div>
                </section>

                <!-- Labels Section -->
                <section class="module boxed" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading">
                        <h2>Labels</h2>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem;">
                        <span class="label">Default Label</span>
                        <span class="label">Category</span>
                        <span class="label">Tag</span>
                        <span class="label">News</span>
                    </div>
                </section>

                <!-- Icons Section -->
                <section class="module" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading alternate">
                        <h2>Icons</h2>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 1rem;">
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
                            <i class="fa-light fa-cog"></i>
                        </div>
                        <div class="icon-circle">
                            <i class="fa-light fa-search"></i>
                        </div>
                        <div class="icon-circle">
                            <i class="fa-light fa-phone"></i>
                        </div>
                    </div>
                </section>

                <!-- Form Section -->
                <section class="module boxed" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading">
                        <h2>Form Elements</h2>
                    </div>
                    <form style="max-width: 400px; margin-top: 1rem;">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem;">Text Input</label>
                            <input type="text" class="form-control" placeholder="Enter text..." style="width: 100%; height: var(--form-field-height); padding: 0 1rem; border: 1px solid var(--boxed-border-color); border-radius: var(--universal-border-radius);" />
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem;">Select</label>
                            <select style="width: 100%; height: var(--form-field-height); padding: 0 1rem; border: 1px solid var(--boxed-border-color); border-radius: var(--universal-border-radius);">
                                <option>Option 1</option>
                                <option>Option 2</option>
                                <option>Option 3</option>
                            </select>
                        </div>
                        <button type="submit" class="btn">Submit</button>
                    </form>
                </section>

                <!-- Dark Background Section -->
                <section class="module bg-dark" style="padding: 2rem; margin: 1rem; background: var(--color-brand-a);">
                    <div class="module-heading">
                        <h2 style="color: var(--font-heading-color-bg-dark);">Dark Background</h2>
                    </div>
                    <p style="color: var(--font-base-color-bg-dark); margin-top: 1rem;">This section demonstrates text and buttons on a dark background using the dark background color tokens.</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem;">
                        <button class="btn" style="background: var(--button-background-color-bg-dark); color: var(--button-font-color-bg-dark);">Button on Dark</button>
                        <button class="btn btn-outline" style="border-color: var(--button-outline-border-color-bg-dark); color: var(--button-outline-font-color-bg-dark);">Outline on Dark</button>
                    </div>
                </section>

                <!-- Cards Section -->
                <section class="module" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading alternate">
                        <h2>Cards & Boxes</h2>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
                        <div class="boxed" style="padding: var(--grid-box-padding);">
                            <h3>Boxed Card</h3>
                            <p style="margin-top: 0.5rem; color: var(--color-neutral-b);">This is a boxed card using the boxed border styles.</p>
                            <button class="btn" style="margin-top: 1rem;">Learn More</button>
                        </div>
                        <div class="highlighted" style="padding: var(--grid-box-padding);">
                            <h3>Highlighted Card</h3>
                            <p style="margin-top: 0.5rem; color: var(--color-neutral-b);">This card uses the highlighted box shadow.</p>
                            <button class="btn btn-alternate" style="margin-top: 1rem;">Explore</button>
                        </div>
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
