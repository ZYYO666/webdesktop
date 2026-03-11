# Base App Design Documentation
Filename: `base-app-design.md`

This document defines the strict design specifications for building apps that match the File Browser's UI/UX. It includes layout, dimensions, styles, component details, DOM structure, and behavior. All conforming apps MUST adhere to these specifications pixel-perfectly.

---

## 1. Global Layout Architecture

The application layout is divided into two main areas: the **Sidebar** (left) and the **Main Content** (right).

### 1.1 DOM Structure Overview
The root container must be a `flex` container with `h-full w-full`.
We use Naive UI's `n-layout` system.

```html
<div class="h-full flex flex-col relative bg-white">
  <n-layout has-sider class="h-full w-full bg-transparent">
    <!-- 1. Sidebar -->
    <n-layout-sider
      collapse-mode="transform"
      :collapsed-width="0"
      :width="220"
      :native-scrollbar="false"
      class="bg-gray-50 h-full border-r border-gray-100"
    >
      <!-- Sidebar Content -->
    </n-layout-sider>

    <!-- 2. Right Side: Header + Content -->
    <n-layout class="h-full bg-transparent flex flex-col" :native-scrollbar="false">
      <!-- 2.1 Header (Absolute Positioned) -->
      <div class="shrink-0 z-20 absolute top-0 left-0 right-0 h-12">
        <!-- Top Bar Component -->
      </div>

      <!-- 2.2 Main Content (Scrollable) -->
      <n-layout-content 
        class="flex-1 min-h-0 pt-12"
        content-style="display: flex; flex-direction: column; position: relative;"
        :native-scrollbar="false"
      >
        <!-- App Content -->
      </n-layout-content>
    </n-layout>
  </n-layout>
</div>
```

---

## 2. Sidebar Specifications

### 2.1 Dimensions & Styling
- **Width**: `220px` (Strict)
- **Background**: `bg-gray-50` (`#f9fafb`)
- **Border**: Right border `border-gray-100` (`#f3f4f6`)
- **Scrollbar**: Hidden (`:native-scrollbar="false"`)

### 2.2 Top Drag Area (Traffic Lights Spacer)
Every sidebar MUST include a top spacer to avoid overlapping with macOS traffic lights.

- **Height**: `var(--immersive-safe-top)` or strictly **`48px`** (if variable not set) / `h-12` class.
- **Behavior**: Must have `data-window-drag` attribute to allow window dragging.

```html
<div class="shrink-0" style="height: var(--immersive-safe-top, 48px)" data-window-drag></div>
```

### 2.3 Section Headers (Small Titles)
Used for grouping menu items (e.g., "Favorites", "Locations").

- **Font Size**: `text-[12px]`
- **Font Weight**: `font-bold`
- **Color**: `text-gray-400/80`
- **Text Transform**: `uppercase`
- **Letter Spacing**: `tracking-wide`
- **Padding**: `px-4 py-1.5`
- **Margin**: Bottom `mb-4` (for group wrapper)

```html
<div class="px-4 py-1.5 text-[12px] font-bold text-gray-400/80 uppercase tracking-wide">
  {{ GROUP_LABEL }}
</div>
```

### 2.4 Menu Items
Interactive navigation items in the sidebar.

- **Container Padding**: `px-2` (horizontal padding for the list container)
- **Item Gap**: `6px` vertical gap between items (use `space-y-1.5`)
- **Item Dimensions**: `w-full`, `rounded-lg`
- **Item Padding**: `px-2.5 py-1.5`
- **Font Size**: `text-[13px]`
- **Font Weight**: `font-medium`
- **Transitions**: `transition-all`
- **Cursor**: `cursor-default`

**States:**
1.  **Active**:
    -   Background: `bg-blue-600`
    -   Text Color: `text-white`
    -   Shadow: `shadow-sm`
    -   Icon Color: `text-white`
2.  **Inactive**:
    -   Background: Transparent
    -   Text Color: `text-gray-600`
    -   Hover Background: `hover:bg-gray-100`
    -   Hover Text: `hover:text-gray-900`
    -   Icon Color: `text-gray-500` (or specific color like `text-blue-500` if defined)

**Icon Specs:**
-   **Size**: `15px` (`:size="15"`)
-   **Stroke Width**: `2`
-   **Margin**: Right gap `gap-2.5`

```html
<div 
  class="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-default relative"
  :class="isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
>
  <component :is="icon" :size="15" stroke-width="2" ... />
  <span class="truncate relative z-10">{{ label }}</span>
</div>
```

---

## 3. Header (Top Bar) Specifications

### 3.1 Dimensions & Positioning
- **Height**: `48px` (`h-12`) (Strict)
- **Position**: `absolute top-0 left-0 right-0` (Overlays content)
- **Z-Index**: `z-30` (Above sidebar drag area if needed, though sidebar is separate)
- **Padding**: `px-3` (Left/Right), **`pr-32`** (Right padding strictly reserved for window controls)

### 3.2 Visual Style
- **Background**: **`bg-white/60`** (60% opacity white)
- **Blur**: **`backdrop-blur-xl`** (Extra large blur)
- **Border**: Bottom border `border-gray-100`
- **Flex Layout**: `flex items-center justify-between`
- **Drag Region**: Must have `data-window-drag` on the container.

```html
<div
  class="flex items-center justify-between bg-white/60 backdrop-blur-xl border-b border-gray-100 z-30 flex-shrink-0 sticky top-0 h-12 px-3 pr-32"
  data-window-drag
>
  <!-- Content -->
</div>
```

### 3.3 Header Elements

#### Navigation Buttons (Left)
-   **Component**: `n-button-group`
-   **Button Type**: `quaternary`, `circle`, `size="small"`
-   **Icon Size**: `20px` (`ChevronLeft`, `ChevronRight`)
-   **Color**: `text-gray-500 hover:text-gray-900`

#### Search Bar (Collapsible)
-   **Container**: Flex container aligned to right.
-   **Collapsed State**:
    -   Shows only a Search icon button (`n-button` quaternary circle small).
    -   Width: `w-8`
-   **Expanded State**:
    -   Shows `n-input`
    -   Width: `w-48`
-   **Transition**: `transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]`
-   **Input Style**:
    -   Background: `bg-gray-100/50`
    -   Border: `border-transparent`
    -   Hover: `hover:bg-gray-100`
    -   Focus: `focus:bg-white`
    -   Text Size: `text-[13px]`
    -   Border Radius: `!rounded-md`
    -   Icon: `text-gray-400`, size `14`

#### Action Buttons (Right)
-   **Type**: `n-button` quaternary circle small
-   **Icon Size**: `18px` (`MoreHorizontal`, `Settings`, etc.)
-   **Color**: `text-gray-500 hover:text-gray-900`

### 3.4 Header Content Philosophy (Simplicity First)
The header is a functional control area and MUST NOT be cluttered.

-   **Simplicity**: Avoid complex elements, large texts, or heavy components.
-   **Content**:
    -   **Titles**: Use simple, short text. Font size `text-[14px]`, weight `font-bold` or `font-semibold`.
    -   **Icons**: Use standard size icons (16px-20px). Avoid colorful or overly detailed icons in the header.
    -   **Controls**: Use simple icon buttons (quaternary circle).
-   **Prohibited**:
    -   No large banners or images.
    -   No multi-line text.
    -   No complex forms (except the collapsible search bar).
    -   No dense button groups (limit to 3-4 essential actions).

---

## 4. Main Content Area

### 4.1 Container
-   **Padding Top**: **`pt-12`** (Strictly required to prevent content from being hidden behind the absolute header).
-   **Background**: `bg-white` (or transparent if root is white)
-   **Scroll**: `overflow-y-auto`

---

## 5. Compatibility & Behavior

### 5.1 Window Controls (Traffic Lights)
-   **Sidebar**: Top `48px` spacer ensures sidebar title starts *below* traffic lights.
-   **Header**: `pr-32` (128px) right padding ensures header controls (search, options) do not overlap with window controls (minimize/maximize/close) which are typically on the right in this environment (or left, but `pr-32` balances the layout regardless).

### 5.2 Dragging
-   **Sidebar Top**: `data-window-drag` on the 48px spacer.
-   **Header**: `data-window-drag` on the entire header container.
-   **Interactive Elements**: Buttons and inputs inside the header must stop propagation or be outside the drag target, but `data-window-drag` usually handles this by excluding clickable elements.

---

## 6. Adopted Apps

The following apps MUST strictly follow this design specification:

1.  **File Browser** (Reference Implementation)
2.  **Settings**
3.  **App Store**
4.  **Downloader**
5.  **Logs**
6.  **Wallpaper**
7.  **Dashboard**

---

**End of Design Document**
