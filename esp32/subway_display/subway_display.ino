/*
 * NYC Subway Departure Display
 *
 * Shows "leave by" countdowns for L, G, M, J trains on a HUB75 LED matrix.
 * Built for ESP32 + 64x32 P2.5 panel.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>

// =============================================================================
// CONFIGURATION
// =============================================================================

const char* WIFI_SSID = "TP-Link_8F9B";
const char* WIFI_PASSWORD = "76199264";

// Backend API URL
const char* API_URL = "http://get-to-the-subway-production.up.railway.app/api/esp32/departures";

// Timing
const unsigned long FETCH_INTERVAL = 10000;  // 10 seconds

// Lock threshold: don't update times when less than this many seconds remain
const int LOCK_THRESHOLD_SECONDS = 90;

// NTP Configuration
const char* NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET_SEC = -5 * 3600;  // EST = UTC-5
const int DAYLIGHT_OFFSET_SEC = 0;

// Display Configuration
#define PANEL_WIDTH 64
#define PANEL_HEIGHT 32

// =============================================================================
// COLORS (RGB888)
// =============================================================================

// MTA Line Colors
const uint8_t COLOR_L[] = {167, 169, 172};  // Gray
const uint8_t COLOR_G[] = {108, 190, 69};   // Lime Green
const uint8_t COLOR_M[] = {255, 99, 25};    // Orange
const uint8_t COLOR_J[] = {153, 102, 51};   // Brown

// State Colors
const uint8_t COLOR_WHITE[] = {255, 255, 255};
const uint8_t COLOR_DIM_WHITE[] = {128, 128, 128};
const uint8_t COLOR_AMBER[] = {255, 191, 0};
const uint8_t COLOR_RED[] = {255, 0, 0};
const uint8_t COLOR_DIM[] = {60, 60, 60};
const uint8_t COLOR_BLACK[] = {0, 0, 0};

// =============================================================================
// DATA STRUCTURES
// =============================================================================

struct StationData {
  char line;
  long leaveByTime;
  long arrivalTime;
  char status[12];
  // Time lock: prevent jumps when countdown is low
  long lockedLeaveByTime;
  long lockedArrivalTime;
  bool isLocked;
};

StationData stations[4];

// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

MatrixPanel_I2S_DMA *display = nullptr;
unsigned long lastFetchTime = 0;
unsigned long lastDataReceived = 0;
bool timeConfigured = false;

// =============================================================================
// 3x5 PIXEL FONT
// =============================================================================

const uint8_t FONT_0[] = {0xE0, 0xA0, 0xA0, 0xA0, 0xE0};  // 111, 101, 101, 101, 111
const uint8_t FONT_1[] = {0x40, 0xC0, 0x40, 0x40, 0xE0};  // 010, 110, 010, 010, 111
const uint8_t FONT_2[] = {0xE0, 0x20, 0xE0, 0x80, 0xE0};  // 111, 001, 111, 100, 111
const uint8_t FONT_3[] = {0xE0, 0x20, 0xE0, 0x20, 0xE0};  // 111, 001, 111, 001, 111
const uint8_t FONT_4[] = {0xA0, 0xA0, 0xE0, 0x20, 0x20};  // 101, 101, 111, 001, 001
const uint8_t FONT_5[] = {0xE0, 0x80, 0xE0, 0x20, 0xE0};  // 111, 100, 111, 001, 111
const uint8_t FONT_6[] = {0xE0, 0x80, 0xE0, 0xA0, 0xE0};  // 111, 100, 111, 101, 111
const uint8_t FONT_7[] = {0xE0, 0x20, 0x20, 0x20, 0x20};  // 111, 001, 001, 001, 001
const uint8_t FONT_8[] = {0xE0, 0xA0, 0xE0, 0xA0, 0xE0};  // 111, 101, 111, 101, 111
const uint8_t FONT_9[] = {0xE0, 0xA0, 0xE0, 0x20, 0xE0};  // 111, 101, 111, 001, 111
const uint8_t FONT_COLON[] = {0x00, 0x40, 0x00, 0x40, 0x00};  // :

// Letters for line badges (3x5)
const uint8_t FONT_L[] = {0x80, 0x80, 0x80, 0x80, 0xE0};  // L
const uint8_t FONT_G[] = {0xE0, 0x80, 0xA0, 0xA0, 0xE0};  // G
const uint8_t FONT_M[] = {0xA0, 0xE0, 0xE0, 0xA0, 0xA0};  // M
const uint8_t FONT_J[] = {0x20, 0x20, 0x20, 0xA0, 0xE0};  // J

// "LEAVE IN" header letters
const uint8_t FONT_E[] = {0xE0, 0x80, 0xC0, 0x80, 0xE0};  // E
const uint8_t FONT_A[] = {0x40, 0xA0, 0xE0, 0xA0, 0xA0};  // A
const uint8_t FONT_V[] = {0xA0, 0xA0, 0xA0, 0xA0, 0x40};  // V
const uint8_t FONT_I[] = {0xE0, 0x40, 0x40, 0x40, 0xE0};  // I
const uint8_t FONT_N[] = {0xA0, 0xE0, 0xE0, 0xE0, 0xA0};  // N

// State text
const uint8_t FONT_O[] = {0xE0, 0xA0, 0xA0, 0xA0, 0xE0};  // O
const uint8_t FONT_W[] = {0xA0, 0xA0, 0xE0, 0xE0, 0xA0};  // W
const uint8_t FONT_R[] = {0xC0, 0xA0, 0xC0, 0xA0, 0xA0};  // R
const uint8_t FONT_U[] = {0xA0, 0xA0, 0xA0, 0xA0, 0xE0};  // U
const uint8_t FONT_C[] = {0xE0, 0x80, 0x80, 0x80, 0xE0};  // C
const uint8_t FONT_T[] = {0xE0, 0x40, 0x40, 0x40, 0x40};  // T
const uint8_t FONT_S[] = {0xE0, 0x80, 0xE0, 0x20, 0xE0};  // S
const uint8_t FONT_Y[] = {0xA0, 0xA0, 0x40, 0x40, 0x40};  // Y
const uint8_t FONT_DASH[] = {0x00, 0x00, 0xE0, 0x00, 0x00};  // -
const uint8_t FONT_EXCLAIM[] = {0x40, 0x40, 0x40, 0x00, 0x40};  // !

// =============================================================================
// DISPLAY FUNCTIONS
// =============================================================================

void initDisplay() {
  Serial.println("Initializing display...");

  HUB75_I2S_CFG mxconfig(PANEL_WIDTH, PANEL_HEIGHT, 1);

  // Fix pixel wrap issue - invert clock phase
  mxconfig.clkphase = false;

  // Enable double buffering to prevent flicker
  mxconfig.double_buff = true;

  display = new MatrixPanel_I2S_DMA(mxconfig);

  if (!display->begin()) {
    Serial.println("Display init failed!");
    return;
  }

  display->setBrightness8(64);  // 25% brightness for 1.5A supply
  display->clearScreen();
  Serial.println("Display initialized!");
}

void drawPixel(int x, int y, const uint8_t* color) {
  if (x >= 0 && x < PANEL_WIDTH && y >= 0 && y < PANEL_HEIGHT) {
    display->drawPixelRGB888(x, y, color[0], color[1], color[2]);
  }
}

void drawChar3x5(int x, int y, const uint8_t* charData, const uint8_t* color) {
  for (int row = 0; row < 5; row++) {
    uint8_t rowData = charData[row];
    if (rowData & 0x80) drawPixel(x, y + row, color);
    if (rowData & 0x40) drawPixel(x + 1, y + row, color);
    if (rowData & 0x20) drawPixel(x + 2, y + row, color);
  }
}

const uint8_t* getDigitFont(char c) {
  switch (c) {
    case '0': return FONT_0;
    case '1': return FONT_1;
    case '2': return FONT_2;
    case '3': return FONT_3;
    case '4': return FONT_4;
    case '5': return FONT_5;
    case '6': return FONT_6;
    case '7': return FONT_7;
    case '8': return FONT_8;
    case '9': return FONT_9;
    case ':': return FONT_COLON;
    default: return FONT_0;
  }
}

void drawNumber(int x, int y, int minutes, int seconds, const uint8_t* color) {
  // Format: M:SS or MM:SS
  char buf[6];
  snprintf(buf, sizeof(buf), "%d:%02d", minutes, seconds);

  int curX = x;
  for (int i = 0; buf[i] != '\0'; i++) {
    drawChar3x5(curX, y, getDigitFont(buf[i]), color);
    curX += 4;  // 3 pixels + 1 space
  }
}

void drawText(int x, int y, const char* text, const uint8_t* color) {
  int curX = x;
  for (int i = 0; text[i] != '\0'; i++) {
    const uint8_t* charFont = nullptr;
    switch (text[i]) {
      case 'L': charFont = FONT_L; break;
      case 'E': charFont = FONT_E; break;
      case 'A': charFont = FONT_A; break;
      case 'V': charFont = FONT_V; break;
      case 'I': charFont = FONT_I; break;
      case 'N': charFont = FONT_N; break;
      case 'O': charFont = FONT_O; break;
      case 'W': charFont = FONT_W; break;
      case 'R': charFont = FONT_R; break;
      case 'U': charFont = FONT_U; break;
      case 'G': charFont = FONT_G; break;
      case 'M': charFont = FONT_M; break;
      case 'J': charFont = FONT_J; break;
      case 'C': charFont = FONT_C; break;
      case 'T': charFont = FONT_T; break;
      case 'S': charFont = FONT_S; break;
      case 'Y': charFont = FONT_Y; break;
      case '-': charFont = FONT_DASH; break;
      case '!': charFont = FONT_EXCLAIM; break;
      case ' ': curX += 2; continue;
      default: curX += 4; continue;
    }
    if (charFont) {
      drawChar3x5(curX, y, charFont, color);
      curX += 4;
    }
  }
}

void drawFilledCircle(int cx, int cy, int r, const uint8_t* color) {
  for (int y = -r; y <= r; y++) {
    for (int x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) {
        drawPixel(cx + x, cy + y, color);
      }
    }
  }
}

// Draw circle with faded outer ring (like the React simulator)
void drawBadgeCircle(int cx, int cy, int r, const uint8_t* color) {
  // Draw outer ring first (dimmed to ~30% brightness)
  uint8_t dimColor[3] = {color[0] / 3, color[1] / 3, color[2] / 3};
  for (int y = -(r + 1); y <= (r + 1); y++) {
    for (int x = -(r + 1); x <= (r + 1); x++) {
      int distSq = x * x + y * y;
      // Only draw the ring (between r and r+1)
      if (distSq > r * r && distSq <= (r + 1) * (r + 1) + 1) {
        drawPixel(cx + x, cy + y, dimColor);
      }
    }
  }

  // Draw filled circle on top
  drawFilledCircle(cx, cy, r, color);
}

const uint8_t* getLineColor(char line) {
  switch (line) {
    case 'L': return COLOR_L;
    case 'G': return COLOR_G;
    case 'M': return COLOR_M;
    case 'J': return COLOR_J;
    default: return COLOR_WHITE;
  }
}

const uint8_t* getLineLetter(char line) {
  switch (line) {
    case 'L': return FONT_L;
    case 'G': return FONT_G;
    case 'M': return FONT_M;
    case 'J': return FONT_J;
    default: return FONT_L;
  }
}

void drawStation(int x, int y, StationData& station, time_t now) {
  // Draw line badge circle
  const uint8_t* lineColor = getLineColor(station.line);
  drawFilledCircle(x + 4, y + 3, 4, lineColor);

  // Draw line letter in black
  drawChar3x5(x + 3, y + 1, getLineLetter(station.line), COLOR_BLACK);

  // Calculate time remaining
  long secondsUntilLeave = station.leaveByTime - now;

  // Determine what to display
  const uint8_t* textColor;
  int textX = x + 11;

  if (strcmp(station.status, "none") == 0 || station.leaveByTime == 0) {
    // No trains
    drawText(textX, y + 1, "---", COLOR_DIM);
  } else if (secondsUntilLeave <= -10) {
    // Missed
    drawText(textX, y + 1, "---", COLOR_DIM);
  } else if (secondsUntilLeave <= 5) {
    // RUN!
    drawText(textX, y + 1, "RUN!", COLOR_RED);
  } else if (secondsUntilLeave <= 30) {
    // NOW
    drawText(textX, y + 1, "NOW", COLOR_AMBER);
  } else {
    // Normal countdown (offset by 30 seconds)
    long displaySeconds = secondsUntilLeave - 30;
    int minutes = displaySeconds / 60;
    int seconds = displaySeconds % 60;
    drawNumber(textX, y + 1, minutes, seconds, COLOR_WHITE);
  }
}

void renderDisplay() {
  // Draw to back buffer, then flip (prevents flicker)
  display->flipDMABuffer();
  display->clearScreen();

  time_t now = getCurrentTime();

  // Draw header "LEAVE IN" (dimmed)
  drawText(2, 1, "LEAVE IN", COLOR_DIM_WHITE);

  // Draw stale indicator if no data for 60+ seconds
  if (lastDataReceived > 0 && (millis() - lastDataReceived > 60000)) {
    drawText(58, 1, "!", COLOR_RED);
  }

  // Draw 2x2 grid of stations
  // Top row: L (left), G (right)
  drawStation(0, 8, stations[0], now);   // L
  drawStation(32, 8, stations[1], now);  // G

  // Bottom row: M (left), J (right)
  drawStation(0, 20, stations[2], now);  // M
  drawStation(32, 20, stations[3], now); // J
}

// =============================================================================
// SETUP
// =============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("================================");
  Serial.println("NYC Subway Departure Display");
  Serial.println("================================");
  Serial.println();

  // Initialize display first (shows we're alive)
  initDisplay();

  // Show "Connecting..." on display
  display->clearScreen();
  drawText(8, 14, "CONNECTING", COLOR_DIM_WHITE);

  // Initialize station data
  stations[0].line = 'L';
  stations[1].line = 'G';
  stations[2].line = 'M';
  stations[3].line = 'J';
  for (int i = 0; i < 4; i++) {
    stations[i].leaveByTime = 0;
    stations[i].arrivalTime = 0;
    stations[i].lockedLeaveByTime = 0;
    stations[i].lockedArrivalTime = 0;
    stations[i].isLocked = false;
    strcpy(stations[i].status, "none");
  }

  connectToWiFi();

  // Show "Syncing..." on display
  display->clearScreen();
  drawText(12, 14, "SYNCING", COLOR_DIM_WHITE);

  // Sync time with NTP server
  if (WiFi.status() == WL_CONNECTED) {
    syncTime();
  }

  // Fetch data immediately on startup
  if (WiFi.status() == WL_CONNECTED && timeConfigured) {
    fetchTrainData();
  }
}

// =============================================================================
// LOOP
// =============================================================================

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected! Reconnecting...");
    display->clearScreen();
    drawText(4, 14, "RECONNECTING", COLOR_AMBER);
    connectToWiFi();
    return;
  }

  // Fetch new data every FETCH_INTERVAL
  unsigned long currentMillis = millis();
  if (currentMillis - lastFetchTime >= FETCH_INTERVAL) {
    fetchTrainData();
    lastFetchTime = currentMillis;
  }

  // Update display every 100ms for smooth countdown
  static unsigned long lastRender = 0;
  if (currentMillis - lastRender >= 100) {
    renderDisplay();
    lastRender = currentMillis;
  }

  delay(10);
}

// =============================================================================
// WIFI CONNECTION
// =============================================================================

void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.disconnect(true);
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Failed to connect to WiFi!");
  }
}

// =============================================================================
// NTP TIME SYNC
// =============================================================================

void syncTime() {
  Serial.println("Syncing time with NTP server...");
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);

  int attempts = 0;
  time_t now = time(nullptr);
  while (now < 1000000000 && attempts < 20) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    attempts++;
  }

  Serial.println();

  if (now > 1000000000) {
    timeConfigured = true;
    Serial.println("Time synchronized!");
    struct tm* timeinfo = localtime(&now);
    Serial.print("Current time: ");
    Serial.println(asctime(timeinfo));
  } else {
    Serial.println("Failed to sync time!");
  }
}

time_t getCurrentTime() {
  return time(nullptr);
}

// =============================================================================
// API FETCH
// =============================================================================

void fetchTrainData() {
  Serial.println("\nFetching train data...");

  HTTPClient http;
  http.begin(API_URL);
  http.setTimeout(10000);

  int httpCode = http.GET();

  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      parseTrainData(payload);
      lastDataReceived = millis();
    } else {
      Serial.print("HTTP error: ");
      Serial.println(httpCode);
    }
  } else {
    Serial.print("Request failed: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// =============================================================================
// JSON PARSING
// =============================================================================

void parseTrainData(String json) {
  Serial.println("Raw JSON:");
  Serial.println(json.substring(0, 500));  // Print first 500 chars

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, json);

  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }

  JsonArray stationsArray = doc["stations"];
  Serial.print("Found ");
  Serial.print(stationsArray.size());
  Serial.println(" stations");

  time_t now = getCurrentTime();
  int i = 0;

  for (JsonObject station : stationsArray) {
    if (i >= 4) break;

    const char* line = station["line"];
    stations[i].line = line[0];

    long newLeaveByTime = 0;
    long newArrivalTime = 0;

    if (!station["leaveByTime"].isNull()) {
      newLeaveByTime = station["leaveByTime"];
    }
    if (!station["arrivalTime"].isNull()) {
      newArrivalTime = station["arrivalTime"];
    }

    const char* status = station["status"];
    strncpy(stations[i].status, status, sizeof(stations[i].status) - 1);

    // Time lock logic: prevent jarring jumps when countdown is low
    if (stations[i].isLocked) {
      long lockedSecondsUntilLeave = stations[i].lockedLeaveByTime - now;

      // If locked time has expired (train departed), unlock
      if (lockedSecondsUntilLeave <= -10) {
        Serial.print("  ");
        Serial.print(stations[i].line);
        Serial.println(": UNLOCKED (expired)");
        stations[i].isLocked = false;
        stations[i].leaveByTime = newLeaveByTime;
        stations[i].arrivalTime = newArrivalTime;
      } else {
        // Keep using locked time
        Serial.print("  ");
        Serial.print(stations[i].line);
        Serial.print(": LOCKED at ");
        Serial.println(lockedSecondsUntilLeave);
      }
    } else {
      // Not locked - check if we should lock
      long secondsUntilLeave = newLeaveByTime - now;

      if (newLeaveByTime > 0 && secondsUntilLeave > 0 && secondsUntilLeave < LOCK_THRESHOLD_SECONDS) {
        // Lock this time
        stations[i].isLocked = true;
        stations[i].lockedLeaveByTime = newLeaveByTime;
        stations[i].lockedArrivalTime = newArrivalTime;
        stations[i].leaveByTime = newLeaveByTime;
        stations[i].arrivalTime = newArrivalTime;
        Serial.print("  ");
        Serial.print(stations[i].line);
        Serial.print(": LOCKING at ");
        Serial.println(secondsUntilLeave);
      } else {
        // Normal update
        stations[i].leaveByTime = newLeaveByTime;
        stations[i].arrivalTime = newArrivalTime;
        Serial.print("  ");
        Serial.print(stations[i].line);
        Serial.print(": status=");
        Serial.print(stations[i].status);
        Serial.print(", leaveBy=");
        Serial.println(stations[i].leaveByTime);
      }
    }

    i++;
  }

  Serial.println("Data updated");
}
