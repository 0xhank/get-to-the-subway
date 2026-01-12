# ESP32 Subway Departure Display Specification

A real-time NYC subway departure display built with an ESP32 and HUB75 LED matrix panel, showing personalized "leave by" countdowns for nearby stations.

## Overview

This project extends the Live Subway NYC application with a physical hardware display. The ESP32 connects to the existing backend, fetches departure times for configured stations, and displays countdown timers that account for your walk time to each station.

### Key Features

- **Personalized "Leave In" Countdowns**: Shows when to leave your apartment, not when the train arrives
- **Multi-Station Support**: Monitors L, G, M, and J trains across 3 physical stations in a 2x2 grid
- **Second-Precision Countdown**: Real-time countdown with M:SS format, offset by 30 seconds
- **Visual Alerts**: "LEAVE NOW" amber state (30-5s), "RUN!" red state (5s to -10s)
- **Time Lock**: Prevents countdown jumps when < 90 seconds remain
- **Offline Resilience**: Shows cached data with warning indicator during network issues

---

## Hardware

### Components

| Component | Specification | Notes |
|-----------|--------------|-------|
| **Microcontroller** | ESP32-WROOM DevKit (TYPE-C CH340C/CP2102) | Standard 30/38 pin development board |
| **Display** | P2.5 HUB75 LED Matrix, 64x32 pixels | 160x80mm, 1/16 scan, ICN2037 driver, indoor rated |
| **Power** | 5V 3A USB-C adapter | Panel draws up to 3.2-3.5A at full white; 3A sufficient for typical use |
| **Wiring** | Solderless jumper cables | For ESP32 to HUB75 header connection |

### Wiring Diagram

ESP32 DevKit to HUB75 panel connections (using ESP32-HUB75-MatrixPanel-I2S-DMA default pinout):

```
HUB75 Pin    ESP32 GPIO    Description
─────────    ──────────    ───────────
R1           GPIO 25       Red data (upper half)
G1           GPIO 26       Green data (upper half)
B1           GPIO 27       Blue data (upper half)
R2           GPIO 14       Red data (lower half)
G2           GPIO 12       Green data (lower half)
B2           GPIO 13       Blue data (lower half)
A            GPIO 23       Row select A
B            GPIO 19       Row select B
C            GPIO 5        Row select C
D            GPIO 17       Row select D
CLK          GPIO 16       Clock
LAT          GPIO 4        Latch
OE           GPIO 15       Output enable
GND          GND           Ground (connect multiple)
VCC          5V            Power (from external supply, not ESP32)
```

**Important**: Power the HUB75 panel directly from the 5V supply, not through the ESP32's 5V pin. The ESP32 can be powered via USB-C from the same supply if it has sufficient amperage.

---

## Display Layout

### Screen Dimensions
- **Resolution**: 64 pixels wide × 32 pixels tall
- **2x2 Grid Layout**: All 4 stations visible simultaneously

### Layout Structure

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │  <- Row 0: padding
│  LEAVE IN                                            [!]      │  <- Row 1: Header (dimmed white, error icon if stale)
│                                                                │  <- Row 7: padding
├───────────────────────────────┬────────────────────────────────┤
│     ●L     1:30               │     ●G     0:45                │  <- Rows 8-17: Top row (L + G)
├───────────────────────────────┼────────────────────────────────┤
│     ●M     2:15               │     ●J     NOW                 │  <- Rows 20-29: Bottom row (M + J)
└───────────────────────────────┴────────────────────────────────┘
```

### Grid Positions

| Station | Grid Position | X Offset | Y Offset |
|---------|--------------|----------|----------|
| L       | Top-left     | 0        | 8        |
| G       | Top-right    | 32       | 8        |
| M       | Bottom-left  | 0        | 20       |
| J       | Bottom-right | 32       | 20       |

### Visual Elements

#### Header Row
- **Text**: "LEAVE IN" in dimmed white (#888888)
- **Position**: x=2, y=1
- **Error indicator**: Red "!" at x=60 when data is stale (>60s since last update)

#### Station Cells (12 pixels tall each)

Each station cell contains:

1. **Line Badge**: Anti-aliased circular badge with MTA line color
   - Radius: 4 pixels
   - Center: x+5, y+3 relative to cell
   - Contains single letter (L, G, M, J) in black
   - Colors (MTA official):
     - L: Gray (#A7A9AC)
     - G: Lime Green (#6CBE45)
     - M: Orange (#FF6319)
     - J: Brown (#996633)

2. **Countdown Timer**: M:SS format offset by 30 seconds
   - Position: x+12 from cell start
   - Format: `1:30` shows when 2:00 actual time remains (offset by 30s)
   - Colors by state:
     - Normal: White (#FFFFFF)
     - LEAVE NOW: Amber (#FFBF00)
     - RUN!: Red (#FF0000)

### Display States

The countdown display uses a 30-second offset, meaning the displayed time is always 30 seconds less than the actual time remaining. This gives users a buffer to actually leave.

| Actual Time Remaining | Display Shows | State |
|-----------------------|---------------|-------|
| > 30 seconds          | M:SS countdown (actual - 30s) | Normal (white) |
| 30 to 5 seconds       | "NOW"         | Leave Now (amber) |
| 5 to -10 seconds      | "RUN!"        | Run (red) |
| < -10 seconds         | Hidden        | Show next train |

#### Normal State (> 30 seconds)
- Countdown: White text, M:SS format
- Shows actual time minus 30 seconds (e.g., 90s actual → displays "1:00")
- Decrements every second

#### Leave Now State (30 to 5 seconds)
- Text: "NOW" in amber (#FFBF00)
- Indicates user should leave immediately

#### Run State (5 seconds to -10 seconds)
- Text: "RUN!" in red (#FF0000)
- User is cutting it close or slightly late
- Lasts for 15 seconds total (5s before to 10s after leave-by time)

#### Hidden State (< -10 seconds)
- Train entry disappears
- Next available train is shown
- Prevents showing trains that have already departed

#### No Trains State
- Text: "---"
- Color: Dim gray (#333333)

#### Error State (>60 seconds since last update)
- Header: "LEAVE IN" with red "!" in top-right corner
- Countdown: Shows last known values (cached)
- Continues to decrement locally

#### Boot Sequence
1. "Connecting..." - WiFi connection phase
2. "Syncing..." - First API fetch + NTP time sync
3. Normal display once data received

#### Off State (12am - 6am)
- Display completely dark
- ESP32 continues running (for NTP sync)
- Resumes display at 6am

### Time Lock Feature

To prevent jarring countdown jumps when the API returns updated arrival times, a lock mechanism is used:

**Lock Threshold**: 90 seconds

**Behavior**:
1. When a station's countdown drops below 90 seconds, the arrival time is "locked"
2. Subsequent API updates for that station are ignored
3. The countdown continues to decrement based on the locked time
4. When the countdown reaches -10 seconds (train departed), the lock is released
5. The next train's time is then shown

**Purpose**: MTA arrival predictions can fluctuate by 10-30 seconds between updates. Without locking, users would see confusing jumps like "1:15" → "0:58" → "1:22". The lock ensures a smooth, predictable countdown once a train is imminent.

---

## Data Flow

### Architecture

```
MTA GTFS-RT → Transiter → Express Backend → ESP32 Endpoint → ESP32 → HUB75 Display
                                ↓
                         Walk time calculation
                         (configured on backend)
```

### New Backend Endpoint

#### `GET /api/esp32/departures`

A lightweight endpoint optimized for ESP32 consumption.

**Request**: No parameters (configuration stored on backend)

**Response**:
```typescript
{
  timestamp: number;           // Unix timestamp (seconds)
  stations: [
    {
      line: "L";               // Line identifier
      leaveByTime: number;     // Unix timestamp (seconds) - when to leave apartment
      arrivalTime: number;     // Unix timestamp (seconds) - when train arrives
      direction: "S";          // N or S
      status: "normal" | "leave_now" | "missed" | "none";
    },
    {
      line: "G";
      leaveByTime: number;
      arrivalTime: number;
      direction: "S";
      status: "normal";
    },
    {
      line: "M";
      leaveByTime: number;
      arrivalTime: number;
      direction: "S";
      status: "normal";
    },
    {
      line: "J";
      leaveByTime: number;
      arrivalTime: number;
      direction: "S";
      status: "normal";
    }
  ]
}
```

**Backend Configuration** (environment variables):
```env
# ESP32 Station Configuration
ESP32_L_STOP_ID=L10S           # Lorimer St L (Manhattan-bound)
ESP32_L_WALK_MINUTES=X         # Walk time to L station

ESP32_G_STOP_ID=G29S           # Lorimer St G (Church Ave-bound)
ESP32_G_WALK_MINUTES=Y         # Walk time to G station

ESP32_MJ_STOP_ID=M11S          # Myrtle-Broadway M/J (Manhattan-bound)
ESP32_MJ_WALK_MINUTES=Z        # Walk time to M/J station
```

**Leave By Calculation**:
```
leaveByTime = arrivalTime - (walkMinutes * 60)
```

**Status Logic**:
- `normal`: leaveByTime > 30 seconds from now
- `leave_now`: leaveByTime ≤ 30 seconds AND > 5 seconds from now
- `run`: leaveByTime ≤ 5 seconds AND > -10 seconds from now
- `none`: leaveByTime ≤ -10 seconds (train departed, show next)

### Polling Strategy

- ESP32 polls `/api/esp32/departures` every **10 seconds**
- Local countdown decrements every second between polls
- Time lock prevents jumps when < 90 seconds remain (see Time Lock Feature above)

---

## ESP32 Firmware

### Development Environment

- **IDE**: Arduino IDE
- **Board Package**: ESP32 by Espressif Systems
- **Library**: ESP32-HUB75-MatrixPanel-I2S-DMA

### Project Structure

```
esp32/
├── subway_display/
│   ├── subway_display.ino     # Main Arduino sketch
│   ├── config.h               # WiFi credentials, API URL
│   ├── display.h              # HUB75 rendering functions
│   ├── display.cpp
│   ├── api.h                  # HTTP client for backend
│   ├── api.cpp
│   ├── countdown.h            # Timer logic
│   ├── countdown.cpp
│   └── colors.h               # MTA color definitions
└── README.md                  # Setup and wiring instructions
```

### Configuration (config.h)

```cpp
// WiFi
#define WIFI_SSID "your_network"
#define WIFI_PASSWORD "your_password"

// Backend
#define API_URL "https://your-backend.railway.app/api/esp32/departures"
#define API_POLL_INTERVAL_MS 10000

// Display
#define PANEL_WIDTH 64
#define PANEL_HEIGHT 32

// Time
#define NTP_SERVER "pool.ntp.org"
#define TIMEZONE_OFFSET -5  // EST (adjust for EDT)
#define OFF_HOUR_START 0    // 12am
#define OFF_HOUR_END 6      // 6am

// Stale data threshold
#define STALE_THRESHOLD_MS 60000
```

### Main Loop Logic

```cpp
void loop() {
  // Check if display should be off (12am-6am)
  if (isOffHours()) {
    clearDisplay();
    delay(60000);  // Check again in 1 minute
    return;
  }

  // Poll API every 10 seconds
  if (millis() - lastPoll > API_POLL_INTERVAL_MS) {
    fetchDepartures();
    lastPoll = millis();
  }

  // Update countdown every second
  if (millis() - lastCountdownUpdate > 1000) {
    updateCountdowns();
    lastCountdownUpdate = millis();
  }

  // Render 2x2 grid (all 4 stations)
  renderDisplay();
}
```

### Rendering the 2x2 Grid

All 4 stations are rendered simultaneously in a 2x2 grid:

```cpp
void renderDisplay() {
  // Clear buffer
  clearBuffer();

  // Draw header
  drawText("LEAVE IN", 2, 1, COLOR_DIM_WHITE);

  // Draw stale indicator if needed
  if (isDataStale()) {
    drawText("!", 60, 1, COLOR_RED);
  }

  // Draw 2x2 grid of stations
  // Top-left: L, Top-right: G
  // Bottom-left: M, Bottom-right: J
  drawStation(stations[0], 0, 8);   // L
  drawStation(stations[1], 32, 8);  // G
  drawStation(stations[2], 0, 20);  // M
  drawStation(stations[3], 32, 20); // J

  // Push buffer to display
  display.show();
}

void drawStation(Station& s, int x, int y) {
  // Draw anti-aliased circle badge
  drawCircle(x + 5, y + 3, 4, getLineColor(s.line));

  // Draw line letter in black
  drawLetter(s.line, x + 4, y + 1, COLOR_BLACK);

  // Calculate display state
  int secondsUntilLeave = s.leaveByTime - now;

  if (secondsUntilLeave <= -10) {
    drawText("---", x + 12, y + 1, COLOR_DIM);
  } else if (secondsUntilLeave <= 5) {
    drawText("RUN!", x + 12, y + 1, COLOR_RED);
  } else if (secondsUntilLeave <= 30) {
    drawText("NOW", x + 12, y + 1, COLOR_AMBER);
  } else {
    // Show countdown offset by 30 seconds
    int displaySeconds = secondsUntilLeave - 30;
    drawCountdown(displaySeconds, x + 12, y + 1, COLOR_WHITE);
  }
}
```

---

## MTA Line Colors

```cpp
// colors.h
#define COLOR_L  0xA7A9AC  // Gray
#define COLOR_G  0x6CBE45  // Lime Green
#define COLOR_M  0xFF6319  // Orange
#define COLOR_J  0x996633  // Brown

// For display library (RGB565 format may be needed)
uint16_t getLineColor(char line) {
  switch(line) {
    case 'L': return matrix.color565(167, 169, 172);
    case 'G': return matrix.color565(108, 190, 69);
    case 'M': return matrix.color565(255, 99, 25);
    case 'J': return matrix.color565(153, 102, 51);
    default:  return matrix.color565(255, 255, 255);
  }
}
```

---

## Implementation Phases

### Phase 1: Basic Display (MVP)

**Goal**: ESP32 connects to WiFi, fetches data, displays static countdowns

Tasks:
1. Set up Arduino IDE with ESP32 board support
2. Install ESP32-HUB75-MatrixPanel-I2S-DMA library
3. Wire ESP32 to HUB75 panel
4. Display test pattern to verify wiring
5. Connect to WiFi and fetch test endpoint
6. Parse JSON response
7. Display single station countdown

**Verification**:
- Panel displays test pattern
- WiFi connects successfully
- API response parsed correctly
- Single countdown decrements

### Phase 2: Backend Endpoint

**Goal**: Create optimized `/api/esp32/departures` endpoint

Tasks:
1. Add new route file: `backend/src/routes/esp32.ts`
2. Implement walk-time configuration via environment variables
3. Calculate leave-by times server-side
4. Return minimal JSON payload
5. Add endpoint to Express app

**Verification**:
- `curl http://localhost:3001/api/esp32/departures` returns expected JSON
- Leave-by times correctly offset from arrival times

### Phase 3: Full Display Layout

**Goal**: Implement complete 2x2 grid layout

Tasks:
1. Implement header row with "LEAVE IN" text (dimmed white)
2. Draw anti-aliased circular line badges with correct colors
3. Render M:SS countdown format with 30-second offset
4. Implement 2x2 grid layout (L, G, M, J)

**Verification**:
- All 4 stations display simultaneously
- Line colors match MTA branding
- Countdown format is M:SS with correct offset

### Phase 4: States & Time Lock

**Goal**: Add display states and time lock feature

Tasks:
1. Add "NOW" amber state (30-5 seconds)
2. Add "RUN!" red state (5 to -10 seconds)
3. Implement train hiding when departed
4. Add "---" no trains state
5. Implement time lock (< 90 seconds remaining)
6. Implement boot sequence messages

**Verification**:
- States transition at correct thresholds
- Time lock prevents countdown jumps
- Trains disappear 10 seconds after leave-by time

### Phase 5: Error Handling & Polish

**Goal**: Robust operation and edge cases

Tasks:
1. Add stale data detection (60s threshold)
2. Show warning icon when stale
3. Implement off-hours (12am-6am) blackout
4. Add NTP time sync (boot + hourly)
5. Handle API errors gracefully
6. Test power cycling and recovery

**Verification**:
- Warning icon appears after 60s without update
- Display turns off at midnight, on at 6am
- Recovers gracefully from power loss

### Phase 6: Documentation

**Goal**: Complete learning project documentation

Tasks:
1. Write detailed README with photos
2. Document wiring with diagrams
3. Add code comments explaining each section
4. Create troubleshooting guide
5. Add configuration instructions

---

## Testing Checklist

### Hardware Tests
- [ ] Panel displays solid colors (R, G, B, W)
- [ ] All pixels functional (no dead pixels)
- [ ] No flickering at normal brightness
- [ ] Power supply stable under load

### Network Tests
- [ ] WiFi connects within 10 seconds
- [ ] API responds within 2 seconds
- [ ] Handles network disconnection gracefully
- [ ] Reconnects automatically after outage

### Display Tests
- [ ] All 4 stations visible in 2x2 grid
- [ ] Line badges render as anti-aliased circles
- [ ] Colors match MTA standards
- [ ] Countdown decrements smoothly with 30s offset
- [ ] "NOW" state triggers at 30 seconds
- [ ] "RUN!" state triggers at 5 seconds
- [ ] Trains hide at -10 seconds
- [ ] Time lock prevents jumps when < 90s remaining
- [ ] Warning icon appears when data stale

### Time Tests
- [ ] NTP syncs on boot
- [ ] Countdown matches expected times
- [ ] Off-hours blackout works
- [ ] Handles timezone correctly

---

## Dependencies

### Arduino Libraries
- **ESP32-HUB75-MatrixPanel-I2S-DMA** - Display driver
- **ArduinoJson** - JSON parsing
- **HTTPClient** (built-in) - API requests
- **WiFi** (built-in) - Network connectivity

### Backend Dependencies
- No new dependencies (uses existing Express setup)

---

## Future Enhancements (Out of Scope)

These features are explicitly not part of the initial implementation but could be added later:

- Multiple chained panels (128x32 or 64x64)
- Physical button for manual view switching
- Buzzer/audio alerts
- Web-based configuration portal
- OTA (over-the-air) firmware updates
- Service alerts/delays display
- Historical data logging

---

## Reference

### Stop IDs

The backend will need these specific stop IDs (to be confirmed during implementation):

| Station | Line | Direction | Stop ID |
|---------|------|-----------|---------|
| Lorimer St | L | Manhattan (8 Av) | L10S (verify) |
| Lorimer St | G | Church Av | G29S (verify) |
| Myrtle-Broadway | M | Manhattan | M11S (verify) |
| Myrtle-Broadway | J | Manhattan | M11S (verify) |

*Note: M and J share the Myrtle-Broadway station, likely same stop ID with different route filtering.*

### Existing Codebase References

| File | Purpose |
|------|---------|
| `backend/src/transiter/stops.ts` | Stop arrival fetching logic |
| `backend/src/routes/stops.ts` | Existing stops endpoint |
| `shared/src/index.ts` | TypeScript types for arrivals |
| `data/routes.geojson` | Route color definitions |

---

## Appendix: P2.5 Panel Specifications

Your specific panel details:

- **Model**: P2.5RGB-i (XUYRGB brand)
- **Resolution**: 64×32 pixels
- **Pixel Pitch**: 2.5mm
- **Module Size**: 160×80mm
- **Scan Mode**: 1/16 scan
- **Driver IC**: ICN2037
- **Interface**: HUB75
- **Voltage**: DC 5V
- **Max Current**: 3.2-3.5A
- **Use**: Indoor

This panel is well-supported by the ESP32-HUB75-MatrixPanel-I2S-DMA library with default settings.
