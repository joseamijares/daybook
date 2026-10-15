# The window Daybook.dmg opens in, for dmgbuild (mac/scripts/package-dmg.sh).
# Drawn in Paper on "v3 · Placard": "Mac · DMG window (preview)" shows it with
# the icons, and "Mac · DMG background (export)" is background.tiff (1x and 2x,
# joined with tiffutil -cathidpicheck). Daybook hangs in a gilt frame under a
# picture lamp, a brass arrow points to Applications in a wood frame, and Finder
# writes each name on the brass plaque under its icon.
import os.path

application = defines["app"]  # noqa: F821 (dmgbuild passes -D app=…)
appname = os.path.basename(application)

format = "UDZO"
files = [application]
symlinks = {"Applications": "/Applications"}
hide_extensions = [appname]

background = defines["background"]  # noqa: F821
# 420 for the background, plus the 28pt title bar Finder takes from it.
window_rect = ((200, 140), (660, 448))
default_view = "icon-view"
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
show_icon_preview = False

icon_size = 112
text_size = 14  # the names land on the brass plaques
label_pos = "bottom"
icon_locations = {appname: (170, 176), "Applications": (490, 176)}
