# Design Guidelines: Visual SCSS Theme Customizer

## Design Approach

**System:** Material Design / Fluent Design hybrid approach
**Rationale:** This is a utility-focused productivity tool requiring clear information hierarchy, efficient workflows, and professional polish. The interface must handle 200+ controls while maintaining clarity and usability.

**Core Principles:**
- Information clarity over visual flair
- Efficient workflows for rapid theme iteration
- Professional, tool-focused aesthetic
- Clear visual feedback for all interactions

---

## Layout System

**Primary Layout:** Split-screen horizontal layout
- Left panel (40% width): Variable controls
- Right panel (60% width): Live preview pane
- Resizable divider between panels for user flexibility

**Spacing System:**
Use Tailwind units: **2, 3, 4, 6, 8** for consistent rhythm
- Tight spacing (p-2, gap-2): Within form groups, list items
- Medium spacing (p-4, gap-4): Between sections, card padding
- Large spacing (p-6, p-8): Panel padding, major section breaks

**Responsive Behavior:**
- Desktop (lg+): Side-by-side split layout
- Tablet/Mobile: Stack vertically (controls on top, preview below) with sticky export button

---

## Typography

**Font Stack:**
- Primary: Inter or System UI fonts via Google Fonts
- Monospace: JetBrains Mono for variable names and CSS output

**Hierarchy:**
- App Title: text-2xl font-semibold
- Section Headers: text-lg font-medium
- Control Labels: text-sm font-medium
- Variable Names: text-xs font-mono
- Helper Text: text-xs opacity-70

---

## Component Library

### 1. Control Panel (Left)

**Header Section:**
- App title and description
- File upload button for base SCSS
- Search/filter input for variables

**Variable Groups (Collapsible Accordions):**
- Colors (color pickers with hex input)
- Typography (font family dropdowns, size/weight number inputs)
- Spacing (number inputs with unit selectors)
- Borders (radius, width controls)
- Shadows (preset selectors with custom override)
- Animations (duration, easing dropdowns)

**Group Structure:**
```
[Icon] Section Name (12 variables) [Chevron]
└─ Variable rows when expanded:
   Variable Name          [Input Control]
   another-variable       [Input Control]
```

**Input Types by Variable:**
- Color variables: Color picker with text input for hex/rgb
- Font families: Dropdown/combobox
- Numeric values: Number input with +/- buttons, unit dropdown (px, rem, em, %)
- Preset options: Radio buttons or segmented control

### 2. Live Preview Pane (Right)

**Header:**
- Preview title
- Zoom controls (100%, 75%, 50%)
- Device frame toggles (desktop/tablet/mobile)

**Preview Container:**
- White canvas background
- Rendered HTML with applied CSS variables
- Scrollable if content exceeds viewport
- Smooth updates on variable changes (debounced)

### 3. Action Bar

**Fixed Bottom Bar (spans full width):**
- Reset to defaults button (left)
- Export Theme button (right, primary action)
- Variable count indicator (center): "Modified: 23/200 variables"

### 4. Export Modal

**Centered overlay:**
- Preview of generated CSS
- Filename input field
- Copy to clipboard button
- Download button
- Close/cancel action

---

## Navigation & Organization

**Variable Categorization:**
Group variables logically with visual separators:
1. Brand Colors (primary, secondary, accent)
2. Neutral Colors (backgrounds, borders, text)
3. Typography (families, sizes, weights, line-heights)
4. Spacing Scale (margins, padding)
5. Layout (breakpoints, containers)
6. Components (buttons, forms, cards)
7. Effects (shadows, transitions, opacity)

**Search/Filter:**
- Real-time filtering of variable names
- Highlight matches in variable list
- Show/hide empty categories when filtered

---

## Interactive Behaviors

**Real-time Updates:**
- Debounced input (300ms) before applying to preview
- Visual indicator when preview is updating
- Smooth transitions for variable changes

**State Management:**
- Track modified vs. default variables
- Visual indicator on modified variables (dot or badge)
- Ability to reset individual variables or entire sections

**Validation:**
- Inline error states for invalid values
- Prevent export if required variables are invalid
- Helper text for expected value formats

---

## Data Display Patterns

**Variable Row Structure:**
```
[Modified Indicator] Variable Name               [Control] [Reset Icon]
                     $primary-color              [#3B82F6] [×]
                     Helper: Main brand color
```

**Collapsed Section Preview:**
Show 3-4 most important variables from each collapsed section as mini-preview

**Modified Variables Counter:**
Visual badge on section headers showing count of modified variables within

---

## Professional Quality Standards

- Consistent 4px grid alignment throughout
- Smooth 200ms transitions for expandable sections
- Keyboard navigation support (tab through inputs, space to toggle sections)
- Tooltips for complex controls
- Loading states for file uploads and exports
- Empty states when no SCSS file uploaded

**Critical Success Factors:**
- Variables must be scannable and quickly accessible
- Preview updates must feel instantaneous
- Export workflow must be foolproof
- Interface must handle 200+ variables without feeling overwhelming