"""Chrome looks for Panyard: recolours every colour in the app's styles into a chrome palette.
Writes panyard-themes.css: html.th-cday (Chrome Day: lavender-silver, champagne gold, blue glints)
and html.th-cnight (Chrome Night: black, bright chrome, amber light). The usual Night and Day are untouched."""
import re, os, colorsys, sys, tinycss2
HERE = os.path.dirname(os.path.abspath(__file__))

COL = re.compile(r'#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|rgba?\([^)]*\)')

def parse(c):
    if c.startswith('#'):
        h = c[1:]
        if len(h) in (3, 4): h = ''.join(x * 2 for x in h)
        r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)); a = int(h[6:8], 16) / 255 if len(h) == 8 else 1
        return r, g, b, a
    n = re.findall(r'[\d.]+%?', c)
    if len(n) < 3: return None
    v = [float(x[:-1]) * 2.55 if x.endswith('%') else float(x) for x in n[:3]]
    a = n[3] if len(n) > 3 else '1'
    a = float(a[:-1]) / 100 if a.endswith('%') else float(a)
    return v[0] / 255, v[1] / 255, v[2] / 255, a

def fmt(r, g, b, a):
    q = lambda x: max(0, min(255, round(x * 255)))
    return '#%02x%02x%02x' % (q(r), q(g), q(b)) if a >= .999 else 'rgb(%d %d %d/%.3g)' % (q(r), q(g), q(b), a)

def hls(h, l, s): return colorsys.hls_to_rgb(h % 1, max(0, min(1, l)), max(0, min(1, s)))

def neutral(h, l, s):
    # the purple-night greys: low colour, or the lavender/indigo family the night look is built on
    return s < .22 or (.6 < h < .86 and (s < .75 or l < .3 or l > .8))

def gold(h, l, s): return .09 < h < .16 and s > .6

def day(c):
    p = parse(c)
    if not p: return c
    r, g, b, a = p; h, l, s = colorsys.rgb_to_hls(r, g, b)
    if neutral(h, l, s):
        L = 1 - l * .78           # night darks become light silver; light text becomes graphite
        if l > .82: L = .12 + (1 - l) * .6
        S = .16 if L > .5 else .14; H = .7    # a lavender tint through the silver
        if a < .999 and l > .9: return fmt(*hls(H, .18, .1), a * .9)        # white veils become soft dark veils
        if a < .999 and l < .08: return fmt(0.12, 0.1, .16, a * .45)       # shadows softer on light
        return fmt(*hls(H, L, S), a)
    if gold(h, l, s): return fmt(*hls(.115, .6 if l > .5 else l * .9, .66), a)   # champagne gold
    # note colours (coral, aqua, pink, green): kept, a little deeper so they read on silver
    return fmt(*hls(h, l * .82 if l > .55 else l, s * .9), a)

def night(c):
    p = parse(c)
    if not p: return c
    r, g, b, a = p; h, l, s = colorsys.rgb_to_hls(r, g, b)
    if neutral(h, l, s):
        if l > .8: return fmt(*hls(.1, min(.97, l + .02), .08), a)          # chrome-white text
        return fmt(*hls(.62, l * .92, min(s, .1) * .5), a)                   # graphite, a cool steel cast
    if gold(h, l, s): return fmt(*hls(.105, l * .98, .9), a)                 # amber pendant light
    return fmt(r, g, b, a)

def ser(nodes): return tinycss2.serialize(nodes)

def scope(sel, cls):
    out = []
    for part in sel.split(','):
        p = part.strip()
        if not p or 'html.day' in p or 'th-c' in p or 'th-sw' in p: continue
        if p.startswith(':root'): out.append('html.' + cls + p[5:])
        elif p.startswith('html'): out.append('html.' + cls + p[4:])
        else: out.append('html.' + cls + ' ' + p)
    return ', '.join(out)

def rules(nodes, cls, fn):
    out = []
    for n in nodes:
        if n.type == 'qualified-rule':
            sel = scope(ser(n.prelude), cls)
            if not sel: continue
            decs = []
            for d in tinycss2.parse_declaration_list(n.content, skip_comments=True, skip_whitespace=True):
                if d.type != 'declaration': continue
                v = ser(d.value).strip()
                colourish = re.match(r'(color|background|border|outline|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|stop-color|text-decoration-color|--)', d.name)
                if not COL.search(v) and not (colourish and 'var(' in v): continue
                nv = COL.sub(lambda m: fn(m.group(0)), v)
                decs.append('%s:%s%s' % (d.name, nv, '!important' if d.important else ''))
            if decs: out.append(sel + '{' + ';'.join(decs) + '}')
        elif n.type == 'at-rule' and n.lower_at_keyword in ('media', 'supports') and n.content:
            inner = rules(tinycss2.parse_rule_list(n.content, skip_comments=True, skip_whitespace=True), cls, fn)
            if inner: out.append('@' + n.at_keyword + ' ' + ser(n.prelude).strip() + '{' + ''.join(inner) + '}')
    return out

def theme_css(html):
    css = '\n'.join(re.findall(r'<style[^>]*>(.*?)</style>', html, re.S) + re.findall(r'textContent=`([^`]*)`', html))
    top = tinycss2.parse_stylesheet(css, skip_comments=True, skip_whitespace=True)
    parts = ['/* made by make_themes.py, do not edit by hand */']
    for cls, fn in (('th-cday', day), ('th-cnight', night)):
        parts += rules(top, cls, fn)
    parts.append(HAND)
    return '\n'.join(parts)

# by hand: the backgrounds, and the pans themselves in chrome
HAND = '''
html.th-cday,html.th-cday body{background:linear-gradient(160deg,#f3f1f6 0%,#dcd9e4 38%,#eceaf0 62%,#cfd3de 100%) fixed;color:#1f1c27}
html.th-cday{--gold:#c99a3c;--gold-ink:#2a1a00;--text:#1f1c27;--muted:#66617a;--line:#c3bfd0;--surface:#f7f6fa;--raised:#ffffff;--bg:#e6e3ec;--steel:#3c3850}
html.th-cday :is(.sxic,.hm-ic,.gd-play){color:#221a36!important}
html.th-cday .pan:is([data-lk=night],:not([data-lk])) .rim{fill:url(#thDayRim)!important;stroke:#ffffff!important;stroke-opacity:.9}
html.th-cday .pan:is([data-lk=night],:not([data-lk])) .bed{fill:url(#thDayBed)!important}
html.th-cday .pan:is([data-lk=night],:not([data-lk])) .field:not(:is(.active,.hit,.play-hit)) .zone{fill:url(#thDayZone)!important;stroke:#8f8a9c!important;stroke-width:3px!important}
html.th-cday .pan:is([data-lk=night],:not([data-lk])) .field:not(:is(.active,.hit,.play-hit)) text{fill:#2a2634!important}
html.th-cnight,html.th-cnight body{background:radial-gradient(120% 70% at 20% 0%,#1d1a14 0%,#0b0b0d 55%,#070708 100%) fixed;color:#f4f2ee}
html.th-cnight{--gold:#f4b13d;--gold-ink:#241400;--text:#f4f2ee;--muted:#a3a09a;--line:#34343c;--surface:#151518;--raised:#1f1f24;--bg:#0b0b0d;--steel:#dfe3ea}
html.th-cnight .pan:is([data-lk=night],:not([data-lk])) .rim{fill:url(#thNightRim)!important;stroke:#fff!important;stroke-opacity:.55}
html.th-cnight .pan:is([data-lk=night],:not([data-lk])) .bed{fill:url(#thNightBed)!important}
html.th-cnight .pan:is([data-lk=night],:not([data-lk])) .field:not(:is(.active,.hit,.play-hit)) .zone{fill:url(#thNightZone)!important;stroke:#d6d9df!important;stroke-width:3px!important}
html.th-cnight .pan:is([data-lk=night],:not([data-lk])) .field:not(:is(.active,.hit,.play-hit)) text{fill:#ffffff!important}
/* a struck note: brighter chrome and a soft glow, not a colour fill (a pan with its own hit colour keeps it) */
html.th-cday .pan:is([data-lk=night],:not([data-lk])):not(.lkhit) .field:is(.active,.hit,.play-hit) .zone,html.th-cday .pan:is([data-lk=night],:not([data-lk])):not(.lkhit) :is(.pan-ec,.pan-bf) .field:is(.active,.hit,.play-hit) .zone{fill:url(#thDayHit)!important;stroke:#ffffff!important;stroke-width:4px!important;animation:panStrike .38s var(--ease),thGlowDay .7s ease-out!important;filter:drop-shadow(0 0 7px rgb(150 185 235/.85))}
html.th-cday .pan:is([data-lk=night],:not([data-lk])):not(.lkhit) .field:is(.active,.hit,.play-hit) text{fill:#1d1930!important;stroke:none}
html.th-cnight .pan:is([data-lk=night],:not([data-lk])):not(.lkhit) .field:is(.active,.hit,.play-hit) .zone,html.th-cnight .pan:is([data-lk=night],:not([data-lk])):not(.lkhit) :is(.pan-ec,.pan-bf) .field:is(.active,.hit,.play-hit) .zone{fill:url(#thNightHit)!important;stroke:#fffaf0!important;stroke-width:4px!important;animation:panStrike .38s var(--ease),thGlowNight .7s ease-out!important;filter:drop-shadow(0 0 8px rgb(255 240 215/.75))}
html.th-cnight .pan:is([data-lk=night],:not([data-lk])):not(.lkhit) .field:is(.active,.hit,.play-hit) text{fill:#16161a!important;stroke:none}
@keyframes thGlowDay{0%{filter:drop-shadow(0 0 2px rgb(255 255 255/1)) brightness(1.15)}100%{filter:drop-shadow(0 0 7px rgb(150 185 235/.85))}}
@keyframes thGlowNight{0%{filter:drop-shadow(0 0 3px rgb(255 255 255/1)) brightness(1.25)}100%{filter:drop-shadow(0 0 8px rgb(255 240 215/.75))}}
@media (prefers-reduced-motion:reduce){html:is(.th-cday,.th-cnight) .pan .field:is(.active,.hit,.play-hit) .zone{animation:none!important}}
'''

if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'pan-notes-panyard.html')
    out = theme_css(open(src, encoding='utf-8').read())
    open(os.path.join(HERE, 'panyard-themes.css'), 'w', encoding='utf-8').write(out)
    print('wrote panyard-themes.css', len(out) // 1024, 'KB')
