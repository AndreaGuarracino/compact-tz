# Compact Time Zones

Chrome extension that compares time zones in a compact list, one row per place.

Each row shows the name, the zone abbreviation (EDT, CEST, ...), the UTC offset, the date, the day difference and the time. Hours from 09:00 to 18:00 are green, hours from 22:00 to 08:00 are grey, and the row with your computer's time zone is blue.

## Install

1. Open `chrome://extensions` and turn on Developer mode.
2. Click "Load unpacked" and select this folder.

## Use

- ⋯ opens the search box and the settings. Search adds a city, a country (English or your browser language), an IANA zone (`Europe/Rome`) or an abbreviation (`PT`, `CEST`, `IST`).
- Double-click a name to rename it (Enter saves, Esc cancels), or click × and then Remove? to delete it.
- Drag a row, or press Alt+Up/Down, to reorder. ⋯ Sort by UTC offset orders the list.
- The date and the slider (+/-24 h in 15 min steps) change the time to compare.
- Settings: 12/24-hour, theme, font size.
- Places sync with your Chrome account. On a fresh install, an optional `places.json` (`[{"tz": "Europe/Rome", "label": "Rome"}]`, git-ignored) fills the list.

## City data

`cities.js` comes from [GeoNames](https://www.geonames.org/) `cities15000` (CC BY 4.0). Rebuild it with `python3 tools/build_cities.py cities.js`.

## License

Code: MIT. City data: GeoNames, CC BY 4.0.
