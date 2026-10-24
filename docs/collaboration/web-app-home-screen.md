Status: current as of 2026-10-22 (collaboration 1.6)

# Web apps: home screen icon and title

Open this when building or changing a web app's <head> or manifest.

- Every web app must look right when added to an iPhone home screen from Safari (Share > Add to Home Screen).
- In the page <head>:
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">   (180x180 PNG, square, no transparency)
  <meta name="apple-mobile-web-app-title" content="<Short Name>">   (about 12 characters max)
  <meta name="apple-mobile-web-app-capable" content="yes">
  <link rel="manifest" href="/manifest.webmanifest">
- manifest.webmanifest: name, short_name, display "standalone", start_url "/", background_color, theme_color, and icons at 192x192 and 512x512.
- Put the icon files in the public/static folder so they're served from the site root.
- Check it on an iPhone. The name stays editable in the add sheet, and an icon that was already added has to be removed and re-added to update.
- Template files: public/manifest.webmanifest and public/HOME_SCREEN.md.
