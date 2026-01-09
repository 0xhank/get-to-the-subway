# Mobile-Friendly Specification

## Overview

Transform the Live Subway NYC app to be fully mobile-friendly with responsive layouts, touch-optimized interactions, and native mobile patterns.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Breakpoint | 640px (`sm:`) | Tailwind default, covers most phones in portrait |
| Min width | 360px | Common small Android phones |
| Bottom sheet library | Vaul | Purpose-built for React, handles gestures and accessibility |
| Sheet snap points | 2 (collapsed/expanded) | Simple and intuitive |
| Controls | Hamburger menu with dropdown | Saves screen space |
| Tooltips on mobile | Tap to show, tap away to dismiss | No hover on touch devices |
| Zoom controls | Explicit +/- buttons | Easier than pinch-to-zoom for some users |
| Responsive detection | Screen width only (CSS) | Simpler than touch detection |
| Landscape handling | Keep portrait behavior | Consistent experience |
| Touch targets | 20% larger markers on mobile | Better tappability |

## Component Changes

### NearbyPanel (Bottom Sheet on Mobile)

**Desktop behavior**: Fixed panel at bottom-left, 384px wide

**Mobile behavior**: Vaul bottom sheet with:
- Collapsed state: Shows header + 1-2 nearest stations (peek)
- Expanded state: Full list of nearby stations
- Swipe gestures to expand/collapse
- Drag handle at top

```
┌─────────────────────────────┐
│ ▔▔▔ (drag handle)          │
│ Nearby Stations             │
│ • Times Sq - 42 St    2 min │
│ • 34 St - Herald Sq   4 min │
└─────────────────────────────┘
```

### StopPanel (Bottom Sheet on Mobile)

**Desktop behavior**: Right-side slide-in panel, 384px wide

**Mobile behavior**: Vaul bottom sheet with:
- Opens when station tapped
- Collapsed state: 40% height (station name + first few arrivals)
- Expanded state: 90% height (full arrivals list)
- Close button in header
- Map dimmed behind when open

```
┌─────────────────────────────┐
│ ▔▔▔                    [✕]  │
│ Times Square - 42nd St      │
│ ─────────────────────────── │
│ Northbound                  │
│ • N  Times Sq       2 min   │
│ • Q  57 St          5 min   │
│ Southbound                  │
│ • N  Canal St       3 min   │
└─────────────────────────────┘
```

### MobileMenu (Hamburger Menu)

**Visibility**: Only on mobile (< 640px)

**Position**: Top-left corner

**Contents**:
- About (opens AboutDialog)
- Lines filter (opens LinesDialog)
- Last updated: [timestamp]

```
┌──────────────────┐
│ ☰ Menu           │
├──────────────────┤
│ About            │
│ Filter Lines     │
│ ────────────────│
│ Updated: 2:34 PM │
└──────────────────┘
```

### ZoomControls

**Position**: Bottom-right, above NearbyPanel peek

**Visibility**: Mobile only (or configurable)

**Buttons**: + and - with appropriate touch target size (44x44px minimum)

```
┌─────┐
│  +  │
├─────┤
│  -  │
└─────┘
```

### Search Icon

**Position**: Top-right corner on mobile

**Behavior**: Opens SearchDialog when tapped

**Visibility**: Mobile only (desktop uses keyboard shortcut or button in ControlPanel)

### ControlPanel

**Mobile**: Hidden (`hidden sm:flex`)

**Desktop**: Unchanged (About, Lines buttons with keyboard hints)

### TimestampDisplay

**Mobile**: Hidden, value shown in MobileMenu instead

**Desktop**: Unchanged (top-right corner)

## Touch Interactions

### Station Tooltips

**Desktop**: Hover to show station name and lines

**Mobile**:
- Tap station to show tooltip
- Tap elsewhere on map to dismiss
- Tap same station again to open StopPanel

### Map Gestures

- Pan: Single finger drag
- Zoom: Pinch to zoom (native MapLibre)
- Zoom: +/- buttons as alternative

### Bottom Sheets

- Swipe up: Expand
- Swipe down: Collapse or dismiss
- Tap outside: Collapse (not dismiss)

## Visual Adjustments

### Marker Sizes (Mobile)

| Element | Desktop | Mobile |
|---------|---------|--------|
| Train markers | 1.0x scale | 1.2x scale |
| Stop markers | Current radius | +20% radius |
| Route lines | 1-4px width | 1.5-5px width |

### Spacing

| Element | Desktop | Mobile |
|---------|---------|--------|
| UIOverlay padding | 16px (`p-4`) | 8px (`p-2`) |
| Button sizes | Default | Minimum 44x44px touch target |

## File Changes Summary

### New Files

1. `frontend/src/components/ui/drawer.tsx` - Vaul wrapper component
2. `frontend/src/components/MobileMenu.tsx` - Hamburger menu
3. `frontend/src/components/ZoomControls.tsx` - Zoom +/- buttons
4. `frontend/src/hooks/useIsMobile.ts` - Responsive hook

### Modified Files

1. `frontend/src/components/StopPanel.tsx` - Add mobile drawer
2. `frontend/src/components/NearbyPanel.tsx` - Add mobile drawer
3. `frontend/src/components/UIOverlay.tsx` - Layout changes
4. `frontend/src/components/ControlPanel.tsx` - Hide on mobile
5. `frontend/src/components/TimestampDisplay.tsx` - Hide on mobile
6. `frontend/src/App.tsx` - Tooltip behavior, search icon
7. `frontend/src/components/Map/TrainLayer.tsx` - Larger markers
8. `frontend/src/components/Map/RouteLineLayer.tsx` - Thicker lines
9. `frontend/src/components/Map/StopLayer.tsx` - Larger touch targets

## Dependencies

```bash
pnpm add vaul
```

## Testing Checklist

- [ ] Test on 360px width (small Android)
- [ ] Test on 375px width (iPhone SE/mini)
- [ ] Test on 390px width (iPhone 14)
- [ ] Test on 640px width (breakpoint boundary)
- [ ] Test on 768px width (tablet)
- [ ] Verify NearbyPanel bottom sheet swipe gestures
- [ ] Verify StopPanel bottom sheet snap points
- [ ] Verify hamburger menu opens/closes
- [ ] Verify zoom controls work
- [ ] Verify tap-to-show tooltips
- [ ] Verify search icon opens dialog
- [ ] Verify marker sizes are larger on mobile
- [ ] Test with keyboard on mobile (search input)
- [ ] Test scroll within bottom sheets
