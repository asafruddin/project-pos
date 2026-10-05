# UI kit

Tokens and behaviour are ported from the PWA (`apps/cashier/src/app/globals.css`, `packages/ui`).

## Theme (`app/theme`)

- `tokens.ts`: the PWA's CSS variables, light (`:root`) and dark (`.dark`) — primary `#f97316`, background `#f4f6f8` /
  `#121212`, radius 12 px, breakpoints md 768 / lg 1024.
- `ThemeProvider` + `useTheme()`: `system | light | dark`, persisted in the SQLite `kv` table (`pref.theme`).
- Font: Inter (400/500/600/700) bundled via `@expo-google-fonts/inter`; use `<Text weight="semibold" size={14}>`.
- Language: `useT()` re-renders on change; `copy-*.ts` is generated from the PWA dictionaries, mobile-only strings live in
  `extra-*.ts` (the `id` dictionary is typed against `en`, so a missing key fails typecheck).

## Components (`app/components/ui`)

`Button` (default · secondary · outline · ghost · destructive · link; sizes default/sm/lg/icon/iconSm, 44 px touch height),
`TextField`, `Text`, `Card`, `StatusPill`, `Skeleton`, `Checkbox`, `SegmentedControl`, `Select` (opens a sheet),
`Dialog` (centered, optionally non-dismissable), `BottomSheet`, `MenuSheet` (dropdown replacement), `ToastProvider` /
`useToast`, `Icon` (Phosphor, deep imports so the 3000-icon barrel is not bundled).

`BottomSheet` and `Dialog` are built on RN `Modal` + `Animated` with no Reanimated / gesture-handler: drag handle,
backdrop tap and Android back to dismiss, keyboard avoidance. Revisit `@gorhom/bottom-sheet` only if it feels wrong
on device.

## Layout (`app/components/layout`)

`AppShell` (sidebar ≥ 1024, bottom nav below, header with account sheet, store chip, forced `OpenShiftDialog`),
`AuthShell` (brand hero + form), `PinPad`, `PrefControls`, `StoreLogo`/`BrandMark` (API logo cached on disk, else the
orange coffee mark), `ConnectivityBanner`, `SyncBadge`, `PrinterBadge`.

POS pieces live in `app/components/pos`: `ProductCard`, `ProductThumb`, `CartPanel` (side card on tablet, collapsed bar +
sheet on phone), `ParkedCartsDialog`, `ReceiptPreviewDialog`, `ReturnSaleForm`, `ManagerPinSheet`, `UnpackDialog`,
`CatalogFilterSheet`.

## Icons and splash

`node scripts/generate-icons.mjs` renders the launcher icon, adaptive layers and splash from the PWA's brand mark
(orange rounded square + Phosphor coffee). The PWA's own `icon-*.png` is a flat blue square that does not match its
theme, so it is not used.
